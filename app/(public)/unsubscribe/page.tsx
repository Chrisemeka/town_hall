import type { Metadata } from "next"
import { PageHeader } from "@/components/public/prose"
import { UnsubscribeForm } from "@/components/public/UnsubscribeForm"
import { unsubscribeSchema } from "@/lib/validation/schemas"
import { verifyUnsubscribe } from "@/lib/unsubscribe"

export const metadata: Metadata = {
  title: "Unsubscribe — Twnhall",
  robots: { index: false },
}

/*
 * Where the daily digest's Unsubscribe link lands. It ASKS: a GET never
 * unsubscribes, because mail scanners and link previews open every link in
 * an email. The button posts unsubscribeFromEmail, which checks the token
 * again. Public and signed out, in any state of the setup chain
 * (isEmailGateExempt). A bad link gets one generic line — never whether the
 * account exists.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[]; t?: string | string[] }>
}) {
  const { a, t } = await searchParams
  const parsed = unsubscribeSchema.safeParse({ a, t })
  const valid = parsed.success && verifyUnsubscribe(parsed.data.a, parsed.data.t)

  return (
    <div className="flex-1 w-full max-w-[560px] mx-auto px-4 medium:px-6 pt-16 pb-10 medium:pt-20 medium:pb-16 lg:py-16">
      <PageHeader title="Stop the daily test case email?" />
      {valid ? (
        <UnsubscribeForm a={parsed.data.a} t={parsed.data.t} />
      ) : (
        <p className="font-sans text-[16px] leading-8 text-ink">
          This unsubscribe link isn&apos;t valid. You can turn the email off in Settings → Account.
        </p>
      )}
    </div>
  )
}
