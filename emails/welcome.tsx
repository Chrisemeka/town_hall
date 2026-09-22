import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

/**
 * Sent once, when someone finishes setup and their account opens.
 *
 * One template with a role branch rather than two. The content is not written
 * here — it arrives as props from `nextStepsFor(role)` and
 * `completionHeadlineFor(role)` in lib/setup.ts, which is the same source the
 * completion screen renders. Two hand-written templates would be a third and
 * fourth copy of the same three sentences, and they would drift from the
 * screen the person read a minute earlier — worse than either being wrong
 * alone, because they have both in front of them.
 *
 * Taking content as props rather than importing lib/setup.ts keeps this a
 * thing that renders what it is handed, which is what makes it testable
 * without a database. Same shape as feedback-notification.tsx.
 *
 * Dark styling, like the other two templates: an email has no theme to follow.
 */
export interface WelcomeProps {
  name: string
  role: "builder" | "tester"
  headline: string
  nextSteps: readonly { title: string; detail: string }[]
  ctaUrl: string
  ctaLabel: string
}

export default function Welcome({
  name,
  role,
  headline,
  nextSteps,
  ctaUrl,
  ctaLabel,
}: WelcomeProps) {
  const firstName = name.trim().split(/\s+/)[0] || "there"

  return (
    <Html>
      <Head />
      <Preview>{headline}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Twnhall</Text>
            <Text style={tagline}>
              {role === "tester" ? "Tester account" : "Builder account"}
            </Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hi {firstName},</Text>
            <Text style={paragraph}>
              {role === "tester"
                ? "Your tester account is open. Builders are waiting on reports right now, and here is how the work goes."
                : "Your builder account is open. Here is how to get a report back on what you have built."}
            </Text>

            <Section style={card}>
              {nextSteps.map((step, i) => (
                <Section key={step.title} style={i === 0 ? stepFirst : stepRow}>
                  <Text style={stepTitle}>
                    {i + 1}. {step.title}
                  </Text>
                  <Text style={stepDetail}>{step.detail}</Text>
                </Section>
              ))}
            </Section>

            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button style={cta} href={ctaUrl}>
                {ctaLabel}
              </Button>
            </Section>

            <Text style={paragraph}>
              {role === "tester"
                ? "Every report you write earns you one on your own work, whenever you want it."
                : "Test someone else's product and you earn another report on yours, one for one."}
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              You are getting this because you just finished setting up a
              Twnhall account.
            </Text>
            <Text style={footerText}>Twnhall — built in Nigeria 🇳🇬</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: "#0B0B0F",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
}

const header: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "24px",
  borderBottom: "1px solid #2A2A33",
}

const brand: React.CSSProperties = {
  color: "#E8FF47",
  fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
  fontSize: "28px",
  fontWeight: 700,
  letterSpacing: "-0.5px",
  margin: 0,
}

const tagline: React.CSSProperties = {
  color: "#7C7C8A",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "6px 0 0",
}

const content: React.CSSProperties = {
  padding: "24px 0",
}

const greeting: React.CSSProperties = {
  color: "#F4F4F5",
  fontSize: "16px",
  margin: "0 0 16px",
}

const paragraph: React.CSSProperties = {
  color: "#C7C7CC",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "12px 0",
}

const card: React.CSSProperties = {
  backgroundColor: "#15151B",
  border: "1px solid #2A2A33",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
}

const stepFirst: React.CSSProperties = { margin: 0 }

const stepRow: React.CSSProperties = {
  margin: "20px 0 0",
  paddingTop: "20px",
  borderTop: "1px solid #2A2A33",
}

const stepTitle: React.CSSProperties = {
  color: "#E8FF47",
  fontSize: "13px",
  fontWeight: 600,
  margin: "0 0 6px",
}

const stepDetail: React.CSSProperties = {
  color: "#C7C7CC",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
}

const cta: React.CSSProperties = {
  backgroundColor: "#E8FF47",
  color: "#0B0B0F",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "8px",
  display: "inline-block",
}

const hr: React.CSSProperties = {
  borderColor: "#2A2A33",
  margin: "32px 0 16px",
}

const footer: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "0 16px",
}

const footerText: React.CSSProperties = {
  color: "#7C7C8A",
  fontSize: "11px",
  lineHeight: "18px",
  margin: "4px 0",
}
