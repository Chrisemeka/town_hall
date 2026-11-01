/** "9+" above nine; null at zero, which shows nothing. Pure, so it is tested. */
export function badgeText(count: number | undefined): string | null {
  if (!count || count < 1) return null
  return count > 9 ? "9+" : String(count)
}

/**
 * The count beside a nav link. A palette fill, never Voltage: Voltage is the
 * one CTA per viewport and a badge is not a CTA. The number is the text, so
 * colour never carries it alone, and the sr-only line says what it counts.
 *
 * `corner` pins it to an icon's top-right, for the bottom bar, where it stays
 * off the 9-character label.
 */
export function NavBadge({ count, corner = false }: { count: number | undefined; corner?: boolean }) {
  const text = badgeText(count)
  if (!text) return null
  return (
    <span
      className={[
        "inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-sky text-obsidian font-mono text-[12px] leading-4 font-medium shrink-0",
        corner ? "absolute -top-1 -right-1" : "ml-auto",
      ].join(" ")}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{count} new test case{count === 1 ? "" : "s"}</span>
    </span>
  )
}
