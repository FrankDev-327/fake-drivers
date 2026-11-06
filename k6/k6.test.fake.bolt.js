import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { io } from 'k6/x/socketio';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:3000';
const NOTIFICATION_URL = __ENV.NOTIFICATION_URL || 'http://localhost:3007';
// not routed through the gateway yet, so the test calls these services directly on the compose network
const DRIVER_SERVICE_URL = __ENV.DRIVER_SERVICE_URL || 'http://driver-service:3002';
const RIDE_SERVICE_URL = __ENV.RIDE_SERVICE_URL || 'http://ride-service:3004';
// presigned URLs are signed for localhost:4566, unreachable from the k6 container
const S3_URL = __ENV.S3_URL || 'http://localhost:4566';

const PASSWORD = 'Password123!';
const ASSIGNMENT_TIMEOUT_MS = 20000;

// a real 300x300 PNG, and a text file that pretends to be one
const REAL_PHOTO = open('./fixtures/driver-photo.png', 'b');
const FAKE_PHOTO = 'this is plain text with an image/png content type, not a photo';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────

// counters
const drivers_registered = new Counter('drivers_registered');
const riders_registered = new Counter('riders_registered');
const drivers_online = new Counter('drivers_online');
const driver_online_refused_no_photo = new Counter('driver_online_refused_no_photo');
const photo_upload_urls = new Counter('photo_upload_urls');
const photo_upload_refused = new Counter('photo_upload_refused');
const photos_uploaded = new Counter('photos_uploaded');
const photos_confirmed = new Counter('photos_confirmed');
const fake_photos_rejected = new Counter('fake_photos_rejected');
const rides_requested = new Counter('rides_requested');
const rides_assigned = new Counter('rides_assigned');
const ride_assignment_timeouts = new Counter('ride_assignment_timeouts');
const busy_status_change_refused = new Counter('busy_status_change_refused');
const rides_completed = new Counter('rides_completed');
const drivers_released = new Counter('drivers_released');
const socket_errors = new Counter('socket_errors');
const receipts_delivered = new Counter('receipts_delivered');

// trends (true = time values, shown in ms)
const register_duration = new Trend('register_duration', true);
const login_duration = new Trend('login_duration', true);
const users_me_duration = new Trend('users_me_duration', true);
const photo_upload_url_duration = new Trend('photo_upload_url_duration', true);
const photo_upload_duration = new Trend('photo_upload_duration', true);
const photo_confirm_duration = new Trend('photo_confirm_duration', true);
const photo_sync_time = new Trend('photo_sync_time', true); // confirm → allowed online (Kafka hop)
const driver_status_duration = new Trend('driver_status_duration', true);
const driver_location_duration = new Trend('driver_location_duration', true);
const ride_request_duration = new Trend('ride_request_duration', true);
const ride_assignment_time = new Trend('ride_assignment_time', true); // request → driver gets ride_request
const driver_busy_sync_time = new Trend('driver_busy_sync_time', true); // assigned → driver BUSY
const ride_complete_duration = new Trend('ride_complete_duration', true);
const driver_release_time = new Trend('driver_release_time', true); // completed → driver AVAILABLE again
const receipt_delivery_time = new Trend('receipt_delivery_time', true); // completed → receipt sent (email-service + SES)

// rates
const no_photo_refused_rate = new Rate('no_photo_refused_rate');
const fake_photo_rejected_rate = new Rate('fake_photo_rejected_rate');
const driver_online_rate = new Rate('driver_online_rate');
const ride_assigned_rate = new Rate('ride_assigned_rate');
const receipt_delivered_rate = new Rate('receipt_delivered_rate');

// ─────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────

