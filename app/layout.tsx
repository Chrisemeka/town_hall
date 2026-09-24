import type { Metadata } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, readTheme } from "@/lib/theme";
import { Syne, DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Long-form prose on PUBLIC pages only — pricing, about, the guides. DM Mono
// stays the body font on every app surface (Design.md §4.2). DM Sans is DM
// Mono's own superfamily, so a paragraph set in it sits on the same vertical
// metrics as the labels and buttons around it.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://twnhall.com"),
  applicationName: "Twnhall",
  title: "Twnhall",
  description: "Connecting developers with real-world testers.",
  manifest: "/logo/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/logo/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/logo/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/logo/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/logo/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Twnhall",
    title: "Twnhall",
    description: "Connecting developers with real-world testers.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Twnhall",
    description: "Connecting developers with real-world testers.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Twnhall",
  url: "https://twnhall.com",
  description: "Connecting developers with real-world testers.",
};

/*
 * data-theme is set here, once, for every route.
 *
 * It used to live on two nested wrappers — the (public) layout and the setup
 * shell — because only those surfaces were themed. Now that every surface is,
 * one attribute on the document is the whole mechanism: two nested attributes
 * agreeing is harmless right up until the day they disagree.
 *
 * Read from the cookie server-side, so the first byte is already correct:
 * no flash of the wrong theme, no blocking inline script, no
 * suppressHydrationWarning. The cost is that /_not-found stops being
 * statically rendered — it was the only static page left, and robots.txt and
 * sitemap.xml are route handlers and unaffected.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${syne.variable} ${dmMono.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono bg-surface text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}