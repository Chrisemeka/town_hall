import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google"; 
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

export const metadata: Metadata = {
  metadataBase: new URL("https://twnhall.com"),
  applicationName: "Twnhall",
  title: "Twnhall",
  description: "Connecting developers with real-world testers.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono bg-obsidian text-chalk">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}