import type { SiteId } from "./sites";
import { CREDITS } from "./credits";

/**
 * A photo of each site, from Wikimedia Commons under a free licence (public
 * domain, CC0, CC BY or CC BY-SA), resized for a phone. CC BY and BY-SA need
 * the author and licence shown with the photo: the site page does that from
 * credits.ts. Bundled, not linked, so they show on a weak signal and in the
 * client demo, which cannot load outside pictures.
 */
const FILES = import.meta.glob<string>("./photos/*.jpg", { eager: true, query: "?url", import: "default" });

export function photoOf(id: SiteId): string | null {
  return FILES[`./photos/${id}.jpg`] ?? null;
}

export { CREDITS };
