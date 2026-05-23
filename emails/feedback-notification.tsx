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

export interface FeedbackNotificationProps {
  ownerName: string
  testerName: string
  projectName: string
  missionTitle: string
  submissionSummary: string
  feedbackUrl: string
}

export default function FeedbackNotification({
  ownerName,
  testerName,
  projectName,
  missionTitle,
  submissionSummary,
  feedbackUrl,
}: FeedbackNotificationProps) {
  const previewText = `${testerName} left new feedback on ${projectName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>TownHall</Text>
            <Text style={tagline}>Real feedback for real builders.</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hi {ownerName || "there"},</Text>
            <Text style={paragraph}>
              <strong style={strong}>{testerName || "A tester"}</strong> just
              submitted feedback on your project{" "}
              <strong style={strong}>{projectName}</strong>.
            </Text>

            <Section style={card}>
              <Text style={cardLabel}>Mission</Text>
              <Text style={cardValue}>{missionTitle}</Text>

              {submissionSummary ? (
                <>
                  <Text style={cardLabel}>Summary</Text>
                  <Text style={cardSummary}>{submissionSummary}</Text>
                </>
              ) : null}
            </Section>

            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button style={cta} href={feedbackUrl}>
                View Feedback
              </Button>
            </Section>

            <Text style={paragraph}>
              Open the submission in TownHall to see screenshots, the tester&apos;s
              comments, and the AI summary.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re receiving this because you own a project on TownHall.
            </Text>
            <Text style={footerText}>
              TownHall · Real feedback for real builders.
            </Text>
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

const strong: React.CSSProperties = {
  color: "#F4F4F5",
  fontWeight: 600,
}

const card: React.CSSProperties = {
  backgroundColor: "#15151B",
  border: "1px solid #2A2A33",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
}

const cardLabel: React.CSSProperties = {
  color: "#7C7C8A",
  fontSize: "10px",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "0 0 4px",
}

const cardValue: React.CSSProperties = {
  color: "#F4F4F5",
  fontSize: "15px",
  fontWeight: 600,
  margin: "0 0 16px",
}

const cardSummary: React.CSSProperties = {
  color: "#C7C7CC",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
  whiteSpace: "pre-wrap" as const,
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
