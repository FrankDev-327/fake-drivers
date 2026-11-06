# fake-bolt

A ride-hailing backend inspired by Bolt, built as microservices with NestJS, TypeScript, PostgreSQL, Redis, Kafka and Socket.io, plus a fake AWS (Floci) for S3 and a full Prometheus / Grafana / Loki observability stack.

> **Status: work in progress.** All 9 services compile, resolve their Nest dependencies and have no known boot blockers left, but the stack has **not been run in Docker yet**, so the first `docker compose up` will probably surface a few small bugs. The full, filterable gap list lives in [`project-analysis.html`](project-analysis.html).

## Architecture

```mermaid
flowchart LR
    client([Mobile app / k6])

    subgraph edge[Edge]
        gateway[gateway :3000<br/>JWT, rate limit, routing]
    end

    subgraph services[Services]
        auth[auth-service :3001<br/>users, JWT, profile photo]
        driver[driver-service :3002<br/>status, location]
        rider[rider-service :3003]
        ride[ride-service :3004<br/>ride lifecycle]
        matching[matching-service :3005<br/>nearest driver]
        notification[notification-service :3007<br/>Socket.io]
        payment[payment-service :3006<br/>scaffold]
        email[email-service :3008<br/>ride receipts]
    end

    subgraph infra[Infrastructure]
        pg[(PostgreSQL<br/>one DB per service)]
        redis[(Redis<br/>GEO pool + Socket.io adapter)]
        kafka{{Kafka}}
        floci[(Floci<br/>S3 photos + SES email)]
    end

    client -->|HTTP| gateway
    client -.->|WebSocket| notification
    client -.->|presigned PUT| floci

    gateway --> auth
    gateway --> driver
    gateway --> email

    auth --> pg
    auth --> floci
    driver --> pg
    rider --> pg
    ride --> pg
    payment --> pg
    email --> pg
    email --> floci
    email -->|rider email| auth

    driver --> redis
    matching --> redis
    notification --> redis

    auth --> kafka
    driver <--> kafka
    ride <--> kafka
    matching <--> kafka
    kafka --> notification
    kafka --> email
```

- **Kafka over RabbitMQ:** the services exchange a stream of facts (ride requested, driver assigned...) that several consumers read independently.
- **Socket.io bypasses the gateway:** WebSocket connections are stateful, the gateway stays stateless HTTP.
- **Redis GEO for matching:** available drivers live in a GEO set, so finding the nearest one is a `GEOSEARCH`, not a table scan.
- **Identity from the JWT only:** the gateway verifies the token and forwards `x-user-id`; services never trust a user id from the request body (done for `/users/me`, still to do for drivers and rides).

## Services

| Service | Port | Storage | What it does |
|---|---|---|---|
| gateway | 3000 (published) | none | Verifies JWTs, routes `/auth`, `/users/me`, `/drivers`, passes downstream status codes through (4xx are not turned into 500) |
| auth-service | 3001 | `auth_db`, S3 | Register / login (bcrypt + JWT), profile photo upload, publishes `user.photo.updated` |
| driver-service | 3002 | `driver_db`, Redis GEO | Driver profile, online status, location; keeps the `drivers:available` pool; consumes ride events to set BUSY / AVAILABLE |
| rider-service | 3003 | `rider_db` | Rider profile (create / get) |
| ride-service | 3004 | `ride_db` | Ride request, status updates, history; publishes `ride.requested`, `ride.status.updated`, `ride.completed` |
| matching-service | 3005 | Redis GEO | Consumes `ride.requested`, atomically claims the nearest driver, publishes `driver.assigned` |
| notification-service | 3007 (published) | Redis (adapter) | Socket.io push to riders and drivers for ride and payment events |
| payment-service | 3006 | `payment_db` | Nest scaffold only, Stripe flow still to build |
| email-service | 3008 | `email_db`, SES | Consumes `ride.completed`, emails the rider a receipt through SES (Floci), keeps every email in `sent_emails`, which is also the rider's ride history |
| seed | none | none | Creates 100 drivers and 200 riders around Tallinn through the real APIs |

