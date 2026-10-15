"use client"

import { useRef, useState } from "react"
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, X } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { screenshotList } from "@/lib/utils/screenshots"
import SubmissionReview from "@/components/SubmissionReview"
import { toStatus } from "@/lib/review"
import type { TestResultRow } from "@/lib/types/db"
import { testerLabel } from "@/lib/testerNumbers"
import { SubmissionBody, type SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { swipeStep } from "@/lib/swipe"

/**
 * Exactly the columns the mission page selects. This component is "use client",
 * so whatever its `result` holds is serialised into the page — which is how a
 * `select("*")` once sent every tester_id to the builder's browser. Never widen
 * this to TestResultRow.
 */
export type MissionResult = Pick<
  TestResultRow,
  | "id" | "mission_id" | "created_at" | "screenshot_url" | "screenshot_urls" | "tester_comment"
  | "ai_summary" | "ai_sentiment" | "status" | "rating" | "review_note"
>

type InsightItem = {
  status: "pass" | "warn" | "fail"
  title: string
  description: string
}

function getSentimentVariant(sentiment: string | null) {
  if (!sentiment) return "default" as const
  if (sentiment === "NEGATIVE" || sentiment === "FRUSTRATED") return "negative" as const
  if (sentiment === "POSITIVE") return "positive" as const
  return "default" as const
}

function parseInsights(summary: string): InsightItem[] | null {
  try {
    const parsed = JSON.parse(summary)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.title) return parsed
  } catch {}
  return null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/**
 * Screenshots render through <img>, not next/image, deliberately.
 *
 * They are already downscaled to 1600px and re-encoded as WebP in the browser
 * before upload (lib/image.ts), so the optimiser would be re-optimising its own
 * output — at a per-image cost on Vercel — on a screen only the mission's owner
 * and admins ever load. Their intrinsic dimensions are unknown at render time
 * too, so each of the three would need `fill` plus a positioned parent, and the
 * Supabase Storage host would have to join images.remotePatterns.
 *
 * The thumbnail strip is the one place with a real win: it paints a 1600px
 * source into a 56px box. Worth revisiting there first if this is reopened.
 */
export default function MissionResultRow({
  result,
  entries,
  testerNumber,
  appUrl,
}: {
  result: MissionResult
  /** Absent on the 24 submissions that predate the audit log. */
  entries?: SubmissionEntry[] | null
  /** Per mission, from lib/testerNumbers — the same number the CSV carries. */
  testerNumber: number | undefined
  appUrl: string | null
}) {
  const [insightOpen, setInsightOpen] = useState(false)
  const [active, setActive] = useState(0)
  const lightbox = useRef<HTMLDialogElement>(null)
  const swipeFrom = useRef<{ x: number; y: number } | null>(null)
  // A swipe that ends on the scrim must not also count as a tap that closes.
  const swiped = useRef(false)

  const shots = screenshotList(result)
  const current = shots[active] ?? shots[0] ?? null
  const step = (delta: number) => setActive((i) => (i + delta + shots.length) % shots.length)

  const date = formatDate(result.created_at)
  const displayUrl = appUrl ? appUrl.replace(/^https?:\/\//, "") : null
  const sentimentVariant = getSentimentVariant(result.ai_sentiment)
  const insights = result.ai_summary ? parseInsights(result.ai_summary) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Side by side from 1024px. Stacked below it with the audit log first:
          the log is the report, the screenshots are its evidence, and a tall
          screenshot first can put a screen of image before the first word. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 medium:gap-6">

        {/* TEST SCREENSHOTS */}
        <div className="order-2 lg:order-1 flex flex-col gap-3">
          <p className="font-mono text-[12px] lg:text-[11px] text-accent-ink uppercase tracking-[0.8px]">
            TEST SCREENSHOTS
            {shots.length > 1 && (
              <span className="text-ink-muted normal-case tracking-normal">
                {" "}· {active + 1} of {shots.length}
              </span>
            )}
          </p>
          <div className="relative bg-surface-raised border border-line rounded-[12px] overflow-hidden">
            {current ? (
              // A button, not a div with onClick, so the keyboard reaches it.
              // Below lg the image is capped at 60% of the screen and shown
              // whole: a 1600px-tall phone screenshot was 1,500px of page.
              <button
                type="button"
                onClick={() => lightbox.current?.showModal()}
                aria-label={`Open screenshot ${active + 1} of ${shots.length} full size`}
                className="block w-full cursor-pointer bg-surface lg:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ink"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see note above */}
                <img
                  src={current}
                  // Describes the image, not its role in the process — a screen
                  // reader user was being told "proof of visit 1", which is
                  // paperwork, not a picture. Design.md §10.
                  alt={`Test screenshot ${active + 1} of ${shots.length}`}
                  className="w-full max-h-[60dvh] object-contain lg:max-h-none lg:object-cover"
                />
              </button>
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <p className="font-mono text-[13px] text-ink-muted">No screenshot captured</p>
              </div>
            )}
            {result.ai_sentiment && (
              <div className="absolute top-3 right-3">
                <Badge variant={sentimentVariant}>{result.ai_sentiment}</Badge>
              </div>
            )}
          </div>

          {/* Thumbnail strip — only worth showing when there's more than one */}
          {shots.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {shots.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`View screenshot ${i + 1}`}
                  className={[
                    "w-14 h-14 rounded-[8px] overflow-hidden border transition-colors duration-150 shrink-0",
                    i === active ? "border-accent-ink" : "border-line hover:border-ink-muted",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- see note above */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {(displayUrl || date) && (
            <p className="font-mono text-[12px] text-ink-muted [overflow-wrap:anywhere]">
              {displayUrl && <span>{displayUrl}</span>}
              {displayUrl && <span aria-hidden="true" className="mx-1.5 text-line">·</span>}
              <span>{date}</span>
            </p>
          )}
        </div>

        {/* WRITTEN FEEDBACK */}
        <div className="order-1 lg:order-2 flex flex-col gap-3">
          <p className="font-mono text-[12px] lg:text-[11px] text-accent-ink uppercase tracking-[0.8px]">
            {entries?.length ? "AUDIT LOG" : "WRITTEN FEEDBACK"}
          </p>
          <div className="bg-surface-raised border border-line rounded-[12px] p-4 medium:p-6 flex-1 flex flex-col justify-between">
            <SubmissionBody entries={entries} comment={result.tester_comment} />
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
              <span className="font-mono text-[12px] text-ink-muted">{testerLabel(testerNumber)}</span>
              <span className="font-mono text-[12px] text-ink-muted">{date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM INSIGHT */}
      {result.ai_summary && (
        <div className="bg-surface-raised border border-line rounded-[12px] p-4 medium:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[12px] lg:text-[11px] text-accent-ink uppercase tracking-[0.8px]">
              Test Report
            </p>
            <button
              type="button"
              onClick={() => setInsightOpen(!insightOpen)}
              aria-expanded={insightOpen}
              aria-controls={`insights-${result.id}`}
              // 48px below lg; the negative margins keep the row's height.
              className="min-h-12 -my-3 -mr-2 px-2 lg:min-h-0 lg:my-0 lg:mr-0 lg:px-0 font-mono text-[12px] text-ink-muted hover:text-ink transition-colors duration-150 flex items-center gap-1.5"
            >
              AI generated · {insightOpen ? "collapse" : "expand"}
              {insightOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {insightOpen && (
            insights ? (
              // Three columns from 600px; stacked below, where three were ~90px.
              <div id={`insights-${result.id}`} className="grid grid-cols-1 gap-4 medium:grid-cols-3 medium:gap-6">
                {insights.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      {item.status === "warn" || item.status === "fail" ? (
                        <AlertTriangle className="w-4 h-4 text-accent-ink shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-success-ink shrink-0" />
                      )}
                      <p className="font-mono text-[14px] lg:text-[13px] font-semibold text-ink">{item.title}</p>
                    </div>
                    <p className="font-mono text-[14px] lg:text-[13px] leading-5 text-ink-muted">{item.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p id={`insights-${result.id}`} className="font-mono text-[14px] leading-6 text-ink-muted whitespace-pre-wrap">
                {result.ai_summary}
              </p>
            )
          )}
        </div>
      )}

      {/* REVIEW — approve + rate */}
      <SubmissionReview
        resultId={result.id}
        status={toStatus(result.status)}
        rating={result.rating ?? null}
        reviewNote={result.review_note ?? null}
      />

      {/* Screenshot lightbox. ponytail: a native <dialog> opened with
          showModal() — the platform traps focus, closes on Esc and puts focus
          back on the screenshot button. The scrim is literal Obsidian on
          purpose: dark in both themes; one that follows the theme stops
          being a scrim. */}
      {current && (
        <dialog
          ref={lightbox}
          aria-label={`Screenshot ${active + 1} of ${shots.length}`}
          // A click on the scrim lands on the dialog itself, which fills the
          // screen; anything inside is a click on its content.
          onClick={(e) => {
            if (swiped.current) {
              swiped.current = false
              return
            }
            if (e.target === e.currentTarget) lightbox.current?.close()
          }}
          onKeyDown={(e) => {
            if (shots.length < 2) return
            if (e.key === "ArrowLeft") step(-1)
            if (e.key === "ArrowRight") step(1)
          }}
          onPointerDown={(e) => {
            swipeFrom.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e) => {
            const from = swipeFrom.current
            swipeFrom.current = null
            if (!from || shots.length < 2) return
            const s = swipeStep(e.clientX - from.x, e.clientY - from.y)
            swiped.current = s !== 0
            if (s) step(s)
          }}
          className="m-0 w-full h-full max-w-none max-h-none bg-transparent p-4 backdrop:bg-obsidian/90 open:flex flex-col items-center justify-center" // ponytail: literal scrim, dark in both themes
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 medium:top-8 medium:right-8 w-12 h-12 bg-line hover:bg-line/80 rounded-full text-ink flex items-center justify-center transition-colors cursor-pointer"
            onClick={() => lightbox.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>

          {/* From 600px the arrows sit at the sides; below it they move into
              the bar under the image, where they cover nothing. */}
          {shots.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                className="hidden medium:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-line hover:bg-line/80 rounded-full text-ink items-center justify-center transition-colors cursor-pointer"
                onClick={() => step(-1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                className="hidden medium:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-line hover:bg-line/80 rounded-full text-ink items-center justify-center transition-colors cursor-pointer"
                onClick={() => step(1)}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </>
          )}

          <div className="bg-surface border border-line shadow-2xl rounded-2xl p-2 max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- see note above */}
            <img
              src={current}
              alt={`Test screenshot ${active + 1} of ${shots.length}, full size`}
              className="w-full max-h-[calc(85dvh-64px)] medium:max-h-[85dvh] object-contain rounded-xl"
            />
            {shots.length > 1 && (
              <div className="flex items-center justify-between medium:justify-center gap-2 pt-2 medium:py-2">
                <button
                  type="button"
                  aria-label="Previous screenshot"
                  className="medium:hidden w-12 h-12 bg-line hover:bg-line/80 rounded-full text-ink flex items-center justify-center transition-colors cursor-pointer"
                  onClick={() => step(-1)}
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <p className="font-mono text-[12px] text-ink-muted text-center">
                  {active + 1} of {shots.length}
                </p>
                <button
                  type="button"
                  aria-label="Next screenshot"
                  className="medium:hidden w-12 h-12 bg-line hover:bg-line/80 rounded-full text-ink flex items-center justify-center transition-colors cursor-pointer"
                  onClick={() => step(1)}
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </dialog>
      )}
    </div>
  )
}
