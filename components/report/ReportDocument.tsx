import path from "node:path"
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { ReportMission, ReportModel, ReportStep } from "@/lib/report"
import type { ReportImage } from "@/lib/reportImages"

/*
 * The PDF report. Its own component tree, deliberately: this is a report with
 * its own layout, not a mirror of the tester's view, so the mission preview's
 * rule ("the tester's page, never a copy") does not apply. It shares logic —
 * lib/report.ts, testerNumbers, the vocabulary — and no markup.
 *
 * Renders a ReportModel and does no arithmetic. Light always: a printed
 * document has nothing to do with the th_theme cookie, and a dark PDF is
 * ink-soaked and looks broken.
 */

// next.config.ts's outputFileTracingIncludes ships these with the route.
const FONTS = path.join(process.cwd(), "components/report/fonts")
Font.register({ family: "Syne", src: path.join(FONTS, "Syne-Bold.ttf"), fontWeight: 700 })
Font.register({
  family: "DM Sans",
  fonts: [
    { src: path.join(FONTS, "DMSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS, "DMSans-Medium.ttf"), fontWeight: 500 },
  ],
})
Font.register({ family: "DM Mono", src: path.join(FONTS, "DMMono-Medium.ttf"), fontWeight: 500 })
// react-pdf hyphenates English by default and splits words mid-syllable.
Font.registerHyphenationCallback((word) => [word])
// ponytail: Latin subsets only. A glyph outside them (emoji, ₦) renders blank;
// add latin-ext files from Fontsource if testers' text starts needing them.

// The light values of the semantic tokens (app/globals.css). CSS variables do
// not reach react-pdf, so they are written out here.
const C = {
  ink: "#0E0E10", // ponytail: PDF has no theme — light ink
  muted: "#5A5A66", // ponytail: PDF has no theme — light ink-muted
  line: "#D2D2DA", // ponytail: PDF has no theme — light line
  raised: "#F5F5F9", // ponytail: PDF has no theme — light surface-raised
  accent: "#353D00", // ponytail: PDF has no theme — light accent-ink
  danger: "#A81E15", // ponytail: PDF has no theme — light danger-ink
  success: "#046334", // ponytail: PDF has no theme — light success-ink
  info: "#0A5490", // ponytail: PDF has no theme — light info-ink
}

/** Colour paired with the label every time — never colour alone. */
const statusColour = (status: string) =>
  status === "pass" ? C.success : status === "fail" ? C.danger : C.info

const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 72, paddingHorizontal: 56, fontFamily: "DM Sans", fontSize: 11, color: C.ink },
  // No lineHeight anywhere: the fonts' own leading (about 1.35) reads well,
  // and react-pdf mishandles every override tried — on the Page it drops the
  // page-number text, inherited from a View or unitless it near double-spaces,
  // and in points it overprints lines.
  mark: { fontFamily: "Syne", fontSize: 12, color: C.accent, marginBottom: 32 },
  h1: { fontFamily: "Syne", fontSize: 24, marginBottom: 8 },
  scope: { fontFamily: "Syne", fontSize: 16, marginBottom: 16 },
  h2: { fontFamily: "Syne", fontSize: 16, marginTop: 24, marginBottom: 12 },
  h3: { fontFamily: "Syne", fontSize: 12, marginTop: 16, marginBottom: 8 },
  label: { fontFamily: "DM Mono", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  meta: { fontFamily: "DM Mono", fontSize: 10, color: C.muted, marginBottom: 4 },
  muted: { color: C.muted },
  strong: { fontWeight: 500 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 16 },
  fix: { marginBottom: 12, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.danger },
  headline: { fontWeight: 500, color: C.danger },
  step: { marginTop: 20, marginBottom: 8 },
  answer: { marginBottom: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.line },
  field: { marginTop: 4 },
  tester: { marginBottom: 20 },
  ai: { marginTop: 8, padding: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, borderRadius: 4 },
  shot: { marginTop: 8, maxHeight: 260, maxWidth: "100%", objectFit: "contain", alignSelf: "flex-start" },
  footer: { position: "absolute", bottom: 32, left: 56, right: 56, fontFamily: "DM Mono", fontSize: 9, color: C.muted },
  pageNumber: { position: "absolute", bottom: 32, left: 56, right: 56, fontFamily: "DM Mono", fontSize: 9, color: C.muted, textAlign: "right" },
  contentsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
})

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

