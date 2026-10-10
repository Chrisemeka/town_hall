"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { acceptTerms } from "@/actions/onboarding";

// redirect() throws a special "NEXT_REDIRECT" error that must propagate for the
// navigation to happen. It carries a `digest` starting with "NEXT_REDIRECT" —
// detecting it here lets us re-throw redirects while still surfacing real errors.
function isRedirectError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function TermsAcceptForm() {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const checkbox = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    // The button READS as inactive until the box is ticked, but it is not
    // `disabled`. CLAUDE.md forbids disabling a submit to mean "not finished":
    // a disabled control cannot be focused, announces nothing, and the message
    // written for it becomes unreachable — which is what happened here, where
    // the only way to learn what was wanted was to notice a greyed button.
    //
    // aria-disabled gives the affordance without the dead end. It looks
    // inactive and is announced as disabled, and pressing it still says what
    // is outstanding and moves focus there.
    if (!agreed) {
      setError("Tick the box above to continue.");
      checkbox.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await acceptTerms();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <label className="flex items-start gap-3 cursor-pointer select-none group">
        <input
          ref={checkbox}
          type="checkbox"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            if (e.target.checked) setError(null);
          }}
          className="mt-1 w-4 h-4 accent-accent shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          aria-describedby={error ? "terms-error" : "terms-agreement-text"}
          {...(error ? { "aria-invalid": true as const } : {})}
        />
        <span
          id="terms-agreement-text"
          className="font-sans text-[14px] leading-6 text-ink"
        >
          I agree to Twnhall&apos;s{" "}
          <Link
            href="/terms"
            // A new tab: someone mid-signup who navigates away loses their
            // place in the setup chain.
            target="_blank"
            rel="noopener"
            className="text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <p
          id="terms-error"
          role="alert"
          className="font-mono text-[12px] text-danger-ink"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        // `disabled` is reserved for work in flight — a different claim from
        // "you have not finished", and one the label makes explicit.
        disabled={isPending}
        aria-disabled={!agreed || undefined}
        className={[
          "h-11 px-5 self-start rounded-[8px] font-mono font-medium text-[14px] tracking-[0.2px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised disabled:opacity-60 disabled:cursor-wait",
          agreed
            ? "bg-accent text-obsidian hover:bg-voltage-dark cursor-pointer"
            // Outlined rather than a grey fill: ink-muted on a 10% ink tint is
            // 3.9:1 in dark mode, under Design.md's 4.5:1 for a label. On the
            // card itself it is 6.7:1 light and 5.1:1 dark, and an outline
            // against a solid Voltage button is a clearer inactive/active
            // distinction than two fills anyway.
            : "border border-line text-ink-muted cursor-not-allowed",
        ].join(" ")}
      >
        {isPending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
