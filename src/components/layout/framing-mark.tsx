export function FramingMark() {
  return (
    <svg
      viewBox="0 0 240 320"
      role="img"
      aria-label="Face alignment guide with a vertical center line"
      className="h-64 w-auto text-primary"
    >
      <rect x="8" y="8" width="224" height="304" rx="28" className="fill-card stroke-border" strokeWidth="2" />
      <ellipse cx="120" cy="150" rx="62" ry="82" className="fill-accent stroke-primary" strokeWidth="2" />
      <path d="M120 36 V284" className="stroke-primary" strokeWidth="1.5" strokeDasharray="4 6" />
      <path d="M48 150 H192" className="stroke-primary/70" strokeWidth="1.5" strokeDasharray="4 6" />
    </svg>
  );
}
