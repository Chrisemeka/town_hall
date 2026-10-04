// Shared type and control classes for the public pages.
//
// ponytail: class constants and two tiny components, not a component library.
// Six pages need the same page header, the same section heading and the same
// two button shapes; a seventh thing that needs a different shape should write
// its own classes rather than growing this file a variant prop.
//
// Everything here is semantic-token only (Design.md §4.1) — these render on
// public surfaces, which follow the theme.

/** Long-form prose. DM Sans, `ink` rather than `ink-muted`: ink-muted is 6.3:1
 *  on Bone and Design.md wants 7:1 for body text. */
export const P = "font-sans text-[16px] leading-8 text-ink"

/** Secondary prose — ledes, captions, the line under a heading. */
export const P_SMALL = "font-sans text-[14px] leading-7 text-ink"

/** Metadata and captions. Label tier (≥4.5:1), never a paragraph. */
export const META = "font-mono text-[12px] leading-5 text-ink-muted"

export const H2 =
  "font-syne font-bold text-[28px] leading-9 text-ink"

export const H3 = "font-syne font-bold text-[20px] leading-7 text-ink"

export const UL = "flex flex-col gap-3 list-disc pl-5 marker:text-accent-ink"

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

/** Voltage fill with Obsidian text — 17.3:1, and the one per viewport. */
export const BTN_PRIMARY =
  `inline-flex items-center justify-center h-11 px-6 rounded-[8px] bg-accent text-obsidian font-mono font-medium text-[14px] tracking-[0.2px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer ${FOCUS}`

export const BTN_SECONDARY =
  `inline-flex items-center justify-center h-11 px-6 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] tracking-[0.2px] hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer ${FOCUS}`

/** A link inside body copy. Underlined, because colour alone is not a signal. */
export const LINK_INLINE =
  `text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] ${FOCUS}`

export function PageHeader({
  title,
  lede,
}: {
  title: string
  lede?: string
}) {
  return (
    <div className="flex flex-col gap-4 mb-12">
      <h1 className="font-syne font-bold text-[40px] leading-[48px] lg:text-[56px] lg:leading-[60px] tracking-[-0.5px] text-ink">
        {title}
      </h1>
      {lede && <p className={`${P} max-w-2xl`}>{lede}</p>}
    </div>
  )
}

/** A numbered section in a guide. The number is a label, not a list marker —
 *  guides are read out of order and "3" is how someone refers to one. */
export function Section({
  number,
  title,
  children,
}: {
  number?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={H2}>
        {number && (
          <span className="font-mono text-[14px] text-accent-ink mr-3">
            {number}.
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  )
}
