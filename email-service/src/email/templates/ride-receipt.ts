export type RideReceipt = {
  riderName: string;
  rideId: string;
  fare: number | null;
  pickup: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  requestedAt: Date | null;
  completedAt: Date;
};

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (fare: number | null) => (fare == null ? '-' : `€${fare.toFixed(2)}`);
const point = (p: { lat: number; lng: number } | null) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '-');
const time = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-');

function minutes(from: Date | null, to: Date): string {
  if (!from) return '-';
  return `${Math.max(1, Math.round((to.getTime() - from.getTime()) / 60000))} min`;
}

export function rideReceiptSubject(r: RideReceipt): string {
  return `Your fake-bolt ride receipt: ${money(r.fare)}`;
}

export function rideReceiptText(r: RideReceipt): string {
  return [
    `Hi ${r.riderName},`,
    '',
    'Thanks for riding with fake-bolt. Here is your receipt.',
    '',
    `Total:       ${money(r.fare)}`,
    `From:        ${point(r.pickup)}`,
    `To:          ${point(r.destination)}`,
    `Requested:   ${time(r.requestedAt)}`,
    `Completed:   ${time(r.completedAt)}`,
    `Duration:    ${minutes(r.requestedAt, r.completedAt)}`,
    `Ride id:     ${r.rideId}`,
  ].join('\n');
}

export function rideReceiptHtml(r: RideReceipt): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#666">${label}</td><td style="padding:6px 12px">${escape(value)}</td></tr>`;
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f6f6f6;padding:24px">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:8px;padding:24px">
    <h2 style="margin:0 0 4px">Thanks for riding, ${escape(r.riderName)}</h2>
    <p style="color:#666;margin:0 0 16px">Here is your fake-bolt receipt.</p>
    <p style="font-size:28px;font-weight:bold;margin:0 0 16px">${escape(money(r.fare))}</p>
    <table style="border-collapse:collapse;width:100%">
      ${row('From', point(r.pickup))}
      ${row('To', point(r.destination))}
      ${row('Requested', time(r.requestedAt))}
      ${row('Completed', time(r.completedAt))}
      ${row('Duration', minutes(r.requestedAt, r.completedAt))}
      ${row('Ride id', r.rideId)}
    </table>
  </div>
</body></html>`;
}
