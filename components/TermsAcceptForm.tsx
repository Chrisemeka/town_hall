"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acceptTerms } from "@/actions/onboarding";

export function TermsAcceptForm() {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        await acceptTerms();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">

      <label className="flex items-start gap-3 cursor-pointer select-none group">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-voltage shrink-0 cursor-pointer"
          aria-describedby="terms-agreement-text"
        />
        <span id="terms-agreement-text" className="font-mono text-[14px] leading-6 text-midnight/70 group-hover:text-midnight transition-colors duration-150">
          I agree to Townhall's{" "}
          <Link href="/terms" target="_blank" className="text-forest hover:underline">
            Terms of Service
          </Link>
          {" "}and{" "}
          <Link href="/guidelines" target="_blank" className="text-forest hover:underline">
            Guidelines
          </Link>
          .
        </span>
      </label>

      {error && (
        <p className="font-mono text-[13px] text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!agreed || isPending}
        className="h-11 px-5 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:bg-midnight/10 disabled:text-midnight/40 disabled:cursor-not-allowed cursor-pointer"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>

    </form>
  );
}
