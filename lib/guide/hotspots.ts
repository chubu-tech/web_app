/**
 * Where each guide highlight sits, as percentages of its frame.
 *
 * **Generated. Do not edit by hand** — `python scripts/import-app-frames.py`
 * rewrites this whole file from the captures in `../tho/docs/screenshots/`, and
 * anything typed in here is lost on the next run. To add a ring the capture
 * harness never measured, put it in `hotspots.manual.json` instead; a measured
 * rect always wins over a manual one, so a later capture retires it quietly.
 *
 * The split from `steps.ts` is the point: this file is *geometry*, that one is
 * *words*. A re-capture can move every ring without touching a sentence.
 *
 * Keys are the frame's path under `public/guide/app/`, without the extension.
 * A key with no entry yields no highlight — a frame with no ring still teaches,
 * and a ring in the wrong place lies.
 */
export type HotspotBox = { x: number; y: number; w: number; h: number };

export const HOTSPOTS: Record<string, HotspotBox> = {
  "auth/01-onboarding": { x: 80.6, y: 3.5, w: 15.6, h: 5.3 },
  "auth/02-sign-in": { x: 30.4, y: 70.1, w: 44.2, h: 1.9 },
  "auth/03-create-account": { x: 66.2, y: 67.3, w: 15.2, h: 2 },
  "auth/05-guest-wall": { x: 37.5, y: 85.9, w: 24.9, h: 1.9 },
  "customer/06-discover": { x: 72.8, y: 10.7, w: 10.7, h: 4.8 },
  "customer/07-discover-search": { x: 14.6, y: 18.4, w: 66.9, h: 5.8 },
  "customer/08-filters": { x: 64.8, y: 91.8, w: 9.8, h: 2 },
  "customer/09-discover-products": { x: 72.8, y: 10.7, w: 10.7, h: 4.8 },
  "customer/12-product-detail": { x: 39.8, y: 92.1, w: 20.3, h: 1.9 },
  "customer/13-salon-detail": { x: 34.9, y: 92.1, w: 30.1, h: 1.9 },
  "customer/13a-join-queue": { x: 41, y: 0, w: 18, h: 1.9 },
  "customer/14-salon-services": { x: 3.9, y: 43.7, w: 12.6, h: 1.6 },
  "customer/15-salon-specialists": { x: 3.9, y: 25.9, w: 44.7, h: 24.5 },
  "customer/18-salon-shop": { x: 58.8, y: 25.5, w: 7.4, h: 1.6 },
  "customer/20-book-services": { x: 40.2, y: 92.1, w: 19.7, h: 1.9 },
  "customer/22-book-time": { x: 33, y: 92.1, w: 34, h: 1.9 },
  "customer/22b-book-confirm": { x: 36.4, y: 92.1, w: 27.2, h: 1.9 },
  "customer/22c-booking-confirmed": { x: 39, y: 85.9, w: 22.1, h: 1.9 },
  "customer/25-chat-thread": { x: 1.9, y: 90.7, w: 82.5, h: 5.8 },
  "customer/26-bookings-upcoming": { x: 3.9, y: 17.9, w: 92.2, h: 30.8 },
  "customer/30-drawer": { x: 13.6, y: 14.4, w: 54.4, h: 2 },
  "customer/31-profile": { x: 41.1, y: 39.8, w: 17.9, h: 1.9 },
  "customer/33-settings": { x: 17.7, y: 56.7, w: 72.3, h: 2 },
  "customer/36-notifications": { x: 73.2, y: 5.1, w: 19, h: 1.6 },
  "owner/37-insights-basic": { x: 3.9, y: 74.4, w: 92.2, h: 2.2 },
  "owner/38-calendar-day-basic": { x: 43.3, y: 18, w: 8.1, h: 1.6 },
  "owner/41-queue-locked": { x: 40.7, y: 60, w: 18.5, h: 1.9 },
  "owner/43-salon-settings-basic": { x: 17.7, y: 32.3, w: 64.5, h: 2 },
  "owner/44-drawer-basic": { x: 13.6, y: 34.5, w: 54.4, h: 2 },
  "owner/45-services-basic": { x: 31.2, y: 17.4, w: 41.9, h: 1.9 },
  "owner/46-staff-basic": { x: 76.1, y: 91.6, w: 15.1, h: 2 },
  "owner/47-staff-edit-basic": { x: 3.9, y: 40, w: 73.8, h: 2 },
  "owner/51-insights": { x: 3.9, y: 23, w: 92.2, h: 19.1 },
  "owner/51-offers-basic": { x: 75.1, y: 91.6, w: 16.2, h: 2 },
  "owner/52-calendar-day": { x: 3.9, y: 52.8, w: 92.2, h: 19.1 },
  "owner/53-calendar-week": { x: 3.9, y: 16.6, w: 92.2, h: 4.4 },
  "owner/55-booking-detail": { x: 76, y: 12.2, w: 20.1, h: 2.3 },
  "owner/55-plans-basic": { x: 10.2, y: 49.8, w: 22.1, h: 1.4 },
  "owner/56-queue-board": { x: 31.6, y: 53, w: 36.7, h: 1.9 },
  "owner/57-queue-qr": { x: 44.6, y: 89.2, w: 15.1, h: 1.9 },
  "owner/59-salon-settings": { x: 17.7, y: 32.3, w: 64.5, h: 2 },
  "owner/60-packs": { x: 75.6, y: 91.6, w: 15.6, h: 2 },
  "owner/61-drawer": { x: 13.6, y: 32.8, w: 54.4, h: 2 },
  "owner/62-services": { x: 31.2, y: 17.4, w: 41.9, h: 1.9 },
  "owner/63-products": { x: 34.1, y: 92.5, w: 20.2, h: 1.9 },
  "owner/64-staff": { x: 76.1, y: 91.6, w: 15.1, h: 2 },
  "owner/65-staff-edit": { x: 3.9, y: 40, w: 73.8, h: 2 },
  "owner/67-client-book": { x: 3.9, y: 10.5, w: 92.2, h: 5.8 },
  "owner/70-offers": { x: 75.1, y: 91.6, w: 16.2, h: 2 },
  "owner/71-loyalty": { x: 72.2, y: 91.6, w: 19, h: 2 },
  "owner/72-redemptions": { x: 78.1, y: 12.5, w: 13.1, h: 1.9 },
  "owner/75-plans": { x: 10.2, y: 45.6, w: 22.1, h: 1.4 },
};