export const options = {
  scenarios: {
    driver_ride_flow: {
      executor: 'ramping-vus',
      exec: 'driverRideFlow',
      stages: [
        { duration: '30s', target: 2 },
        { duration: '2m', target: 5 },
        { duration: '1m', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'driver_flow' },
    },
    rider_app: {
      executor: 'constant-vus',
      exec: 'riderApp',
      vus: 2,
      duration: '4m',
      tags: { test_type: 'rider_app' },
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
    'http_req_duration{test_type:rider_app}': ['p(95)<500'],
    'http_req_duration{test_type:driver_flow}': ['p(95)<800'],
    ws_connecting: ['p(95)<1000'],

    // business rules: these must hold every time
    no_photo_refused_rate: ['rate>0.99'],
    fake_photo_rejected_rate: ['rate>0.99'],
    driver_online_rate: ['rate>0.95'],
    ride_assigned_rate: ['rate>0.90'],

    // async hops through Kafka
    photo_sync_time: ['p(95)<5000'],
    ride_assignment_time: ['p(95)<5000'],
    driver_busy_sync_time: ['p(95)<3000'],
    driver_release_time: ['p(95)<5000'],
    receipt_delivery_time: ['p(95)<10000'],
    receipt_delivered_rate: ['rate>0.90'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function bearer(token) {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

function parse(res) {
  try {
    return JSON.parse(res.body);
  } catch (e) {
    return null;
  }
}

// tags group URLs with ids into one name, so metrics don't get one series per driver or ride
function req(name, extra = {}) {
  return { tags: { name }, ...extra };
}

function randomBetween(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(6));
}

// somewhere in Tallinn, same area as the seed
function randomPoint() {
  return { lat: randomBetween(59.40, 59.46), lng: randomBetween(24.68, 24.82) };
}

function s3Url(url) {
  return url.replace(/^https?:\/\/[^/]+/, S3_URL);
}

// xk6-socket.io v0.1.0 calls custom event handlers with the array of emitted arguments
// (payload[1:] in its module.go), not the first argument as its README says
function eventPayload(args) {
  return Array.isArray(args) ? args[0] : args;
}

// poll until fn() is true; returns elapsed ms, or -1 on timeout
function waitFor(fn, timeoutMs, stepSeconds = 0.25) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return Date.now() - start;
    sleep(stepSeconds);
  }
  return -1;
}

// __VU / __ITER only exist inside a VU iteration; setup() runs outside one, where __ITER is undefined
function who() {
  return typeof __ITER === 'undefined' ? 'setup' : `${__VU}.${__ITER}`;
}

function register(role) {
  const email = `${role}.${who()}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@k6.fakebolt.com`;
  const res = http.post(
    `${GATEWAY_URL}/auth/register`,
    JSON.stringify({ email, password: PASSWORD, name: `k6-${role}-${who()}`, role }),
    { headers: JSON_HEADERS, ...req('POST /auth/register') },
  );
  check(res, { [`${role} registered`]: (r) => r.status === 201 && !!parse(r)?.token });
  register_duration.add(res.timings.duration, { role });
  if (res.status !== 201) {
    console.error(`register ${role} failed: ${res.status} ${String(res.body).slice(0, 300)}`);
  }

  const token = parse(res)?.token;
  if (!token) return null;

  const meRes = http.get(`${GATEWAY_URL}/users/me`, { headers: bearer(token), ...req('GET /users/me') });
  check(meRes, { 'profile loaded': (r) => r.status === 200 });
  users_me_duration.add(meRes.timings.duration, { role });

  const me = parse(meRes);
  return me ? { token, email, userId: me.id, photoRequired: me.photo_required } : null;
}

function requestUploadUrl(token, contentType, sizeBytes, expectedStatus = 201) {
  const res = http.post(
    `${GATEWAY_URL}/users/me/photo/upload-url`,
    JSON.stringify({ content_type: contentType, size_bytes: sizeBytes }),
    {
      headers: bearer(token),
      responseCallback: http.expectedStatuses(expectedStatus),
      ...req('POST /users/me/photo/upload-url'),
    },
  );
  photo_upload_url_duration.add(res.timings.duration);
  return res;
}

// upload-url → PUT to S3 → confirm; returns the confirm response (or null if an earlier step failed)
function uploadPhoto(token, body, sizeBytes, expectedConfirmStatus) {
  const urlRes = requestUploadUrl(token, 'image/png', sizeBytes);
  check(urlRes, { 'photo upload url created': (r) => r.status === 201 });
  photo_upload_urls.add(1);
  const upload = parse(urlRes);
  if (!upload?.upload_url) return null;

  const putRes = http.put(s3Url(upload.upload_url), body, {
    headers: { 'Content-Type': 'image/png' },
    ...req('PUT s3 photo'),
  });
  check(putRes, { 'photo uploaded to s3': (r) => r.status === 200 });
  photo_upload_duration.add(putRes.timings.duration);
  photos_uploaded.add(1);
  if (putRes.status !== 200) return null;

  const confirmRes = http.post(
    `${GATEWAY_URL}/users/me/photo/confirm`,
    JSON.stringify({ key: upload.key }),
    {
      headers: bearer(token),
      responseCallback: http.expectedStatuses(expectedConfirmStatus),
      ...req('POST /users/me/photo/confirm'),
    },
  );
  photo_confirm_duration.add(confirmRes.timings.duration);
  return confirmRes;
}

function setDriverStatus(token, driverId, status, expectedStatuses) {
  const res = http.patch(
    `${GATEWAY_URL}/drivers/${driverId}/status`,
    JSON.stringify({ status }),
    {
      headers: bearer(token),
      responseCallback: http.expectedStatuses(...expectedStatuses),
      ...req('PATCH /drivers/:id/status'),
    },
  );
  driver_status_duration.add(res.timings.duration, { target_status: status });
  return res;
}

function getDriverStatus(token, driverId) {
  const res = http.get(`${GATEWAY_URL}/drivers/${driverId}`, {
    headers: bearer(token),
    ...req('GET /drivers/:id'),
  });
  return parse(res)?.status;
}

function updateRide(rideId, body) {
  return http.patch(`${RIDE_SERVICE_URL}/rides/${rideId}/status`, JSON.stringify(body), {
    headers: JSON_HEADERS,
    ...req('PATCH /rides/:id/status'),
  });
}

// ─────────────────────────────────────────
// SETUP: one rider who requests every ride
// ─────────────────────────────────────────

export function setup() {
  const rider = register('rider');
  if (!rider) throw new Error('setup failed: could not register the test rider, is the stack up?');
  riders_registered.add(1);
  return { riderId: rider.userId, riderToken: rider.token };
}

// ─────────────────────────────────────────
// SCENARIO 1: a driver signs up, proves the photo rules, goes online and drives one ride
// ─────────────────────────────────────────

export function driverRideFlow(data) {
  const spot = randomPoint();
  let driver;
  let driverId;

  group('driver signs up', function () {
    driver = register('driver');
    if (!driver) return;
    drivers_registered.add(1);
    check(driver, { 'photo is required for drivers': (d) => d.photoRequired === true });

    // the driver starts exactly at the pickup point, so matching picks this driver (distance 0)
    const res = http.post(
      `${DRIVER_SERVICE_URL}/drivers`,
      JSON.stringify({ userId: driver.userId, name: `k6-driver-${__VU}`, email: driver.email, lat: spot.lat, lng: spot.lng }),
      { headers: JSON_HEADERS, ...req('POST /drivers') },
    );
    check(res, { 'driver profile created': (r) => r.status === 201 });
    driverId = parse(res)?.id;
  });
  if (!driver || !driverId) return;

  group('no photo, no work', function () {
    const res = setDriverStatus(driver.token, driverId, 'available', [422]);
    const refused = res.status === 422;
    check(res, {
      'cannot go online without a photo': () => refused,
      'refusal asks for a photo': (r) => refused && /photo/i.test(parse(r)?.message || ''),
    });
    no_photo_refused_rate.add(refused);
    if (refused) driver_online_refused_no_photo.add(1);
  });

  group('photo rules', function () {
    const tooBig = requestUploadUrl(driver.token, 'image/png', 6 * 1024 * 1024, 400);
    check(tooBig, { 'photo over 5 MB refused': (r) => r.status === 400 });

    const wrongType = requestUploadUrl(driver.token, 'application/pdf', 1000, 400);
    check(wrongType, { 'non-image type refused': (r) => r.status === 400 });
    photo_upload_refused.add((tooBig.status === 400 ? 1 : 0) + (wrongType.status === 400 ? 1 : 0));

    // text bytes sent as image/png: S3 accepts the upload, confirm must catch it
    const fake = uploadPhoto(driver.token, FAKE_PHOTO, FAKE_PHOTO.length, 400);
    const rejected = fake?.status === 400;
    check(fake, {
      'fake photo rejected on confirm': () => rejected,
      'rejection says it is not a real image': (r) => rejected && /not a real/i.test(parse(r)?.message || ''),
    });
    fake_photo_rejected_rate.add(rejected);
    if (rejected) fake_photos_rejected.add(1);

    const stillRefused = setDriverStatus(driver.token, driverId, 'available', [422]);
    check(stillRefused, { 'still cannot go online after a fake photo': (r) => r.status === 422 });
    no_photo_refused_rate.add(stillRefused.status === 422);

    const real = uploadPhoto(driver.token, REAL_PHOTO, REAL_PHOTO.byteLength, 200);
    check(real, {
      'real photo accepted': (r) => r?.status === 200,
      'profile shows the photo url': (r) => !!parse(r)?.photo_url,
    });
    if (real?.status === 200) photos_confirmed.add(1);
  });

  let online = false;
  group('driver goes online', function () {
    // has_photo reaches driver-service through Kafka, so retry until it lands
    const elapsed = waitFor(() => setDriverStatus(driver.token, driverId, 'available', [200, 422]).status === 200, 10000, 0.5);
    online = elapsed >= 0;
    check(online, { 'driver online after a real photo': (v) => v === true });
    driver_online_rate.add(online);
    if (!online) return;
    drivers_online.add(1);
    photo_sync_time.add(elapsed);

    const loc = http.patch(
      `${GATEWAY_URL}/drivers/${driverId}/location`,
      JSON.stringify({ lat: spot.lat, lng: spot.lng }),
      { headers: bearer(driver.token), ...req('PATCH /drivers/:id/location') },
    );
    check(loc, { 'location updated': (r) => r.status === 200 });
    driver_location_duration.add(loc.timings.duration);
  });
  if (!online) return;

  group('ride: request, assignment, completion', function () {
    const destination = randomPoint();
    let rideId = null;
    let requestedAt = 0;
    let assigned = false;

    // notification-service puts each socket in a room named after the id it connects with;
    // ride events carry drivers.id, so the driver connects with driverId (see README: identity gap)
    const socketOptions = {
      path: '/socket.io/',
      query: { userId: driverId },
      params: { tags: { name: 'notification socket' } },
    };

    io(NOTIFICATION_URL, socketOptions, (socket) => {
      socket.on('connect', () => {
        requestedAt = Date.now();
        const res = http.post(
          `${RIDE_SERVICE_URL}/rides/request`,
          JSON.stringify({
            riderId: data.riderId,
            pickupLat: spot.lat,
            pickupLng: spot.lng,
            destinationLat: destination.lat,
            destinationLng: destination.lng,
          }),
          { headers: JSON_HEADERS, ...req('POST /rides/request') },
        );
        check(res, { 'ride requested': (r) => r.status === 201 });
        ride_request_duration.add(res.timings.duration);
        rides_requested.add(1);
        rideId = parse(res)?.id;
        if (!rideId) socket.close();
      });

      socket.on('ride_request', (args) => {
        const msg = eventPayload(args);
        if (!msg || msg.rideId !== rideId || assigned) return;
        assigned = true;
        ride_assignment_time.add(Date.now() - requestedAt);
        ride_assigned_rate.add(true);
        rides_assigned.add(1);
        check(msg, { 'driver got the ride request': (m) => m.rideId === rideId });

        // driver-service flips the driver to BUSY from the same Kafka event, in parallel
        const busyAfter = waitFor(() => getDriverStatus(driver.token, driverId) === 'busy', 5000);
        check(busyAfter, { 'driver is busy during the ride': (v) => v >= 0 });
        if (busyAfter >= 0) driver_busy_sync_time.add(busyAfter);

        const goOffline = setDriverStatus(driver.token, driverId, 'offline', [409]);
        check(goOffline, { 'cannot change status mid-ride': (r) => r.status === 409 });
        if (goOffline.status === 409) busy_status_change_refused.add(1);

        // ride-service stores the driver on the ride from the same event; completing before that
        // would publish ride.completed without a driverId and the driver would never be released
        const matchedAfter = waitFor(() => {
          const ride = parse(http.get(`${RIDE_SERVICE_URL}/rides/${rideId}`, req('GET /rides/:id')));
          return ride?.status === 'matched' && ride?.driverId === driverId;
        }, 5000);
        check(matchedAfter, { 'ride matched to this driver': (v) => v >= 0 });

        const started = updateRide(rideId, { status: 'in_progress' });
        check(started, { 'ride started': (r) => r.status === 200 });

        sleep(1); // a very short ride

        const completed = updateRide(rideId, { status: 'completed', fare: randomBetween(5, 25) });
        check(completed, { 'ride completed': (r) => r.status === 200 });
        ride_complete_duration.add(completed.timings.duration);
        if (completed.status === 200) rides_completed.add(1);
      });

      socket.on('ride_completed', (args) => {
        const msg = eventPayload(args);
        if (msg?.rideId !== rideId) return;
        check(msg, { 'driver notified the ride is completed': (m) => m.rideId === rideId });
        socket.close();
      });

      socket.on('error', (err) => {
        socket_errors.add(1);
        console.error(`VU ${__VU} socket error: ${JSON.stringify(err)}`);
        socket.close();
      });

      socket.setTimeout(() => {
        if (!assigned) {
          ride_assignment_timeouts.add(1);
          ride_assigned_rate.add(false);
          console.warn(`VU ${__VU} no ride_request within ${ASSIGNMENT_TIMEOUT_MS} ms for ride ${rideId}`);
        }
        socket.close();
      }, ASSIGNMENT_TIMEOUT_MS);
    });

    if (!assigned) return;

    // ride.completed → driver-service puts the driver back in the pool
    const releasedAfter = waitFor(() => getDriverStatus(driver.token, driverId) === 'available', 10000);
    check(releasedAfter, { 'driver available again after the ride': (v) => v >= 0 });
    if (releasedAfter >= 0) {
      driver_release_time.add(releasedAfter);
      drivers_released.add(1);
    }

    // ride.completed → email-service → SES (Floci); the rider sees it in their receipts
    const receiptAfter = waitFor(() => {
      const res = http.get(`${GATEWAY_URL}/users/me/receipts`, {
        headers: bearer(data.riderToken),
        ...req('GET /users/me/receipts'),
      });
      const receipts = parse(res) || [];
      return receipts.some((r) => r.ride_id === rideId && r.receipt?.status === 'sent');
    }, 15000, 0.5);
    const delivered = receiptAfter >= 0;
    check(delivered, { 'rider got the ride receipt email': (v) => v === true });
    receipt_delivered_rate.add(delivered);
    if (delivered) {
      receipt_delivery_time.add(receiptAfter);
      receipts_delivered.add(1);
    }
  });

  group('driver goes offline', function () {
    const res = setDriverStatus(driver.token, driverId, 'offline', [200]);
    check(res, { 'driver offline at the end of the shift': (r) => r.status === 200 });
  });

  sleep(1);
}

// ─────────────────────────────────────────
// SCENARIO 2: rider app traffic (auth, profile, photo optional)
// ─────────────────────────────────────────

export function riderApp() {
  let rider;

  group('rider signs up', function () {
    rider = register('rider');
    if (!rider) return;
    riders_registered.add(1);
    check(rider, { 'photo is optional for riders': (r) => r.photoRequired === false });
  });
  if (!rider) return;

  group('rider logs in', function () {
    const res = http.post(
      `${GATEWAY_URL}/auth/login`,
      JSON.stringify({ email: rider.email, password: PASSWORD }),
      { headers: JSON_HEADERS, ...req('POST /auth/login') },
    );
    check(res, { 'rider logged in': (r) => r.status === 200 && !!parse(r)?.token });
    login_duration.add(res.timings.duration);
  });

  group('wrong password refused', function () {
    const res = http.post(
      `${GATEWAY_URL}/auth/login`,
      JSON.stringify({ email: rider.email, password: 'wrong-password' }),
      { headers: JSON_HEADERS, responseCallback: http.expectedStatuses(401), ...req('POST /auth/login') },
    );
    check(res, { 'wrong password gives 401': (r) => r.status === 401 });
  });

  sleep(1);
}

export function teardown() {
  console.log('fake-bolt k6 test finished');
}

// ─────────────────────────────────────────
// SUMMARY: html report + json + text, plus a short business result
// ─────────────────────────────────────────

function value(data, name, stat) {
  const m = data.metrics[name];
  return m && m.values[stat] !== undefined ? m.values[stat] : undefined;
}

function n(v) {
  return v === undefined ? '-' : String(Math.round(v));
}

function pct(v) {
  return v === undefined ? '-' : `${(v * 100).toFixed(1)}%`;
}

function ms(v) {
  return v === undefined ? '-' : `${Math.round(v)} ms`;
}

function businessResult(data) {
  const failed = [];
  for (const [name, metric] of Object.entries(data.metrics)) {
    for (const [expr, t] of Object.entries(metric.thresholds || {})) {
      if (!t.ok) failed.push(`${name}: ${expr}`);
    }
  }

  // a threshold with no samples counts as passed, so a run that never got going would look green
  const iterations = value(data, 'iterations', 'count') || 0;
  const verdict = iterations === 0 ? 'NO DATA (no iteration ran, check the setup error above)' : failed.length === 0 ? 'PASSED' : 'FAILED';

  const lines = [
    '',
    '═══════════════════════════════════════════════',
    `  fake-bolt k6 result: ${verdict}`,
    '═══════════════════════════════════════════════',
    `  Drivers signed up ............ ${n(value(data, 'drivers_registered', 'count'))}`,
    `  Online without photo refused . ${n(value(data, 'driver_online_refused_no_photo', 'count'))} (rule held ${pct(value(data, 'no_photo_refused_rate', 'rate'))})`,
    `  Photo uploads refused ........ ${n(value(data, 'photo_upload_refused', 'count'))} (too big / not an image type)`,
    `  Fake photos rejected ......... ${n(value(data, 'fake_photos_rejected', 'count'))} (rule held ${pct(value(data, 'fake_photo_rejected_rate', 'rate'))})`,
    `  Real photos confirmed ........ ${n(value(data, 'photos_confirmed', 'count'))}`,
    `  Drivers online ............... ${n(value(data, 'drivers_online', 'count'))} (${pct(value(data, 'driver_online_rate', 'rate'))}), photo sync p95 ${ms(value(data, 'photo_sync_time', 'p(95)'))}`,
    `  Rides requested / assigned ... ${n(value(data, 'rides_requested', 'count'))} / ${n(value(data, 'rides_assigned', 'count'))} (${pct(value(data, 'ride_assigned_rate', 'rate'))})`,
    `  Assignment time p95 .......... ${ms(value(data, 'ride_assignment_time', 'p(95)'))}, timeouts ${n(value(data, 'ride_assignment_timeouts', 'count'))}`,
    `  Mid-ride status change refused ${n(value(data, 'busy_status_change_refused', 'count'))}`,
    `  Rides completed .............. ${n(value(data, 'rides_completed', 'count'))}`,
    `  Drivers back in the pool ..... ${n(value(data, 'drivers_released', 'count'))}, release p95 ${ms(value(data, 'driver_release_time', 'p(95)'))}`,
    `  Receipts emailed ............. ${n(value(data, 'receipts_delivered', 'count'))} (${pct(value(data, 'receipt_delivered_rate', 'rate'))}), p95 ${ms(value(data, 'receipt_delivery_time', 'p(95)'))}`,
    `  Riders signed up ............. ${n(value(data, 'riders_registered', 'count'))}`,
    `  HTTP requests ................ ${n(value(data, 'http_reqs', 'count'))}, failed ${pct(value(data, 'http_req_failed', 'rate'))}, p95 ${ms(value(data, 'http_req_duration', 'p(95)'))}`,
    `  Iterations ................... ${n(iterations)}`,
    `  Checks passed ................ ${pct(value(data, 'checks', 'rate'))}`,
    `  Socket errors ................ ${n(value(data, 'socket_errors', 'count'))}`,
  ];
  if (failed.length > 0) {
    lines.push('  Failed thresholds:');
    failed.forEach((f) => lines.push(`    ✗ ${f}`));
  }
  lines.push('═══════════════════════════════════════════════', '');
  return lines.join('\n');
}

export function handleSummary(data) {
  const result = businessResult(data);
  return {
    'fake-bolt.k6.html': htmlReport(data, { title: 'fake-bolt k6' }),
    'fake-bolt.k6.summary.json': JSON.stringify(data, null, 2),
    'fake-bolt.k6.result.txt': result,
    stdout: textSummary(data, { indent: ' ', enableColors: true }) + result,
  };
}
