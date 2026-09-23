// Theme resolution for the public surfaces.
//
// Kept as a pure function with no imports so the layout, the toggle and
// scripts/theme.test.mts all reach the same answer from the same code. The
// cookie carries no authority — it is a display preference — but it is still
// attacker-controlled text that ends up in an HTML attribute, so it is never
// passed through: readTheme() maps it onto one of two known strings and
// anything unrecognised becomes the default.

export type Theme = "light" | "dark"

export const THEME_COOKIE = "th_theme"

/** One year. Long enough that the choice feels permanent. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * The default is light, and there is no prefers-color-scheme fallback.
 *
 * That is deliberate, not an oversight: honouring the OS would make the
 * default unpredictable across visitors, and light is the requested default.
 * An explicit choice always wins. Do not "fix" this by adding a media query.
 */
export function readTheme(cookieValue: string | undefined): Theme {
  return cookieValue === "dark" ? "dark" : "light"
}

/** The other theme — what the toggle switches to, and what its label names. */
export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark"
}

/**
 * Records the preference. Browser only — call it from an event handler.
 *
 * Here rather than in a component because two of them set it: the header
 * toggle and the Settings control. One cookie, one spelling of how it is
 * written, so the two presentations of this setting cannot disagree about
 * path, lifetime or name.
 */
export function writeThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`
}
