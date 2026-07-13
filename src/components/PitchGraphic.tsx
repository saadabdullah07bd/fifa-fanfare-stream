/**
 * A broadcast-style football pitch rendered in pure SVG: mowed-stripe turf
 * texture, touchlines, center circle, and both penalty boxes. Viewed
 * portrait (attacking axis running top-to-bottom) so two lineups can be
 * shown facing each other, same convention as TV lineup graphics.
 */
export default function PitchGraphic() {
  const stripes = Array.from({ length: 10 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <rect width="100" height="150" fill="#0d3b1e" />
      {stripes.map((i) => (
        <rect
          key={i}
          x="0"
          y={i * 15}
          width="100"
          height="15"
          fill="#ffffff"
          opacity={i % 2 === 0 ? 0.045 : 0}
        />
      ))}
      <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.4" fill="none">
        <rect x="3" y="3" width="94" height="144" />
        <line x1="3" y1="75" x2="97" y2="75" />
        <circle cx="50" cy="75" r="10" />
        <circle cx="50" cy="75" r="0.6" fill="rgba(255,255,255,0.55)" />
        {/* Top penalty box (away goal) */}
        <rect x="27" y="3" width="46" height="16" />
        <rect x="38" y="3" width="24" height="6" />
        <path d="M 40 19 A 10 10 0 0 0 60 19" />
        {/* Bottom penalty box (home goal) */}
        <rect x="27" y="131" width="46" height="16" />
        <rect x="38" y="141" width="24" height="6" />
        <path d="M 40 131 A 10 10 0 0 1 60 131" />
      </g>
    </svg>
  );
}
