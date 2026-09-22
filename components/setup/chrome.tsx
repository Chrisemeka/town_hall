// The setup chain's card. — Design.md §5.2 in the semantic spelling.
//
// Its own module rather than part of SetupShell because the shell reads
// cookies(): importing it from a Client Component drags next/headers into the
// browser bundle and the build stops. The shell is the server half; this is
// presentational and safe on either side of the boundary.
//
// The field chrome that used to live here is gone — components/ui/Field is
// the one spelling now that there is one token system.

/** The card every step sits in. Design.md §5.3 measurements. */
export function SetupCard({
  title,
  subhead,
  children,
}: {
  title: string
  subhead?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[16px] border border-line bg-surface-raised p-6 sm:p-10">
      <h1 className="font-syne font-bold text-[28px] leading-9 tracking-[-0.5px] text-ink">
        {title}
      </h1>
      {subhead && (
        <p className="font-sans text-[14px] leading-6 text-ink mt-2">{subhead}</p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  )
}
