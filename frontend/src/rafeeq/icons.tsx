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

/** Visit the sites: a folded map with a pin. */
export const MapIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" fill="currentColor" opacity="0.9" />
    <path d="M11 5v19M21 8v19" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" />
    <path d="M21 9.5a3.6 3.6 0 0 0-3.6 3.6c0 2.7 3.6 6.4 3.6 6.4s3.6-3.7 3.6-6.4A3.6 3.6 0 0 0 21 9.5z" fill="#e8a33a" />
    <circle cx="21" cy="13.1" r="1.3" fill="#fff" />
  </svg>
);

/** Food and hotels: a bed, and a fork and knife beside it. */
export const BedIcon = () => (
  <svg viewBox="0 0 44 32" aria-hidden="true" style={{ width: 44 }}>
    <path d="M2 25V9h3v9h8v-5h9a4.5 4.5 0 0 1 4.5 4.5V25h-3v-3H5v3z" fill="currentColor" opacity="0.95" />
    <circle cx="9" cy="14.5" r="2.5" fill="#ffd27a" />
    <path d="M32 5v8.5a2.4 2.4 0 0 0 1.6 2.3V27h2.2V15.8a2.4 2.4 0 0 0 1.6-2.3V5h-1.4v7h-.8V5h-1.4v7h-.8V5z" fill="#ffd27a" />
    <path d="M41.5 5c-2 0-3 3-3 7s1.4 4.5 1.9 4.6V27h2.2V5z" fill="#ffd27a" />
  </svg>
);

/**
 * An ambulance, with the Saudi ambulance number on its side. No emblem: the
 * red crescent on white is protected (Geneva Conventions) and is for the
 * Saudi Red Crescent Authority's own use.
 */
export const AmbulanceIcon = () => (
  <svg viewBox="0 0 96 58" aria-hidden="true">
    {/* light bar */}
    <rect x="22" y="3" width="10" height="6" rx="2" fill="#4fc3f7" />
    <rect x="33" y="3" width="10" height="6" rx="2" fill="#ff8a80" />
    {/* body and cab */}
    <path d="M6 12h58v34H6a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" fill="#fff" stroke="#9e2a22" strokeWidth="1.6" />
    <path d="M64 20h14l11 13v10a3 3 0 0 1-3 3H64z" fill="#fff" stroke="#9e2a22" strokeWidth="1.6" />
    <path d="M67 23h10l8 10H67z" fill="#bfe6ff" />
    {/* stripe and number */}
    <rect x="3" y="34" width="86" height="5" fill="#d32f2f" />
    <text x="33" y="29" textAnchor="middle" fontSize="13" fontWeight="800" fill="#d32f2f" fontFamily="system-ui, sans-serif">
      997
    </text>
    {/* wheels */}
    <circle cx="20" cy="47" r="7" fill="#263238" />
    <circle cx="20" cy="47" r="3" fill="#cfd8dc" />
    <circle cx="74" cy="47" r="7" fill="#263238" />
    <circle cx="74" cy="47" r="3" fill="#cfd8dc" />
  </svg>
);

/** Medical help: a white crescent with a heartbeat in its open side (not the protected red-crescent emblem). */
export const MedicalCrescentIcon = () => (
  <svg viewBox="0 0 36 32" aria-hidden="true">
    <mask id="rq-crescent-cut">
      <rect width="36" height="32" fill="#fff" />
      <circle cx="19.5" cy="13.5" r="10.5" fill="#000" />
    </mask>
    <circle cx="13" cy="16" r="12.5" fill="currentColor" mask="url(#rq-crescent-cut)" />
    <path d="M14 17.5h4l2.2-5 3.2 9 2.6-6 1.6 2H35" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
