// Card and form chrome for the setup chain — Design.md §5.2 in the semantic spelling.
//
// Its own module rather than part of SetupShell because SkillsInput is a
// Client Component and the shell reads cookies(): importing the shell from a
// client file drags next/headers into the browser bundle and the build stops.
// The shell is the server half; everything here is presentational and safe
// on either side of the boundary.

/**
 * Design.md §5.2's form field in the semantic spelling.
 *
 * components/ui/Field is the same measurements in literal dark tokens and
 * would render a dark input inside a light page — the same wall the auth card
 * hit. Error wins over helper when both are present, as there.
 *
 * `htmlFor` has to equal the schema key the error arrives under: that is what
 * lets useFocusFirstError find the field and what ties aria-describedby to the
 * message. CLAUDE.md's SettingsForm note is the cautionary tale.
 */
export function SetupField({
  label,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string
  htmlFor: string
  error?: string[]
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]"
      >
        {label}
      </label>
      {children}
      {error?.length ? (
        <p id={`${htmlFor}-error`} className="font-mono text-[12px] text-danger-ink">
          {error[0]}
        </p>
      ) : helper ? (
        <p className="font-mono text-[12px] text-ink-muted leading-5">{helper}</p>
      ) : null}
    </div>
  )
}

/**
 * The §5.2 input box on a themed surface.
 *
 * `line` is 1.19:1 and fails WCAG 1.4.11's 3:1 for a control's visible
 * boundary, so the resting border is ink-muted. Error state is danger-ink,
 * because Ember is 2.97:1 on Bone.
 */
export function setupInputClass(hasError: boolean): string {
  return [
    "h-10 w-full rounded-[8px] border px-4 font-mono text-[14px] text-ink bg-surface placeholder:text-ink-muted focus:outline-none transition-colors duration-150",
    hasError ? "border-danger-ink" : "border-ink-muted focus:border-accent-ink",
  ].join(" ")
}

/**
 * The card every step sits in. Design.md §5.3 measurements in the semantic
 * spelling — components/ui/Card is the same thing in literal dark tokens and
 * would render a dark panel inside a light page.
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
