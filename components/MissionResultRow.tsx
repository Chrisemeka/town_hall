"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, X } from "lucide-react"
import { Badge } from "@/components/ui/Badge"

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

export default function MissionResultRow({
  result,
  index,
  appUrl,
}: {
  result: any
  index: number
  appUrl: string | null
}) {
  const [insightOpen, setInsightOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const developerNum = String(index + 1).padStart(2, "0")
  const date = formatDate(result.created_at)
  const displayUrl = appUrl ? appUrl.replace(/^https?:\/\//, "") : null
  const sentimentVariant = getSentimentVariant(result.ai_sentiment)
  const insights = result.ai_summary ? parseInsights(result.ai_summary) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-6">

        {/* PROOF OF VISIT */}
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] text-voltage uppercase tracking-[0.8px]">
            PROOF OF VISIT
          </p>
          <div
            className="relative bg-graphite border border-iron rounded-[12px] overflow-hidden cursor-pointer"
            onClick={() => result.screenshot_url && setLightboxOpen(true)}
          >
            {result.screenshot_url ? (
              <img
                src={result.screenshot_url}
                alt="Proof of visit"
                className="w-full object-cover"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <p className="font-mono text-[13px] text-ash">No screenshot captured</p>
              </div>
            )}
            {result.ai_sentiment && (
              <div className="absolute top-3 right-3">
                <Badge variant={sentimentVariant}>{result.ai_sentiment}</Badge>
              </div>
            )}
          </div>
          {(displayUrl || date) && (
            <p className="font-mono text-[12px] text-ash">
              {displayUrl && <span>{displayUrl}</span>}
              {displayUrl && <span className="mx-1.5 text-iron">·</span>}
              <span>{date}</span>
            </p>
          )}
        </div>

        {/* WRITTEN FEEDBACK */}
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] text-voltage uppercase tracking-[0.8px]">
            WRITTEN FEEDBACK
          </p>
          <div className="bg-graphite border border-iron rounded-[12px] p-6 flex-1 flex flex-col justify-between">
            <p className="font-mono text-[15px] leading-6 text-chalk italic">
              &ldquo;{result.tester_comment}&rdquo;
            </p>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-iron">
              <span className="font-mono text-[12px] text-ash">Developer #{developerNum}</span>
              <span className="font-mono text-[12px] text-ash">{date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM INSIGHT */}
      {result.ai_summary && (
        <div className="bg-graphite border border-iron rounded-[12px] p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[11px] text-voltage uppercase tracking-[0.8px]">
              Test Report
            </p>
            <button
              onClick={() => setInsightOpen(!insightOpen)}
              className="font-mono text-[12px] text-ash hover:text-chalk transition-colors duration-150 flex items-center gap-1.5"
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
              <div className="grid grid-cols-3 gap-6">
                {insights.map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      {item.status === "warn" || item.status === "fail" ? (
                        <AlertTriangle className="w-4 h-4 text-voltage shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-mint shrink-0" />
                      )}
                      <p className="font-mono text-[13px] font-semibold text-chalk">{item.title}</p>
                    </div>
                    <p className="font-mono text-[13px] leading-5 text-ash">{item.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[14px] leading-6 text-ash whitespace-pre-wrap">
                {result.ai_summary}
              </p>
            )
          )}
        </div>
      )}

      {/* Screenshot lightbox */}
      {lightboxOpen && result.screenshot_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/95 backdrop-blur-sm p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-8 right-8 w-12 h-12 bg-iron hover:bg-iron/80 rounded-full text-chalk flex items-center justify-center transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }}
          >
            <X size={20} />
          </button>
          <div
            className="bg-obsidian border border-iron shadow-2xl rounded-2xl p-2 max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={result.screenshot_url}
              alt="Full proof of visit"
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
