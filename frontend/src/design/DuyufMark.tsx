import { useId } from "react";

/**
 * Duyuf's mark. Duyuf means "guests" (the guests of God, Duyuf al-Rahman):
 * an open arched doorway of welcome, a golden crescent inside it, on a
 * turquoise tile. Drawn on a 64-unit grid; reads at 20 px and at 120 px.
 */
export function DuyufMark({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ec4c6" />
          <stop offset="1" stopColor="#075a63" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#e3962a" />
        </linearGradient>
        <mask id={`${id}-moon`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="35.5" cy="32" r="6.4" fill="#000" />
        </mask>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${id}-tile)`} />
      <path d="M8 10 Q 32 2 56 10" stroke="#ffffff" strokeOpacity=".16" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* the doorway: a pointed arch, open at the foot */}
      <path d="M19 51 V32 Q19 19 32 12 Q45 19 45 32 V51" stroke="#ffffff" strokeWidth="4.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 51 H50" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" />
      {/* the crescent, inside */}
      <circle cx="32" cy="34" r="8" fill={`url(#${id}-gold)`} mask={`url(#${id}-moon)`} />
    </svg>
  );
}
