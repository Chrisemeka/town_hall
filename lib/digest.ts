import "server-only"

// The daily digest of new test cases: who gets one, what it lists, and the
// claim that makes it exactly once per window. Sending is lib/mail.ts's
// sendTesterDigests(). Run by the daily cron (app/api/cron/daily) at 07:00 Lagos.

import { createAdminClient } from "@/lib/supabase/admin"
import { newMissionsFor, type NewMission } from "@/lib/newMissions"
import { unsubscribeLinks } from "@/lib/unsubscribe"
import { deviceTargetLabel, testCategoryLabel } from "@/lib/vocabulary"
import { sendTesterDigests, type DigestMessage } from "@/lib/mail"
import type { DigestItem } from "@/emails/tester-digest"

/** Test cases listed by name; the rest are "and N more". */
export const DIGEST_LIST = 5

export type DigestAccount = {
  id: string
  user_id: string
  verification_completed_at: string | null
  digest_opted_out_at: string | null
  digest_through: string
  missions_seen_at: string
  profiles: { email: string | null; moderation_status: string | null } | null
}

/**
 * Who gets a digest: verified, not opted out, not banned or suspended, with an
 * email on the profile. The setup chain guarantees a verified tester has a
 * confirmed address.
 */
export function isDigestRecipient(a: DigestAccount): boolean {
  const status = a.profiles?.moderation_status
  return (
    !!a.verification_completed_at &&
    !a.digest_opted_out_at &&
    status !== "banned" &&
    status !== "suspended" &&
    !!a.profiles?.email
  )
}

/**
 * Where a digest starts: the later of the last digest and the tester's last
 * visit to Available Test Cases (decision 3) — what they saw there last night
 * is not news this morning.
 */
export function digestSince(a: Pick<DigestAccount, "digest_through" | "missions_seen_at">): string {
  return a.digest_through > a.missions_seen_at ? a.digest_through : a.missions_seen_at
}

export function digestSubject(missions: Pick<NewMission, "title">[]): string {
  return missions.length === 1 ? `New test case: ${missions[0].title}` : `${missions.length} new test cases on Twnhall`
}

/** The listed items and the "and N more" count. */
export function digestItems(missions: NewMission[], site: string): { missions: DigestItem[]; more: number } {
  return {
    missions: missions.slice(0, DIGEST_LIST).map((m) => ({
      title: m.title,
      projectName: m.projectName,
      meta: [m.category && testCategoryLabel(m.category), m.device_target && deviceTargetLabel(m.device_target)]
        .filter(Boolean)
        .join(" · "),
      url: `${site}/mission/${m.id}`,
    })),
    more: Math.max(0, missions.length - DIGEST_LIST),
  }
}

/**
 * One window per tester, exactly once. For each recipient: claim first — move
 * digest_through to the run's start, compare-and-set on the value read, the
 * reminder_sent_at pattern in the same cron — then send. A re-run, or a second
 * invocation on top of the first, finds nothing to claim. The claim happens
 * even when there is nothing to send, so the window always moves forward. A
 * failed send is logged by sendTesterDigests and never retried: a missed email
 * is cheap, a double one teaches people to unsubscribe.
 *
 * Returns how many emails were sent.
 */
export async function runTesterDigest(now: Date, site: string): Promise<number> {
  const admin = createAdminClient()
  const runStart = now.toISOString()
  const { data, error } = await admin
    .from("accounts")
    .select(
      "id, user_id, verification_completed_at, digest_opted_out_at, digest_through, missions_seen_at, profiles(email, moderation_status)",
    )
    .eq("type", "tester")
    .is("digest_opted_out_at", null)
    .not("verification_completed_at", "is", null)
  if (error) throw new Error(error.message)

  const messages: DigestMessage[] = []
  // ponytail: one tester at a time, about five round trips each (~250 ms). The
  // cron's 60 s holds roughly 200 testers beside its other steps; past that,
  // claim and read in parallel chunks.
  for (const account of ((data ?? []) as unknown as DigestAccount[]).filter(isDigestRecipient)) {
    const { data: claimed } = await admin
      .from("accounts")
      .update({ digest_through: runStart })
      .eq("id", account.id)
      .eq("digest_through", account.digest_through)
      .select("id")
    if (!claimed?.length) continue

    // Still live at send time (newMissionsFor reads now), and nothing after the
    // run's start: those belong to tomorrow's window, or they would come twice.
    const missions = (await newMissionsFor(account.user_id, digestSince(account))).filter(
      (m) => m.firstPublishedAt <= runStart,
    )
    if (missions.length === 0) continue

    const links = unsubscribeLinks(account.id, site)
    messages.push({
      to: account.profiles!.email!,
      subject: digestSubject(missions),
      props: {
        ...digestItems(missions, site),
        browseUrl: `${site}/explore/missions`,
        unsubscribeUrl: links.page,
        settingsUrl: `${site}/settings?tab=account`,
      },
      headers: {
        "List-Unsubscribe": `<${links.oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
  }

  return messages.length ? sendTesterDigests(messages) : 0
}
