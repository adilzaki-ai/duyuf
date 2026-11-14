import { t } from "../i18n";

/**
 * A booking's journey and who may move it where.
 *
 * The platform's table is backend/api/duyuf/bookings/flow.py; bookings.test.ts
 * reads it and fails if the two ever differ.
 */
export const BOOKING_STATUSES = ["requested", "awaiting_payment", "confirmed", "declined", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const VENUE_KINDS = ["hotel", "restaurant", "attraction"] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export type BookingAction = "confirm" | "ask_payment" | "decline" | "pay" | "cancel";

export const BOOKING_MOVES: Record<BookingAction, { from: readonly BookingStatus[]; to: BookingStatus }> = {
  confirm: { from: ["requested"], to: "confirmed" },
  ask_payment: { from: ["requested"], to: "awaiting_payment" },
  decline: { from: ["requested", "awaiting_payment"], to: "declined" },
  pay: { from: ["awaiting_payment"], to: "confirmed" },
  cancel: { from: ["requested", "awaiting_payment", "confirmed"], to: "cancelled" },
};

export const STAFF_ACTIONS = ["confirm", "ask_payment", "decline", "cancel"] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

export const staffActions = (s: BookingStatus) => STAFF_ACTIONS.filter((a) => BOOKING_MOVES[a].from.includes(s));

export function bookingRefusal(current: BookingStatus, action: BookingAction): string | null {
  return BOOKING_MOVES[action].from.includes(current) ? null : `cannot ${action.replace("_", " ")} a booking that is ${current.replace("_", " ")}`;
}

const STATUS_EN: Record<BookingStatus, string> = {
  requested: "Waiting for an answer",
  awaiting_payment: "Waiting for payment",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};
export const bookingStatusLabel = (s: BookingStatus) => t(STATUS_EN[s]);

const KIND_EN: Record<VenueKind, string> = { hotel: "Hotel", restaurant: "Restaurant", attraction: "Attraction" };
export const venueKindLabel = (k: VenueKind) => t(KIND_EN[k]);

const PRICE_EN = ["", "Simple", "Casual", "Fine dining", "Upscale"];
/** Every English line this file passes to t(), for the Arabic coverage test. */
export const BOOKING_LABELS_EN = [...Object.values(STATUS_EN), ...Object.values(KIND_EN), ...PRICE_EN.filter(Boolean)];

export const priceLabel = (n: number | null) => (n ? t(PRICE_EN[n]) : "—");
