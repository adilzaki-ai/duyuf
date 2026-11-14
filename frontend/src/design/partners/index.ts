/**
 * Official logos for the cover, when the operator has permission to show them
 * (see README.md here). Found by file name; null when the file is not here.
 */
const FILES = import.meta.glob<string>("./*.{svg,png,webp,jpg}", { eager: true, query: "?url", import: "default" });

const find = (name: string): string | null => {
  const hit = Object.entries(FILES).find(([path]) => path.replace(/^\.\//, "").replace(/\.\w+$/, "") === name);
  return hit ? hit[1] : null;
};

export const VISION_2030_LOGO = find("vision2030");
export const MINISTRY_LOGO = find("mohu");
