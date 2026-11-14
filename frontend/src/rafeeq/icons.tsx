/* Pictures for Rafeeq's big buttons: each says what the button does before a word is read. */

/** SOS: a siren with its light. */
export const SirenIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M9 22v-7a7 7 0 0 1 14 0v7" fill="currentColor" />
    <rect x="6" y="22" width="20" height="4.5" rx="1.5" fill="currentColor" />
    <path d="M16 3.5v3M5.2 8l2.2 2.1M26.8 8l-2.2 2.1M2.5 16h3M26.5 16h3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13.5 13.5a3 3 0 0 1 3-2.5" stroke="#b3261e" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

/** I am lost: a compass whose needle points the way. */
export const CompassIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <path d="M16 7.5l3.6 8.5H12.4z" fill="#b3261e" />
    <path d="M16 24.5l-3.6-8.5h7.2z" fill="currentColor" />
    <circle cx="16" cy="16" r="1.8" fill="#fff" />
  </svg>
);

/** Heat: the sun. */
export const SunIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="6.2" fill="#f9a825" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line
          key={i}
          x1={16 + Math.cos(a) * 9.4}
          y1={16 + Math.sin(a) * 9.4}
          x2={16 + Math.cos(a) * 13.4}
          y2={16 + Math.sin(a) * 13.4}
          stroke="#f57c00"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

/** Ask Rafeeq: a speech bubble with a spark. */
export const AskIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h13A4.5 4.5 0 0 1 27 8.5v9a4.5 4.5 0 0 1-4.5 4.5H14l-6 5v-5.2A4.5 4.5 0 0 1 5 17.5z" fill="currentColor" />
    <path d="M16 8.2l1.3 3.3 3.3 1.3-3.3 1.3L16 17.4l-1.3-3.3-3.3-1.3 3.3-1.3z" fill="#ffd27a" />
  </svg>
);
