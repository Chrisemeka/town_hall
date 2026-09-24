import Link from "next/link"
import { signInWithGoogle } from "@/actions/auth"
import { Logo } from "@/components/Logo"
import { errorId } from "@/lib/focus"

/**
 * The chrome shared by /signup, /login, /forgot-password and /reset-password:
 * a centred card on the tinted public ground.
 *
 * Not `components/ui/Field` or `inputClass()` — those are the same chrome in
 * literal dark tokens (`bg-surface`, `text-ink`, `border-line`) and would
 * render a dark form inside a light page. Same Design.md §5.2 measurements,
 * semantic spelling. A third copy of these strings should not appear; if a
 * fifth auth surface needs them, it imports from here.
 */
export function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string
  lede?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex-1 w-full flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 mb-8 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Logo size={32} />
          <span className="font-syne font-bold text-[20px] text-ink">Twnhall</span>
        </Link>

        <div className="rounded-[16px] border border-line bg-surface-raised p-10">
          <h1 className="font-syne font-bold text-[28px] leading-9 text-ink mb-2">
            {title}
          </h1>
          {lede && (
            <p className="font-sans text-[14px] leading-6 text-ink mb-8">{lede}</p>
          )}
          {children}
        </div>

        {footer && (
          <p className="mt-6 text-center font-mono text-[13px] text-ink-muted">
            {footer}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Label, control, and one line of error or helper — Design.md §5.2.
 *
 * `name` is the schema key, and it is used for the control's `name`, its `id`
 * and the error's id. That is what lets useFocusFirstError find the field and
 * what lets aria-describedby point at the message. A mismatch here is invisible
 * to both — see the SettingsForm note in CLAUDE.md.
 */
export function AuthField({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  errors,
  helper,
}: {
  name: string
  label: string
  type?: string
  autoComplete?: string
  defaultValue?: string
  errors?: string[]
  helper?: string
}) {
  const hasError = !!errors?.length
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        // aria-invalid only when it is true: every unerrored input announcing
        // "valid" out loud is noise. Mirrors fieldErrorProps().
        {...(hasError
          ? { "aria-invalid": true as const, "aria-describedby": errorId(name) }
          : {})}
        className={[
          "h-10 w-full rounded-[8px] px-4 font-mono text-[14px] text-ink bg-surface placeholder:text-ink-muted focus:outline-none transition-colors duration-150 border",
          // `line` is 1.19:1 and fails WCAG 1.4.11's 3:1 for a control's visible
          // boundary, so a bounded control takes ink-muted. Design.md §4.1.
          hasError
            ? "border-danger-ink"
            : "border-ink-muted focus:border-accent-ink",
        ].join(" ")}
      />
      {hasError ? (
        <p id={errorId(name)} className="font-mono text-[12px] text-danger-ink">
          {errors[0]}
        </p>
      ) : helper ? (
        <p className="font-mono text-[12px] text-ink-muted leading-5">{helper}</p>
      ) : null}
    </div>
  )
}

/** A form-level message — the errors that belong to no single field. */
export function AuthBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      // Announced, not just coloured: this is often the only feedback a failed
      // sign-in gives, and it replaces content rather than adding to it.
      role="alert"
      className="mb-6 rounded-[8px] border border-danger-ink bg-danger-ink/[0.08] px-4 py-3 font-mono text-[13px] leading-5 text-danger-ink"
    >
      {message}
    </div>
  )
}

/** Google, then the divider. Both auth pages lead with it — it is how every
 *  existing user got here, so it goes above the email fields, not below. */
export function GoogleBlock({ label }: { label: string }) {
  return (
    <>
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="h-11 w-full inline-flex items-center justify-center rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {label}
        </button>
      </form>
      <div className="flex items-center gap-4 my-6" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[12px] text-ink-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  )
}

/**
 * The submit button.
 *
 * Never disabled to express "not finished yet" — CLAUDE.md is explicit, and
 * AuthCard's forms validate on click and name the outstanding field instead.
 *
 * `pending` is a different claim: the work is in flight, or a server-side
 * cooldown has not elapsed. The caller owns the label so it can say which —
 * "Working…" or "Resend in 41s" — because a disabled control that does not
 * explain itself is the failure mode the rule exists to prevent.
 */
export function AuthSubmit({
  children,
  pending,
}: {
  children: React.ReactNode
  /** In flight, or blocked by a server-side cooldown. Never "incomplete". */
  pending: boolean
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full inline-flex items-center justify-center rounded-[8px] bg-accent text-obsidian font-mono font-medium text-[14px] tracking-[0.2px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {children}
    </button>
  )
}

export const AUTH_LINK =
  "text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
