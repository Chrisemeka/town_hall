import { cookies } from "next/headers";
import { THEME_COOKIE, readTheme } from "@/lib/theme";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";

/**
 * The public shell: header and footer.
 *
 * It no longer owns `data-theme` — app/layout.tsx sets that once on <html>
 * for every route, now that every surface is themed. The theme is still read
 * here because PublicHeader's toggle needs to know which way to point.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink font-mono selection:bg-accent selection:text-obsidian">
      <PublicHeader theme={theme} />
      <main className="flex-1 flex flex-col">{children}</main>
      <PublicFooter />
    </div>
  );
}
