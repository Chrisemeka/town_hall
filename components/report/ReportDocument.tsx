import path from "node:path"
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import {
  screenshotCaption,
  screenshotNote,
  type ReportLegend,
  type ReportMission,
  type ReportModel,
  type ReportStep,
} from "@/lib/report"
import type { ScreenshotResult } from "@/lib/reportImages"

/*
 * The PDF report. Its own component tree, deliberately: this is a report with
 * its own layout, not a mirror of the tester's view, so the mission preview's
 * rule ("the tester's page, never a copy") does not apply. It shares logic —
 * lib/report.ts, testerNumbers, the vocabulary — and no markup.
 *
 * Two readers, in order: the front (opening, legend, "What we found") is plain
 * English for whoever the builder forwards this to; the detail after it is the
 * builder's, complete and unchanged. Layered, never a second variant.
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
  fix: { marginBottom: 16, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.danger },
  finding: { fontSize: 12, fontWeight: 500, marginBottom: 4 },
  headline: { fontFamily: "DM Mono", fontSize: 9, color: C.muted },
  agreement: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 8 },
  // Filled for a problem, hollow for not, both in ink: the shape carries it, so
  // it reads in greyscale and never by colour alone — and the count sits beside it.
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: C.ink, marginRight: 4, marginBottom: 4 },
  para: { marginBottom: 8 },
  link: { color: C.ink, textDecoration: "none" },
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

/** One dot per person who answered the step, filled where they hit a problem. */
function Agreement({ step }: { step: ReportStep }) {
  return (
    <View style={s.agreement}>
      {step.answers.map((a, i) => (
        <View key={i} style={[s.dot, i < step.problems ? { backgroundColor: C.ink } : {}]} />
      ))}
      <Text style={[s.headline, { marginLeft: 4, marginBottom: 4 }]}>
        Step {step.number} · {step.headline}
      </Text>
    </View>
  )
}

