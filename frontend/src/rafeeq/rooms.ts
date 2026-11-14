/**
 * Hotel room options, as the platform lists them in
 * backend/api/duyuf/bookings/flow.py (rooms.test.ts reads that file, so
 * change both). The English labels are keys: Rafeeq says them in six
 * languages, the staff app in English and Arabic.
 */
export const ROOM_TYPES = ["single", "double", "twin", "triple", "quad", "family", "suite"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const SLEEPS: Record<RoomType, number> = { single: 1, double: 2, twin: 2, triple: 3, quad: 4, family: 5, suite: 4 };

export const BEDS = ["single", "double", "queen", "king"] as const;
export type Bed = (typeof BEDS)[number];

export const ACCESS = [
  "wheelchair_room",
  "roll_in_shower",
  "grab_bars",
  "near_elevator",
  "low_floor",
  "wheelchair_loan",
  "carer_bed",
  "visual_aids",
  "hearing_aids",
] as const;
export type Access = (typeof ACCESS)[number];

export const EXTRAS = ["breakfast", "mosque_view", "extra_bed", "late_checkout", "airport_pickup"] as const;
export type Extra = (typeof EXTRAS)[number];

export const ROOM_LABEL: Record<RoomType, string> = {
  single: "Single room",
  double: "Double room",
  twin: "Twin room (2 beds)",
  triple: "Triple room",
  quad: "Quad room",
  family: "Family room",
  suite: "Suite",
};
export const BED_LABEL: Record<Bed, string> = { single: "Single bed", double: "Double bed", queen: "Queen bed", king: "King bed" };
export const ACCESS_LABEL: Record<Access, string> = {
  wheelchair_room: "Wheelchair-accessible room",
  roll_in_shower: "Roll-in shower (no step)",
  grab_bars: "Grab bars in the bathroom",
  near_elevator: "Close to the elevator",
  low_floor: "Low floor",
  wheelchair_loan: "Wheelchair to borrow",
  carer_bed: "Bed for a carer in the room",
  visual_aids: "Help for low vision",
  hearing_aids: "Help for hearing (light alarm)",
};
export const EXTRA_LABEL: Record<Extra, string> = {
  breakfast: "Breakfast",
  mosque_view: "View of the mosque",
  extra_bed: "Extra bed",
  late_checkout: "Late check-out",
  airport_pickup: "Airport pickup",
};

/** The bed-size question makes sense only where the beds can be one big bed. */
export const HAS_BED_CHOICE: readonly RoomType[] = ["double", "family", "suite"];

/** Every English label, for the words tests. */
export const ROOM_LINES = [...Object.values(ROOM_LABEL), ...Object.values(BED_LABEL), ...Object.values(ACCESS_LABEL), ...Object.values(EXTRA_LABEL)];