Every service exposes `GET /health` (returns `OK`) for the compose healthchecks and `GET /metrics` for Prometheus. All of them listen on the `PORT` compose gives them.

### Databases

- One Postgres instance, one database per service. `auth_db` comes from `POSTGRES_DB`; the rest (`driver_db`, `rider_db`, `ride_db`, `payment_db`, `email_db`) are created by `postgres/init/01-create-databases.sql` on the first boot.
- Each service's `orm.ts` (at the service root) connects with `DATABASE_URL` and runs its migrations when the service starts (`migrationsRun: true`). Migrations use the QueryRunner API with snake_case columns; entities map their camelCase properties to them with `@Column({ name })`.

## Ride flow

```mermaid
sequenceDiagram
    autonumber
    participant R as Rider app
    participant RS as ride-service
    participant K as Kafka
    participant M as matching-service
    participant Redis as Redis GEO
    participant D as driver-service
    participant N as notification-service

    R->>RS: POST /rides/request
    RS->>K: ride.requested
    K->>M: ride.requested
    M->>Redis: Lua: GEOSEARCH nearest + ZREM (one atomic step)
    Redis-->>M: driverId (or nil)
    M->>K: driver.assigned
    K->>RS: driver.assigned → ride MATCHED
    K->>D: driver.assigned → driver BUSY
    K->>N: driver.assigned
    N-->>R: driver_assigned (Socket.io)
    Note over RS: ... ride in progress ...
    RS->>K: ride.completed
    K->>D: driver back to AVAILABLE, re-added to the pool
    K->>N: ride.completed
    N-->>R: ride_completed
```

### Kafka topics

| Topic | Producer | Consumers |
|---|---|---|
| `ride.requested` | ride | matching |
| `driver.assigned` | matching | ride, driver, notification |
| `ride.status.updated` | ride | notification, driver (cancellations) |
| `ride.completed` | ride | notification, driver, email |
| `user.photo.updated` | auth | driver |
| `driver.status.updated` | driver | none yet |
| `driver.location.updated` | driver | none yet |
| `driver.declined` | none yet | matching |
| `payment.completed` / `payment.failed` | none yet | notification |

Messages are keyed (by `driverId`, `rideId` or `userId`) so events for the same entity stay ordered on one partition. The driver, matching and notification consumers start in `onApplicationBootstrap`, after every handler is registered, so early events aren't lost.

## Driver status

```mermaid
stateDiagram-v2
    [*] --> OFFLINE: driver profile created
    OFFLINE --> AVAILABLE: PATCH status (needs a profile photo)
    AVAILABLE --> OFFLINE: PATCH status / photo removed
    AVAILABLE --> BUSY: driver.assigned (system only)
    BUSY --> AVAILABLE: ride.completed or cancelled
    BUSY --> OFFLINE: ride ends and the photo was removed
```

- Only **AVAILABLE** drivers are in the Redis pool, so only they can be matched.
- **BUSY is owned by the system:** `PATCH status=busy` returns **422**, and any manual change while BUSY returns **409** ("finish the current ride first"). Location pings from a busy driver never put them back in the pool.
- **Matching is race-free:** a Lua script runs `GEOSEARCH` and `ZREM` atomically, so two rides (or two matching instances) can't claim the same driver.

## Profile photos (Floci S3)

