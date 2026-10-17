/**
 * lucide's `Menu`, drawn as three separately addressable bars, so the sheet's
 * close button can morph them into an X (`.th-bar-*` in app/globals.css).
 *
 * The bar's trigger renders this too, at rest: the trigger and the close
 * button's resting frame are the same markup, which is what makes the hand-off
 * seamless when the sheet finishes closing. The geometry is lucide-react 1.x's
 * — `__tests__/menuMorphIcon.test.ts` fails if lucide's ever changes.
 */
export function MenuMorphIcon({ size = 20 }: { size?: number }) {
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
    >
      <path className="th-bar th-bar-top" d="M4 5h16" />
      <path className="th-bar th-bar-mid" d="M4 12h16" />
      <path className="th-bar th-bar-bot" d="M4 19h16" />
    </svg>
  )
}
