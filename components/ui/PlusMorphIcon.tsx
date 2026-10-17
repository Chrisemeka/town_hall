/**
 * lucide's `Plus` as two separately addressable bars, so an accordion's
 * summary can morph it into an X when its <details> opens (`.th-plus-*` in
 * app/globals.css) — the same two beats as the sheets' hamburger: into one
 * line, then the line into an X. `__tests__/menuMorphIcon.test.ts` fails if
 * lucide's geometry ever changes.
 */
export function PlusMorphIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path className="th-plus th-plus-h" d="M5 12h14" />
      <path className="th-plus th-plus-v" d="M12 5v14" />
    </svg>
  )
}
