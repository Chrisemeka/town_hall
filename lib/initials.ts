// Initials for an avatar with no image.
//
// One definition, because every email/password user from here on has a null
// avatar_url and this is what they get instead. There were three byte-identical
// copies of it across the admin pages before this file existed.

/**
 * Up to two initials from a name, falling back to the email.
 *
 * Splits on whitespace, "@" and "." so "ada@twnhall.com" gives "AT" rather than
 * "A" — an address is the fallback precisely when there is no name to use, so
 * taking only the first letter would make every gmail user look identical.
 *
 * Returns "" rather than throwing when there is nothing to work with. The
 * caller renders an empty circle, which is honest: we do not know who this is.
 */
export function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim()
  if (!source) return ""
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")
}
