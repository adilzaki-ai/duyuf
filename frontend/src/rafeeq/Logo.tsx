import { useId } from "react";
import r from "./rafeeq.module.css";

/**
 * Rafeeq's mark: a location pin (finding the way) holding a golden crescent
 * that embraces a small light (the companion, and the pilgrim it keeps close).
 * Drawn on a 64-unit grid; it reads at 16 px and at 160 px.
 */
export function RafeeqMark({ size = 40, title, x, y }: { size?: number; title?: string; x?: number; y?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      x={x}
      y={y}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={r.mark}
    >
      <defs>
        <linearGradient id={`${id}-pin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35cdd0" />
          <stop offset="1" stopColor="#086b76" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#e3962a" />
        </linearGradient>
        <mask id={`${id}-moon`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="37.2" cy="23.4" r="10.6" fill="#000" />
        </mask>
      </defs>
      <path
        d="M32 3.5C18.7 3.5 8.5 13.7 8.5 26.6 8.5 43.4 32 60.5 32 60.5S55.5 43.4 55.5 26.6C55.5 13.7 45.3 3.5 32 3.5Z"
        fill={`url(#${id}-pin)`}
      />
      <path d="M32 7.5c-11 0-19.5 8.4-19.5 19.1" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="27" r="13.2" fill={`url(#${id}-gold)`} mask={`url(#${id}-moon)`} />
      <circle cx="37.6" cy="23.6" r="3.9" fill="#fff7e8" />
    </svg>
  );
}

/** The mark with the name in both scripts. */
export function RafeeqLogo({ size = 40, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className={`${r.logo} ${light ? r.logoLight : ""}`}>
      <RafeeqMark size={size} />
      <span className={r.logoWords} dir="ltr">
        <span className={r.logoLatin}>Rafeeq</span>
        <span className={r.logoArabic} lang="ar">
          رفيق
        </span>
      </span>
    </span>
  );
}
