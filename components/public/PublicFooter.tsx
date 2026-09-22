import Link from "next/link";
import { signInWithGoogle } from "@/actions/auth";
import { Logo } from "@/components/Logo";

const LINK =
  "text-[13px] text-ink-muted hover:text-ink transition-colors duration-150 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * Four columns is the target shape. Three ship here, because the fourth
 * (Product: Pricing, About) has no page behind it until PR 2 — and a footer
 * link to a page that does not exist is the failure mode the brief names. The
 * Guides column holds the existing /guidelines until PR 2 replaces it with
 * /guides/builder and /guides/tester, and Contact is a mailto until /contact
 * exists.
 */
export function PublicFooter() {
  return (
    <footer className="bg-surface border-t border-line">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-16 pb-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="font-syne font-bold text-[20px] text-ink">
                Twnhall
              </span>
            </div>
            <p className="font-sans text-[14px] leading-6 text-ink">
              Ship with confidence. Test each other.
            </p>
            <p className="text-[13px] text-ink-muted">Made in Nigeria 🇳🇬</p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-medium text-[13px] text-ink mb-1">Guides</h2>
            <Link href="/guides/builder" className={LINK}>
              For builders
            </Link>
            <Link href="/guides/tester" className={LINK}>
              For testers
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-medium text-[13px] text-ink mb-1">
              Company &amp; legal
            </h2>
            <a href="mailto:twnhallhq@gmail.com" className={LINK}>
              Contact
            </a>
            <Link href="/privacy" className={LINK}>
              Privacy policy
            </Link>
            <Link href="/terms" className={LINK}>
              Terms of service
            </Link>
            <form action={signInWithGoogle}>
              <button type="submit" className={`${LINK} cursor-pointer`}>
                Sign in
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line">
          <span className="text-[12px] text-ink-muted">
            &copy; {new Date().getFullYear()} Twnhall. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
