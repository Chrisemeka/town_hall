import { cookies } from "next/headers";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { THEME_COOKIE, readTheme } from "@/lib/theme";

/**
 * The public shell: theme attribute, header, footer.
 *
 * `data-theme` sits on this wrapper rather than on <html> because only the
 * root layout may render <html>, and reading cookies() there would opt every
 * route in the app into dynamic rendering — including the app surfaces, which
 * do not have a theme. Scoping the read here keeps that cost on the pages that
 * need it. Custom properties cascade, so an attribute on a div resolves for
 * everything inside it (see the note in app/globals.css on why the semantic
 * tokens are defined directly rather than through an indirection layer).
 *
 * Reading the cookie server-side is also what makes the first paint correct:
 * no flash of the wrong theme, no blocking inline script, no
 * suppressHydrationWarning.
 *
 * The root <body> keeps its literal `bg-obsidian text-chalk` — the app
 * surfaces still rely on it — so overscroll past the end of a light page shows
 * Obsidian, exactly as today's landing page already does.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div
      data-theme={theme}
      className="min-h-screen flex flex-col bg-surface text-ink font-mono selection:bg-accent selection:text-obsidian"
    >
      <PublicHeader theme={theme} />
      <main className="flex-1 flex flex-col">{children}</main>
      <PublicFooter />
    </div>
  );
}
