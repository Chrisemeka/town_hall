/**
 * M3 filter chip: drawn at 32px, tappable over 48px through the ::after.
 * Neighbours keep gap-x-2 and wrapped rows gap-y-4, so no two hit areas
 * overlap. Pressed is shown by border, colour, tint and aria-pressed together,
 * never colour alone.
 */
export function FilterChip({
  pressed,
  onClick,
  count,
  children,
}: {
  pressed: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "relative h-8 px-3 rounded-[8px] border font-mono text-[12px] font-medium transition-colors duration-150 cursor-pointer after:absolute after:inset-x-0 after:-inset-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        pressed
          ? "border-accent-ink text-accent-ink bg-accent-ink/[0.08]"
          : "border-ink-muted text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      {children}
      {count != null && <span className="ml-1.5">{count}</span>}
    </button>
  )
}