/** Page one of a mission: what to fix, in order, then the shape of the evidence. */
function Summary({ mission }: { mission: ReportMission }) {
  return (
    <View>
      <Text style={s.h2}>What to fix first</Text>
      {mission.steps.length === 0 ? (
        <Text>
          These reports were filed before step-by-step testing. Each tester&apos;s notes are at the end.
        </Text>
      ) : mission.fixFirst.length === 0 ? (
        <Text>Every tester passed every step.</Text>
      ) : (
        mission.fixFirst.map((step) => (
          <View key={step.number} style={s.fix} wrap={false}>
            <Text style={s.strong}>
              Step {step.number} — “{step.action}”
            </Text>
            <Text style={s.headline}>{step.headline}</Text>
          </View>
        ))
      )}
      {mission.fixFirst.length > 0 && mission.clean.length > 0 && (
        <Text style={s.muted}>
          No problems reported on {mission.clean.length === 1 ? "step" : "steps"} {mission.clean.join(", ")}.
        </Text>
      )}

      <View style={s.rule} />
      <Text style={s.meta}>{mission.mix}</Text>
      <Text style={s.meta}>{mission.rating}</Text>

      {mission.steps.length > 0 && (
        <View>
          <Text style={s.h3}>The test case</Text>
          {mission.steps.map((step) => (
            <View key={step.number} style={{ marginBottom: 6 }} wrap={false}>
              <Text>
                <Text style={s.strong}>{step.number}. </Text>
                {step.action}
              </Text>
              <Text style={s.muted}>Expected: {step.expected}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** One step and every answer to it. */
function StepDetail({ step }: { step: ReportStep }) {
  return (
    <View>
      {/* Never left alone at the foot of a page. */}
      <View style={s.step} minPresenceAhead={96}>
        <Text style={s.label}>Step {step.number} · {step.headline}</Text>
        <Text style={[s.strong, { fontSize: 12, marginTop: 4 }]}>{step.action}</Text>
        <Text style={s.muted}>Expected: {step.expected}</Text>
      </View>
      {step.answers.map((a) => (
        // One answer stays on one page where it fits. The "Step N · Tester M"
        // line means an answer that lands on a new page still says where it
        // belongs, without any page-position logic.
        <View key={a.tester} style={s.answer} wrap={false}>
          <Text style={{ fontFamily: "DM Mono", fontSize: 10 }}>
            Step {step.number} · {a.tester} · <Text style={{ color: statusColour(a.status) }}>{a.label}</Text>
          </Text>
          {a.askedAs && (
            <Text style={[s.muted, s.field]}>
              Asked as: {a.askedAs.action} (expected: {a.askedAs.expected})
            </Text>
          )}
          <Field label="What they saw" value={a.actual} />
          <Field label="Issue" value={a.issue} />
          <Field label="Steps to reproduce" value={a.reproduce} />
        </View>
      ))}
    </View>
  )
}

function Testers({
  mission,
  images,
}: {
  mission: ReportMission
  /** Null when screenshots were left out of this document. */
  images: Map<string, ReportImage | null> | null
}) {
  return (
    <View>
      <Text style={s.h2}>Each tester</Text>
      {mission.testers.map((t) => (
        <View key={t.tester} style={s.tester}>
          <View wrap={false}>
            <Text style={{ fontFamily: "DM Mono", fontSize: 10 }}>
              {t.tester} · {t.status}
              {t.rating != null ? ` · Rated ${t.rating} / 5` : ""}
            </Text>
            {t.legacy && <Text style={[s.muted, s.field]}>Filed before step-by-step reports.</Text>}
            <Field label="Anything else" value={t.comment} />
          </View>
          {t.aiSummary && (
            <View style={s.ai} wrap={false}>
              <Text style={s.label}>
                AI-generated summary — written by a model from this tester&apos;s report, not by the tester
              </Text>
              <Text style={s.field}>{t.aiSummary}</Text>
            </View>
          )}
          {images &&
            t.screenshots.map((url, i) => {
              const img = images.get(url)
              return img ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt
                <Image key={i} style={s.shot} src={img} />
              ) : (
                <Text key={i} style={[s.muted, s.field]}>
                  Screenshot couldn&apos;t be included.
                </Text>
              )
            })}
        </View>
      ))}
    </View>
  )
}

/**
 * One run of pages with the running footer. Each section starts its own Page
 * rather than using `break`: react-pdf loops forever breaking a View taller
 * than a page, and a nested break marker collapsed the detail onto itself.
 */
function Sheet({ footer, children }: { footer: string; children: React.ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      {children}
      <Text style={s.footer} fixed>
        {footer}
      </Text>
      <Text
        // One style object, never an array: react-pdf silently drops
        // render-prop text whose style is an array.
        style={s.pageNumber}
        fixed
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </Page>
  )
}

export function ReportDocument({
  report,
  images,
}: {
  report: ReportModel
  images: Map<string, ReportImage | null> | null
}) {
  const one = !report.allMissions
  const footer = `${report.project} · ${report.scope}`

  return (
    <Document title={`${report.project} — ${report.scope}`} author="Twnhall" creator="Twnhall">
      <Sheet footer={footer}>
        <Text style={s.mark}>Twnhall</Text>
        <Text style={s.h1}>{report.project}</Text>
        <Text style={s.scope}>{report.scope}</Text>
        <Text style={s.meta}>{report.generated}</Text>
        <Text style={s.meta}>{report.evidence}</Text>

        {one ? (
          <View>
            {(report.missions[0].category || report.missions[0].device) && (
              <Text style={s.meta}>
                {[report.missions[0].category, report.missions[0].device].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Summary mission={report.missions[0]} />
          </View>
        ) : (
          <View>
            <Text style={s.h2}>Contents</Text>
            {report.missions.map((m) => (
              <View key={m.id} style={s.contentsRow} wrap={false}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={s.strong}>{m.title}</Text>
                  <Text style={s.muted}>
                    {m.fixFirst[0]
                      ? `Top issue: Step ${m.fixFirst[0].number}, ${m.fixFirst[0].headline}`
                      : "No problems reported"}
                  </Text>
                </View>
                <Text style={s.meta}>
                  {m.reports} {m.reports === 1 ? "report" : "reports"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      {report.missions.flatMap((m) => [
        // One mission: its summary is page one, so this starts at the detail.
        // Every mission: each opens with its own summary.
        <Sheet key={m.id} footer={one ? footer : `${report.project} · ${m.title}`}>
          {!one && (
            <View>
              <Text style={s.h1}>{m.title}</Text>
              <Text style={s.meta}>
                {[m.category, m.device, `${m.reports} ${m.reports === 1 ? "report" : "reports"}`].filter(Boolean).join(" · ")}
              </Text>
              <Summary mission={m} />
            </View>
          )}
          {m.steps.length > 0 && <Text style={s.h2}>Step by step</Text>}
          {m.steps.map((step) => (
            <StepDetail key={step.number} step={step} />
          ))}
        </Sheet>,
        // Each tester on fresh pages: a heading left at the foot of the
        // detail is stranded, and break inside a View corrupts the layout.
        <Sheet key={`${m.id}-testers`} footer={one ? footer : `${report.project} · ${m.title}`}>
          <Testers mission={m} images={images} />
        </Sheet>,
      ])}
    </Document>
  )
}
