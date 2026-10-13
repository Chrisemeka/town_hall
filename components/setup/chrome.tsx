// The setup chain's card. — Design.md §5.2 in the semantic spelling.
//
// Its own module rather than part of SetupShell because the shell reads
// cookies(): importing it from a Client Component drags next/headers into the
// browser bundle and the build stops. The shell is the server half; this is
// presentational and safe on either side of the boundary.
//
// The field chrome that used to live here is gone — components/ui/Field is
// the one spelling now that there is one token system.

/**
 * The card every step sits in. Design.md §5.3 measurements. Below 600px it
 * has no chrome and the content sits on the surface, as AuthCard does: the
 * frame cost 64px of a 360px screen.
 */
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
    <div className="medium:rounded-[16px] medium:border medium:border-line medium:bg-surface-raised medium:p-10">
      <h1 className="font-syne font-bold text-[28px] leading-9 tracking-[-0.5px] text-ink">
        {title}
      </h1>
      {subhead && (
        <p className="font-sans text-[16px] leading-6 text-ink lg:text-[14px] mt-2">{subhead}</p>
      )}
      <div className="mt-6 medium:mt-8">{children}</div>
    </div>
  )
}