The photo belongs to the person, so auth-service owns it (`users.photo_key`). It is **mandatory for drivers** (they can't go online without one) and **optional for riders**.

```mermaid
sequenceDiagram
    autonumber
    participant A as App
    participant G as gateway
    participant Auth as auth-service
    participant S3 as Floci S3
    participant K as Kafka
    participant D as driver-service

    A->>G: POST /users/me/photo/upload-url {content_type, size_bytes}
    G->>Auth: + x-user-id from JWT
    Auth-->>A: presigned PUT url + key users/{userId}/{uuid}.jpg
    A->>S3: PUT photo bytes
    A->>G: POST /users/me/photo/confirm {key}
    G->>Auth: + x-user-id
    Auth->>S3: HeadObject (exists, type, size)
    Auth->>Auth: save photo_key, delete the old photo
    Auth->>K: user.photo.updated {userId, role, hasPhoto: true}
    K->>D: drivers.has_photo = true
```

- Allowed: jpeg, png, webp, up to 5 MB. The server picks the key, so a user can only write under their own folder.
- Removing the photo (`DELETE /users/me/photo`) while a driver is online takes them offline and out of the pool.
- Planned next: a validation Lambda (like fake-vinted) that checks the real file and makes a thumbnail.

## Ride receipts by email (SES on Floci)

When a ride completes, the rider gets a receipt email. It's sent through **AWS SES emulated by Floci**, with the same `@aws-sdk/client-sesv2` code you'd use on real AWS and nothing extra to run.

```mermaid
sequenceDiagram
    autonumber
    participant RS as ride-service
    participant K as Kafka
    participant E as email-service
    participant DB as email_db
    participant A as auth-service
    participant SES as Floci SES

    RS->>K: ride.completed {rideId, riderId, fare, pickup, destination, requestedAt, completedAt}
    K->>E: ride.completed
    E->>DB: already sent for this ride? → skip (unique ride_id + type)
    E->>A: GET /internal/users/:riderId (email, name)
    E->>DB: insert sent_emails row (pending, ride snapshot)
    E->>SES: SendEmail (HTML + text receipt)
    E->>DB: status sent, ses_message_id, sent_at
```

- **Why a separate service:** email has different rules from socket pushes. A push that arrives 5 min late is useless, so notification-service skips failures. A receipt must be retried and never sent twice, which needs a database. Keeping them apart also means a slow email provider can't delay ride notifications.
- **Never twice:** the unique `(ride_id, type)` index skips events Kafka delivers again (`emails_duplicate_skipped_total`).
- **Retries:** if SES or auth-service fails, the consumer rethrows and Kafka retries; the row keeps `attempts` and `last_error`. A rider who doesn't exist is final: recorded as failed, not retried.
- **Ride history:** each row stores a snapshot of the ride (fare, pickup, destination, times), so `GET /users/me/receipts` shows past rides even when ride-service is down.
- **Sender identity:** SES only sends from verified addresses, on Floci as on AWS. `floci/init/ready.d/02-verify-ses-sender.sh` verifies `no-reply@fakebolt.local` on boot.
- **See the emails:** `curl http://localhost:4566/_aws/ses` lists every message Floci captured.

## API (through the gateway, `http://localhost:3000`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{email, password, name, role: rider\|driver}` → `{token}` |
| POST | `/auth/login` | public | `{email, password}` → `{token}` |
| GET | `/users/me` | JWT | Profile with `photo_url` and `photo_required` |
| POST | `/users/me/photo/upload-url` | JWT | `{content_type, size_bytes}` → presigned URL |
| POST | `/users/me/photo/confirm` | JWT | `{key}` |
| DELETE | `/users/me/photo` | JWT | |
| GET | `/users/me/receipts` | JWT | Past rides with their emailed receipts, newest first |
| GET | `/drivers/:id` | JWT | |
| PATCH | `/drivers/:id/status` | JWT | `{status: available\|offline}` (422 without photo, 409 while busy) |
| PATCH | `/drivers/:id/location` | JWT | `{lat, lng}` |
| GET | `/health`, `/metrics` | public | |

Real-time events: connect Socket.io to `http://localhost:3007?userId=<id>` and listen for `driver_assigned`, `ride_request`, `ride_status_updated`, `ride_completed`, `payment_completed`, `payment_failed`.

Ride and rider endpoints exist on their services (`POST /rides/request`, `GET /rides/:id`, `PATCH /rides/:id/status`, `POST /riders`...) but aren't routed through the gateway yet.

## Observability

- **Metrics:** every service exposes `/metrics` (prom-client). Grafana Alloy scrapes them plus the Kafka, Redis and Postgres exporters and remote-writes to Prometheus.
- **Email metrics:** `emails_sent_total`, `emails_failed_total{reason}`, `emails_duplicate_skipped_total`, `email_send_duration_seconds`, `email_delivery_delay_seconds` (ride completed → receipt sent). Alerts: `RideReceiptsFailing`, `RideReceiptsSlow`.
- **Business metrics:** `ride_matching_duration_seconds`, `matching_attempts/success/failed_total`, `driver_location_updates_total`, `driver_status_updates_total`, `ride_requests_total`, `socket_connections_active`, `notifications_sent_total`, `notifications_skipped_total`, `kafka_messages_produced/consumed/failed_total`.
- **Logs:** Winston writes JSON to `/logs/<service>.log`; Alloy ships them to Loki.
- **Alerts:** `prometheus/alerts.yml` covers availability, p99 latency, error rate, matching too slow, stale driver locations, Redis memory and Postgres connections (no Alertmanager yet).

| Tool | URL |
|---|---|
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3300 |
| Loki | http://localhost:3100 |
| Floci (S3, SES) | http://localhost:4566 (sent emails: `/_aws/ses`) |

## Docker images

All services use **pnpm 10.34.8** (pinned with `packageManager`, installed in the image through corepack) and the same 3-stage `node:22-alpine` Dockerfile:

1. **base:** corepack + pnpm
2. **builder:** `pnpm install --frozen-lockfile`, `pnpm run build`
3. **production:** `pnpm install --prod --frozen-lockfile`, only `dist/`, `NODE_ENV=production`, runs as `node`, `CMD node dist/src/main.js`

`orm.ts` and `logger.ts` live at each service root, which is why the build lands in `dist/src`. A per-service `.dockerignore` keeps `node_modules`, `.env` and tests out of the build context, and the pnpm store is a BuildKit cache mount, so it never ends up in the image. Production dependencies range from 43 MB (matching) to 160 MB (auth).

## Load test (k6)

A custom k6 image (`k6/Dockerfile`) built with [xk6-socket.io](https://github.com/xemax32/xk6-socket.io) v0.1.0, the same extension as fake-vinted. k6's own WebSocket client speaks raw WebSocket, not the Socket.io protocol, so it can't receive notification-service events. It starts after the services it depends on, its entrypoint waits until the gateway answers `/health`, then it runs the test and exits.

**Scenario `driver_ride_flow`** (ramps 2 → 5 VUs), one full driver shift per iteration:

```mermaid
flowchart LR
    A[sign up +<br/>driver profile] --> B{go online<br/>no photo}
    B -->|422| C[photo rules:<br/>6 MB refused<br/>PDF refused<br/>fake PNG rejected]
    C --> D{go online}
    D -->|still 422| E[upload real photo]
    E --> F[online<br/>after Kafka sync]
    F --> G[Socket.io connect<br/>rider requests a ride]
    G --> H[ride_request received<br/>driver BUSY]
    H --> I{go offline<br/>mid-ride}
    I -->|409| J[ride in_progress<br/>→ completed]
    J --> K[driver AVAILABLE<br/>again → offline]
    J --> L[rider's receipt<br/>emailed via SES]
```

The "fake photo" is a text file uploaded as `image/png`: S3 accepts it, and auth-service's confirm rejects it by checking the file's first bytes (PNG / JPEG / WEBP signatures).

**Scenario `rider_app`** (2 VUs): register, login, wrong password (401), and checks the photo is optional for riders.

**Custom metrics** (all tagged with `test_type` per scenario; URLs with ids are tagged with a fixed `name` like `PATCH /drivers/:id/status`):

| Kind | Metrics |
|---|---|
| Counters | `drivers_registered`, `driver_online_refused_no_photo`, `photo_upload_refused`, `fake_photos_rejected`, `photos_confirmed`, `drivers_online`, `rides_requested`, `rides_assigned`, `ride_assignment_timeouts`, `busy_status_change_refused`, `rides_completed`, `drivers_released`, `riders_registered`, `socket_errors` |
| Timings | `photo_sync_time` (confirm → allowed online), `ride_assignment_time` (request → driver notified), `driver_busy_sync_time`, `driver_release_time`, plus per-endpoint durations |
| Rates | `no_photo_refused_rate`, `fake_photo_rejected_rate` (both must be > 99%), `driver_online_rate`, `ride_assigned_rate` |

**Summary:** at the end k6 prints its text summary plus a short business result (PASSED / FAILED, drivers online, fake photos rejected, rides assigned, p95 assignment time, failed thresholds). Files written to `k6_reports/`:

- `fake-bolt.k6.html`: HTML report
- `fake-bolt.k6.result.txt`: the business result
- `fake-bolt.k6.summary.json`: raw summary

Metrics are also pushed to Prometheus (`experimental-prometheus-rw`), so the run shows up in Grafana next to the service metrics.

Ride and driver-profile endpoints aren't behind the gateway yet, so the test calls driver-service and ride-service directly on the compose network.

## Running it

```bash
cp env.example .env              # then set a real JWT_SECRET: openssl rand -hex 32
docker compose up -d --build     # infra, services, observability, Floci, seed
docker compose ps                # wait until the services show (healthy)
docker compose --profile testing run --rm k6   # load test, container removed when it ends
docker compose down -v --rmi all # clean up containers, images and volumes
```

- `depends_on` only waits for containers to **start**, not to be ready. The Node services have `restart: on-failure`, so one that boots before Kafka or Postgres is ready exits and comes back; the seed and k6 wait for `/health` themselves.
- The database init script only runs on an **empty** Postgres volume. If you ran an older version of the stack, do `docker compose down -v` once first.
- Sent emails: `curl http://localhost:4566/_aws/ses`. k6 reports: `k6_reports/`.

Local development of a single service:

```bash
cd driver-service
npx pnpm@10.34.8 install
npx pnpm@10.34.8 run start:dev
```

## What's been done so far

- Microservice skeleton for gateway, auth, driver, rider, ride, matching, notification and payment, with Postgres migrations (QueryRunner API), Kafka, Redis and a seed.
- `GET /health` in all 8 services.
- Kafka message keys fixed (the key must sit inside `messages[]`).
- Profile photos on Floci S3: presigned upload, confirm, delete, mandatory for drivers, synced to driver-service over Kafka.
- Gateway: `/users/me` routes, identity from the JWT, real downstream status codes.
- Switched every service to pnpm; rebuilt the Dockerfiles (Node 22, non-root, `.dockerignore`, `dist/src/main.js`); bcrypt 6 with prebuilt Alpine binaries.
- notification-service: real `/metrics`, Redis adapter done the Nest way, module wiring fixed, events without a recipient counted instead of emitted to `undefined`.
- matching-service: Redis GEO matching implemented with an atomic Lua claim, full matching metrics, consumer that retries instead of dropping ride requests.
- driver-service: BUSY lifecycle driven by ride events, so a driver on a ride never gets another request.
- auth-service checks the photo's real bytes on confirm, so a renamed text file can't pass as a driver photo.
- Boot fixes: `orm.ts` on `DATABASE_URL` with migrations on start, Postgres init script, snake_case column mapping, `PORT` everywhere, Nest wiring fixed in auth/ride/rider (every service passes a dependency preview check), `/metrics` on every service, seed fixed, `restart: on-failure`.
- k6 load test with a custom Socket.io-capable image, driver photo rules, the full ride flow, custom metrics and a business summary.
- email-service: ride receipts through SES on Floci, `sent_emails` log with a ride snapshot (QueryRunner migration), no duplicate sends, retries, Prometheus metrics + alerts, scraped by Alloy; `GET /users/me/receipts` on the gateway; k6 checks every completed ride gets its receipt.

## Next up

1. Boot the stack for the first time, fix what it shows, and run k6 end to end.
2. Grafana dashboards and Alertmanager.
3. Route rides and riders through the gateway, with identity from the JWT and role checks.
4. Accept / decline with a timeout, then **forward dispatch**: offer the next ride to a busy driver whose current ride ends near the pickup.
5. No-driver path (retry with a wider radius, then `ride.matching.failed`), ride state machine, server-side fares.
6. Payment service with Stripe test mode.
7. Unit and e2e tests, CI.

See [`project-analysis.html`](project-analysis.html) for the full list with priorities.
