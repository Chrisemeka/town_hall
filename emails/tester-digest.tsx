import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

// The daily list of new test cases. Project name and title only — both already
// public on Explore. Never the builder's name or email: the tester is never
// sent the builder's identity (CLAUDE.md). Nothing about pay, even to cohort
// testers; the cohort is paid outside the product.

export type DigestItem = {
  title: string
  projectName: string
  /** "Process Flow Testing · Mobile" — category and device, either may be absent. */
  meta: string
  /** Absolute: /mission/[id] on the live site. */
  url: string
}

export interface TesterDigestProps {
  /** Up to DIGEST_LIST, newest first. */
  missions: DigestItem[]
  /** How many more went live than are listed. */
  more: number
  browseUrl: string
  unsubscribeUrl: string
  settingsUrl: string
}

export default function TesterDigest({ missions, more, browseUrl, unsubscribeUrl, settingsUrl }: TesterDigestProps) {
  const total = missions.length + more
  const previewText =
    total === 1 ? `New test case: ${missions[0]?.title ?? ""}` : `${total} new test cases are live on Twnhall`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Twnhall</Text>
            <Text style={tagline}>Real test reports for real builders.</Text>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>
              {total === 1
                ? "A new test case went live since your last email."
                : `${total} new test cases went live since your last email.`}
            </Text>

            {missions.map((m) => (
              <Section key={m.url} style={card}>
                <Link href={m.url} style={cardTitle}>
                  {m.title}
                </Link>
                <Text style={cardLine}>{m.projectName}</Text>
                {m.meta ? <Text style={cardMeta}>{m.meta}</Text> : null}
              </Section>
            ))}

            {more > 0 ? (
              <Text style={paragraph}>
                and {more} more.
              </Text>
            ) : null}

            <Section style={{ textAlign: "center", margin: "32px 0" }}>
              <Button style={cta} href={browseUrl}>
                Browse test cases
              </Button>
            </Section>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              You&apos;re getting this because you have a Twnhall tester account.
            </Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
              </Link>
              {" · "}
              <Link href={settingsUrl} style={footerLink}>
                Turn this off in Settings
              </Link>
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
  padding: "16px 20px",
  margin: "12px 0",
}

const cardTitle: React.CSSProperties = {
  color: "#F4F4F5",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "underline",
}

const cardLine: React.CSSProperties = {
  color: "#C7C7CC",
  fontSize: "13px",
  margin: "6px 0 0",
}

const cardMeta: React.CSSProperties = {
  color: "#7C7C8A",
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "4px 0 0",
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

const footerLink: React.CSSProperties = {
  color: "#7C7C8A",
  textDecoration: "underline",
}
