import { photoOf } from "./guide/photos";
import type { SiteId } from "./guide/sites";
import type { RoomType } from "./rooms";
import type { Venue } from "./source";
import { STOCK_CREDITS } from "./stock/credits";

/**
 * The pictures for a place on Rafeeq.
 *
 * A place's own photos (links staff entered) always come first. A place with
 * none gets EXAMPLE photos chosen to fit it: its kind of food, its hotel's
 * level, a photo of each room type, and for an attraction the guide's own
 * photo of the site. Example photos are generic (Wikimedia Commons, credited)
 * and the page labels them as examples, never as the place itself.
 */

const FILES = import.meta.glob<string>("./stock/*.jpg", { eager: true, query: "?url", import: "default" });
const stock = (key: string): string | null => FILES[`./stock/${key}.jpg`] ?? null;

export interface Picture {
  src: string;
  /** a generic example, not the place itself */
  example: boolean;
  credit?: { author: string; license: string; url: string };
}

const pic = (key: string): Picture | null => {
  const src = stock(key);
  return src ? { src, example: true, credit: STOCK_CREDITS[key] } : null;
};

/** The dish that best shows a restaurant's food. */
export function foodKey(v: Pick<Venue, "cuisine" | "price_level">): string {
  const c = (v.cuisine ?? "").toLowerCase();
  if (c.includes("saudi")) return "food_kabsa";
  if (c.includes("yemen") || c.includes("mandi")) return "food_mandi";
  if (c.includes("pakistani and indian") || c.includes("biryani")) return "food_biryani";
  if (c.includes("pakistan")) return "food_karahi";
  if (c.includes("indian")) return "food_indian";
  if (c.includes("turk")) return "food_turkish";
  if (c.includes("indones") || c.includes("malay")) return "food_indonesian";
  if (c.includes("egypt")) return "food_koshary";
  if (c.includes("café") || c.includes("cafe") || c.includes("coffee")) return "food_cafe";
  if (c.includes("grill") || c.includes("arab") || c.includes("leban")) return "food_grill";
  if ((v.price_level ?? 0) >= 4) return "food_fine";
  if (c.includes("international")) return "food_buffet";
  return "food_kabsa";
}

const ROOM_KEY: Record<RoomType, string> = {
  single: "room_single",
  double: "room_double",
  twin: "room_twin",
  triple: "room_triple",
  quad: "room_quad",
  family: "room_quad",
  suite: "room_suite",
};

export const roomPicture = (t: RoomType): Picture | null => pic(ROOM_KEY[t]);

/** Every picture for the place's gallery, the main one first. */
export function picturesOf(v: Venue): Picture[] {
  if (v.photos?.length) return v.photos.map((src) => ({ src, example: false }));
  const out: (Picture | null)[] = [];
  if (v.kind === "restaurant") {
    out.push(pic(foodKey(v)));
    if ((v.price_level ?? 0) >= 3) out.push(pic("food_fine"));
    out.push(pic("food_cafe"));
  } else if (v.kind === "hotel") {
    const luxury = (v.stars ?? 0) >= 4;
    out.push(pic(luxury ? "hotel_lobby_luxury" : "hotel_lobby_simple"));
    const rooms = v.room_types?.length ? v.room_types : (["double", "twin", "triple"] as RoomType[]);
    for (const t of rooms) out.push(roomPicture(t));
    if (!luxury) out.push(pic("room_simple"));
    if (v.accessibility?.includes("roll_in_shower") || v.accessibility?.includes("grab_bars")) out.push(pic("bath_accessible"));
    out.push(pic("food_buffet"));
  } else if (v.site_id) {
    const src = photoOf(v.site_id as SiteId);
    if (src) out.push({ src, example: false });
  }
  /* no picture twice */
  const seen = new Set<string>();
  return out.filter((p): p is Picture => !!p && !seen.has(p.src) && !!seen.add(p.src));
}
