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

export interface AdminBroadcastProps {
  recipientName: string
  subject: string
  messageBody: string
  ctaLabel?: string
  ctaUrl?: string
}

export default function AdminBroadcast({
  recipientName,
  subject,
  messageBody,
  ctaLabel,
  ctaUrl,
}: AdminBroadcastProps) {
  const paragraphs = (messageBody ?? "").split(/\n{2,}/)
  const hasCta = Boolean(ctaLabel && ctaUrl)

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>TownHall</Text>
            <Text style={tagline}>A message from the team</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hi {recipientName || "there"},</Text>
            <Text style={headline}>{subject}</Text>

            {paragraphs.map((para, i) => (
              <Text key={i} style={paragraph}>
                {para.split("\n").map((line, j, arr) => (
                  <span key={j}>
                    {line}
                    {j < arr.length - 1 ? <br /> : null}
                  </span>
                ))}
              </Text>
            ))}

            {hasCta ? (
              <Section style={{ textAlign: "center", margin: "32px 0" }}>
                <Button style={cta} href={ctaUrl!}>
                  {ctaLabel}
                </Button>
              </Section>
            ) : null}
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              This message was sent by the TownHall admin team.
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
  margin: "0 0 8px",
}

const headline: React.CSSProperties = {
  color: "#F4F4F5",
  fontFamily: "'Syne', 'Inter', system-ui, sans-serif",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "28px",
  margin: "8px 0 16px",
}

const paragraph: React.CSSProperties = {
  color: "#C7C7CC",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "12px 0",
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