/** The statuses, as the testers were shown them. Quoted: the hints say "you" to the tester. */
function Legend({ legends }: { legends: ReportLegend[] }) {
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={96}>
        How each step was answered
      </Text>
      {legends.map((l) => (
        <View key={l.intro} style={{ marginBottom: 8 }} wrap={false}>
          <Text style={s.para}>{l.intro}</Text>
          {l.entries.map((e) => (
            <Text key={e.label} style={{ marginBottom: 4 }}>
              <Text style={s.strong}>{e.label}</Text> — “{e.hint}”
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/** A line of "In this report" — a link in a viewer, a list on paper. */
function Entry({ to, title, note }: { to: string; title: string; note?: string }) {
  return (
    <View style={s.contentsRow} wrap={false}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Link src={`#${to}`} style={s.link}>
          <Text style={s.strong}>{title}</Text>
        </Link>
        {note && <Text style={s.muted}>{note}</Text>}
      </View>
    </View>
  )
}

/** The front of a test: what was found, in sentences, then what was asked. */
function Summary({ mission }: { mission: ReportMission }) {
  return (
    <View id={`found-${mission.id}`}>
      <Text style={s.h2} minPresenceAhead={96}>
        What we found
      </Text>
      {mission.steps.length === 0 ? (
        <Text>
          These reports were filed before step-by-step testing. Each person&apos;s notes are at the end.
        </Text>
      ) : mission.fixFirst.length === 0 ? (
        <Text>Nobody reported a problem on any step.</Text>
      ) : (
        mission.fixFirst.map((step) => (
          <View key={step.number} style={s.fix} wrap={false}>
            {/* The sentence leads; the count is the builder's scanning line. */}
            <Text style={s.finding}>{step.sentence}</Text>
            <Text>They were asked to: {step.action}</Text>
            <Text style={s.muted}>What should have happened: {step.expected}</Text>
            <Agreement step={step} />
          </View>
        ))
      )}
      {mission.cleanLine && <Text style={s.muted}>{mission.cleanLine}</Text>}

      <View style={s.rule} />
      <Text style={s.meta}>{mission.mix}</Text>

      {mission.steps.length > 0 && (
        <View>
          <Text style={s.h3}>What we asked them to try</Text>
          {mission.steps.map((step) => (
            <View key={step.number} style={{ marginBottom: 8 }} wrap={false}>
              <Text>
                <Text style={s.strong}>{step.number}. </Text>
                {step.action}
              </Text>
              <Text style={s.muted}>What should have happened: {step.expected}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** "UI Design Testing · Mobile & Desktop", then what that kind of test looks at. */
function MissionMeta({ mission, people }: { mission: ReportMission; people: boolean }) {
  const line = [
    mission.category,
    mission.device,
    people && `${mission.reports} ${mission.reports === 1 ? "person" : "people"}`,
  ].filter(Boolean)
  return (
    <View>
      {line.length > 0 && <Text style={s.meta}>{line.join(" · ")}</Text>}
      {mission.blurb && <Text style={s.meta}>{mission.blurb}</Text>}
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
  images: Map<string, ScreenshotResult> | null
}) {
  return (
    <View id={`testers-${mission.id}`}>
      <Text style={s.h2}>Each person&apos;s notes and screenshots</Text>
      {mission.testers.map((t) => (
        <View key={t.tester} style={s.tester}>
          <View wrap={false}>
            <Text style={{ fontFamily: "DM Mono", fontSize: 10 }}>
              {t.tester} · {t.status}
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
              const img = images.get(url) ?? { failed: "network" as const }
              return "failed" in img ? (
                <Text key={i} style={[s.muted, s.field]}>
                  {screenshotCaption(img.failed)}
                </Text>
              ) : (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt
                <Image key={i} style={s.shot} src={img} />
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
  images: Map<string, ScreenshotResult> | null
}) {
  const one = !report.allMissions
  const missing = screenshotNote(images)
  const footer = `${report.project} · ${report.scope}`

  const people = (m: ReportMission) => `${m.reports} ${m.reports === 1 ? "person" : "people"}`

  return (
    <Document title={`${report.project} — ${report.scope}`} author="Twnhall" creator="Twnhall">
      <Sheet footer={footer}>
        <Text style={s.mark}>Twnhall</Text>
        <Text style={s.h1}>{report.project}</Text>
        <Text style={s.scope}>{report.scope}</Text>
        <Text style={s.meta}>{report.generated}</Text>
        <Text style={s.meta}>{report.evidence}</Text>
        {missing && <Text style={s.meta}>{missing}</Text>}
        {one && <MissionMeta mission={report.missions[0]} people={false} />}

        <View style={{ marginTop: 16 }}>
          {report.opening.map((p) => (
            <Text key={p} style={s.para}>
              {p}
            </Text>
          ))}
        </View>

        {/* Findings straight after the opening: a reader who stops at page one
            should stop having read them. */}
        {one && <Summary mission={report.missions[0]} />}

        <Legend legends={report.legends} />

        <Text style={s.h2} minPresenceAhead={64}>
          In this report
        </Text>
        {one ? (
          <View>
            {report.missions[0].steps.length > 0 && (
              <Entry to={`steps-${report.missions[0].id}`} title="What each person did, step by step" />
            )}
            <Entry to={`testers-${report.missions[0].id}`} title="Each person's notes and screenshots" />
          </View>
        ) : (
          report.missions.map((m) => (
            <Entry
              key={m.id}
              to={`found-${m.id}`}
              title={m.title}
              note={`${people(m)} · ${m.fixFirst[0] ? `Step ${m.fixFirst[0].number}: ${m.fixFirst[0].sentence}` : "Nobody reported a problem."}`}
            />
          ))
        )}
        <Entry to="glossary" title="What the words mean" />
      </Sheet>

      {report.missions.flatMap((m) => [
        // One mission: its summary is on page one, so this starts at the detail.
        // Every mission: each opens with its own summary.
        <Sheet key={m.id} footer={one ? footer : `${report.project} · ${m.title}`}>
          {!one && (
            <View>
              <Text style={s.h1}>{m.title}</Text>
              <MissionMeta mission={m} people />
              <Summary mission={m} />
            </View>
          )}
          {m.steps.length > 0 && (
            <Text id={`steps-${m.id}`} style={s.h2}>
              What each person did, step by step
            </Text>
          )}
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

      <Sheet footer={footer}>
        <View id="glossary">
          <Text style={s.h2}>What the words mean</Text>
          <Text style={[s.muted, s.para]}>
            The words used in the step-by-step pages, for anyone reading without the builder.
          </Text>
          {report.glossary.map((g) => (
            <Text key={g.term} style={s.para}>
              <Text style={s.strong}>{g.term}</Text> — {g.definition}
            </Text>
          ))}
        </View>
      </Sheet>
    </Document>
  )
}
