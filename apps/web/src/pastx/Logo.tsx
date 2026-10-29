// PASTX brand mark — a "PX" monogram: the letter P beside an X formed by two
// crossing chart lines (a rising green line over a falling mint one). Kept in
// sync with /public/favicon.svg. Scales cleanly from favicon size up.
export function PastxMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="PASTX"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="40" height="40" rx="10" fill="#13241f" />
      <rect x="9" y="9" width="4.6" height="22" rx="2.3" fill="#ffffff" />
      <path d="M13.6 9h5.1a6.4 6.4 0 0 1 0 12.8h-5.1z" fill="#ffffff" />
      <path d="M22.2 11.5 33 29.5" fill="none" stroke="#7ae2bb" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
      <path d="M22.2 29.5 33 11.5" fill="none" stroke="#00a879" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}
