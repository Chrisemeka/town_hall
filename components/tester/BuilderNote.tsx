/**
 * The builder's written review of a tester's report — the approval note (or a
 * legacy send-back). It is the only written feedback a tester gets on their own
 * work, so it is shown as a block of its own, never squeezed into a meta row.
 *
 * Always in full. Where space is short (the tester's feed) it goes in a dialog
 * rather than being cut — a writeup cut short is no writeup.
 */
export function BuilderNote({
  note,
  danger = false,
}: {
  note: string
  /** A legacy changes_requested note reads as a problem, not praise. */
  danger?: boolean
}) {
  return (
    <div className="border-l-2 border-ink-muted pl-3 text-left">
      <p className="font-mono text-[11px] uppercase tracking-[1px] text-ink-muted mb-1">
        Note from the builder
      </p>
      <p
        className={[
          "font-mono text-[13px] leading-5 whitespace-pre-wrap break-words",
          danger ? "text-danger-ink" : "text-ink",
        ].join(" ")}
      >
        {note}
      </p>
    </div>
  )
}
