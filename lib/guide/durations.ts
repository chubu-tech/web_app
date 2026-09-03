/**
 * How long each narrated line actually takes, in seconds.
 *
 * **Generated. Do not edit by hand** — `python scripts/voice-guide.py` rewrites this
 * whole file from the audio in `public/guide/voice/`.
 *
 * `guides.ts` stamps these onto their steps as `seconds`, which `stepHold` prefers over
 * `estimateSpeechSeconds`. Every step therefore holds for as long as its sentence really
 * takes rather than as long as 165 words a minute predicted it would.
 *
 * Keyed by the frame alone: every frame is unique across both guides, which
 * `guides.test.ts` asserts, so a step can move between chapters without its timing
 * following the wrong screen.
 *
 * Spoken by: edge / en-GB-RyanNeural.
 */
export const VOICE_SECONDS: Record<string, number> = {
  "auth/01-onboarding": 8.757,
  "auth/02-sign-in": 11.323,
  "auth/03-create-account": 8.932,
  "auth/05-guest-wall": 7.189,
  "customer/06-discover": 12.131,
  "customer/07-discover-search": 4.17,
  "customer/08-filters": 10.11,
  "customer/09-discover-products": 7.632,
  "customer/11-my-orders": 4.349,
  "customer/12-product-detail": 5.001,
  "customer/13-salon-detail": 11.856,
  "customer/13a-join-queue": 12.533,
  "customer/14-salon-services": 12.04,
  "customer/15-salon-specialists": 8.163,
  "customer/18-salon-shop": 7.127,
  "customer/20-book-services": 9.719,
  "customer/22-book-time": 9.405,
  "customer/22b-book-confirm": 9.591,
  "customer/22c-booking-confirmed": 7.696,
  "customer/23-map": 6.354,
  "customer/24-chats": 3.494,
  "customer/25-chat-thread": 6.451,
  "customer/26-bookings-upcoming": 10.616,
  "customer/27-bookings-completed": 5.518,
  "customer/30-drawer": 6.396,
  "customer/31-profile": 8.082,
  "customer/32-my-rewards": 3.675,
  "customer/33-settings": 9.058,
  "customer/35-saved-salons": 4.274,
  "customer/36-notifications": 7.651,
  "owner/37-insights-basic": 7.047,
  "owner/39-calendar-week-locked": 5.633,
  "owner/41-queue-locked": 6.807,
  "owner/51-insights": 11.043,
  "owner/51-offers-basic": 9.185,
  "owner/52-calendar-day": 9.633,
  "owner/53-calendar-week": 5.362,
  "owner/54-calendar-list": 4.937,
  "owner/55-booking-detail": 7.562,
  "owner/56-queue-board": 8.93,
  "owner/57-queue-qr": 8.239,
  "owner/58-messages": 2.868,
  "owner/59-salon-settings": 9.934,
  "owner/60-packs": 8.072,
  "owner/61-drawer": 9.506,
  "owner/62-services": 10.702,
  "owner/63-products": 6.452,
  "owner/64-staff": 2.486,
  "owner/65-staff-edit": 8.921,
  "owner/66-walk-in": 7.477,
  "owner/67-client-book": 7.857,
  "owner/68-client-detail": 7.021,
  "owner/69-orders": 5.176,
  "owner/71-loyalty": 6.784,
  "owner/72-redemptions": 3.727,
  "owner/73-payroll": 5.779,
  "owner/74-tax-estimate": 10.034,
  "owner/75-plans": 14.982,
};
