/**
 * Where each guide highlight sits, as percentages of its frame.
 *
 * **Generated. Do not edit by hand** — `python scripts/measure-guide-hotspots.py`
 * rewrites this whole file from the running app, and anything typed in here is lost on
 * the next run.
 *
 * The split is the point: this file is *geometry*, `steps.ts` is *words*. Each step names
 * what it points at once, as a DOM expression in the measuring script, and that one
 * definition is measured against both the 1280x800 and the 390x844 layouts — because the
 * same control is in a different place in each, and eyeballing it twice is guessing twice.
 * A re-capture can therefore move every ring in the product without touching a sentence.
 *
 * A key with no entry yields no highlight, which is the honest failure: a frame with no
 * ring still teaches, and a ring in the wrong place lies.
 *
 * Keys are the frame's path under `public/guide/`, without the extension.
 */
export type HotspotBox = { x: number; y: number; w: number; h: number };

export const HOTSPOTS: Record<string, HotspotBox> = {
  "customer/01-discover": { x: 1.1, y: 16.3, w: 32.2, h: 7.6 },
  "customer/02-salon": { x: 1.1, y: 82.8, w: 29.2, h: 8.1 },
  "customer/03-services": { x: 1.1, y: 15.2, w: 7.5, h: 4.5 },
  "customer/04-book-service": { x: 7.3, y: 11.8, w: 85.4, h: 4.8 },
  "customer/05-book-professional": { x: 2.6, y: 23.1, w: 61, h: 11.6 },
  "customer/06-book-time": { x: 2.6, y: 38.6, w: 61, h: 14.4 },
  "customer/07-book-confirm": { x: 66.5, y: 64, w: 28.9, h: 3.7 },
  "customer/08-bookings": { x: 7, y: 18.4, w: 36.6, h: 7.6 },
  "customer/09-booking-detail": { x: 24, y: 91.7, w: 26.9, h: 4.3 },
  "customer/10-queue-join": { x: 32.7, y: 24.1, w: 14.3, h: 4 },
  "customer/11-map": { x: 42.6, y: 9.8, w: 41.3, h: 7.6 },
  "customer/12-shop": { x: 1.5, y: 24.4, w: 59.2, h: 10 },
  "customer/13-rewards": { x: 23, y: 18.4, w: 54.1, h: 14.1 },
  "customer/14-messages": { x: 23, y: 18.4, w: 54.1, h: 12.5 },
  "customer/15-notifications": { x: 23, y: 19.8, w: 32.9, h: 7 },
  "customer/phone/01-discover": { x: 3.3, y: 15.4, w: 79, h: 7.3 },
  "customer/phone/02-salon": { x: 3.3, y: 70.8, w: 92.3, h: 7.8 },
  "customer/phone/03-services": { x: 3.3, y: 14.4, w: 20.8, h: 4.4 },
  "customer/phone/04-book-service": { x: 18.7, y: 11.2, w: 62.6, h: 8.1 },
  "customer/phone/05-book-professional": { x: 3.3, y: 29.7, w: 93.4, h: 11.1 },
  "customer/phone/06-book-time": { x: 3.3, y: 44.4, w: 93.4, h: 13.8 },
  "customer/phone/07-book-confirm": { x: 3.3, y: 88.7, w: 93.4, h: 3.6 },
  "customer/phone/08-bookings": { x: 3.3, y: 17.4, w: 93.4, h: 7.3 },
  "customer/phone/09-booking-detail": { x: 6.6, y: 79.7, w: 62.5, h: 6.7 },
  "customer/phone/10-queue-join": { x: 14.8, y: 22.8, w: 43.3, h: 3.8 },
  "customer/phone/11-map": { x: 12.5, y: 9.3, w: 80.1, h: 7.3 },
  "customer/phone/12-shop": { x: 4.6, y: 25.7, w: 67, h: 9.6 },
  "customer/phone/13-rewards": { x: 3.3, y: 17.4, w: 93.4, h: 13.5 },
  "customer/phone/14-messages": { x: 3.3, y: 17.4, w: 93.4, h: 11.9 },
  "customer/phone/15-notifications": { x: 3.3, y: 18.7, w: 96.7, h: 6.8 },
  "owner/01-calendar": { x: 7, y: 30.6, w: 76.4, h: 7.6 },
  "owner/02-booking-detail": { x: 7, y: 22.6, w: 86, h: 7.6 },
  "owner/03-queue-board": { x: 49.6, y: 40.8, w: 43.4, h: 7.6 },
  "owner/04-walk-in": { x: 23, y: 41.7, w: 53.9, h: 7.6 },
  "owner/05-insights": { x: 7, y: 31.3, w: 86, h: 11.1 },
  "owner/06-insights-charts": { x: 7, y: 15.1, w: 28.9, h: 6.5 },
  "owner/07-services": { x: 7, y: 22.6, w: 7.5, h: 4.5 },
  "owner/08-staff": { x: 7, y: 40.2, w: 43.3, h: 10.4 },
  "owner/09-hours": { x: 25.1, y: 56.9, w: 25.9, h: 7.1 },
  "owner/10-settings": { x: 7, y: 32.2, w: 43.3, h: 14 },
  "owner/11-salon-details": { x: 23, y: 25.9, w: 10.2, h: 4.5 },
  "owner/12-orders": { x: 17.6, y: 28.4, w: 64.7, h: 6.1 },
  "owner/13-clients": { x: 17.5, y: 22.6, w: 65, h: 8.4 },
  "owner/14-loyalty": { x: 23, y: 32.2, w: 54.1, h: 11.4 },
  "owner/15-messages": { x: 23, y: 22.6, w: 54.1, h: 11.1 },
  "owner/16-plans": { x: 23, y: 22.6, w: 54.1, h: 11.1 },
  "owner/phone/01-calendar": { x: 3.3, y: 30.1, w: 93.4, h: 7.3 },
  "owner/phone/02-booking-detail": { x: 3.3, y: 21.4, w: 93.4, h: 8.4 },
  "owner/phone/03-queue-board": { x: 50.4, y: 38.6, w: 46.3, h: 7.3 },
  "owner/phone/04-walk-in": { x: 3.6, y: 39.5, w: 92.9, h: 7.3 },
  "owner/phone/05-insights": { x: 3.3, y: 29.6, w: 93.4, h: 10.6 },
  "owner/phone/06-insights-charts": { x: 3.3, y: 14.2, w: 91.3, h: 6.2 },
  "owner/phone/07-services": { x: 3.3, y: 21.4, w: 20.8, h: 4.4 },
  "owner/phone/08-staff": { x: 3.3, y: 43.2, w: 93.4, h: 9.9 },
  "owner/phone/09-hours": { x: 10.5, y: 59.1, w: 41, h: 6.8 },
  "owner/phone/10-settings": { x: 3.3, y: 33.1, w: 93.4, h: 16 },
  "owner/phone/11-salon-details": { x: 3.3, y: 24.5, w: 29.7, h: 4.4 },
  "owner/phone/12-orders": { x: 3.8, y: 26.9, w: 92.4, h: 5.9 },
  "owner/phone/13-clients": { x: 3.3, y: 21.4, w: 93.4, h: 10.6 },
  "owner/phone/14-loyalty": { x: 3.3, y: 33.1, w: 93.4, h: 10.8 },
  "owner/phone/15-messages": { x: 3.3, y: 21.4, w: 93.4, h: 13.2 },
  "owner/phone/16-plans": { x: 3.3, y: 21.4, w: 93.4, h: 13.2 },
};
