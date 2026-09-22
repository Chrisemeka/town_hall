# Twnhall — UI/UX Revamp, Stage 1: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Stage 1 of a UI/UX revamp. Visual inspiration is **task2k** (a Nigerian user-research platform) — its structure, not its palette. Twnhall keeps its own colours and fonts.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions — **except** where this prompt explicitly replaces a rule, which it does once (§1.1).
2. Read `DESIGN.md` §5 and §8.
3. Read `TEST.md` §1.
4. Read `docs/specs/` and match that spec format.

**Three PRs, in order.** Write each spec into `docs/specs/SPEC-<name>.md` first and **stop for approval before implementing**. Commit granularity per `CLAUDE.md`. All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

### Decisions already made — do not relitigate

- **One sign-in for everyone.** task2k splits company and tester login; Twnhall does not. `profiles`/`accounts`, the `th_account` cookie, `accessFor()`, `/choose-account` and the verification gate all assume one person can hold both roles. **Do not build separate builder and tester auth entry points.**
- **Theme scope is public pages only.** Dashboard and admin stay dark with their existing literal tokens. No churn in the ~60 app components.
- **Guides are rewritten from scratch**, not ported from `/guidelines`.

### What to take from task2k, and what not to

Take: the centred auth card on a tinted page, the 4-column footer, the stepped onboarding header, generous corner radius, white cards on a tinted ground, emoji as illustration, the "what happens next" numbered explainer block.

Do not take: its green/orange palette, its split audience login, its "Download" and "Blog" footer links (Twnhall has neither — **never ship a footer link to a page that does not exist**).

---

# PR 1 — Public theme system and shell

**Branch:** `feat/public-theme`
**Migration:** none
**Risk:** low — new route group, no existing component touched

## 1.1 — This replaces a CLAUDE.md rule

`CLAUDE.md` currently states, as non-negotiable:

> **Surfaces:** Dashboard is dark (Obsidian `#0E0E10` base). Landing is light (Bone `#F5F5F7`). Do not mix.

That rule is now **scoped to the app surfaces only**. Public pages become theme-switchable. Update the rule in `CLAUDE.md` and `DESIGN.md` to say exactly that — app surfaces stay dark, public surfaces follow the theme token set below. Do not leave the old wording in place; a rule that is now half-true is worse than one that is replaced.

## 1.2 — Route group

Create a `(public)` route group with its own layout. Move in: `app/page.tsx`, `terms`, `privacy`, and the new pages from PR 2. The `(developer)`, `(tester)` and `(admin)` groups are untouched.

The `(public)` layout owns the theme attribute, the public header and the footer. This boundary is what keeps the refactor small — respect it.

## 1.3 — Tokens

Keep every existing literal token in `app/globals.css`. The dashboard reads them and they must not move.

**Add** a semantic layer that resolves per theme. Sketch:

```css
@theme {
  --color-surface:        var(--th-surface);
  --color-surface-raised: var(--th-surface-raised);
  --color-ink:            var(--th-ink);
  --color-ink-muted:      var(--th-ink-muted);
  --color-line:           var(--th-line);
  --color-accent:         var(--th-accent);      /* fills only */
  --color-accent-ink:     var(--th-accent-ink);  /* text, borders, icons */
}

:root, [data-theme="light"] {
  --th-surface: #F5F5F7;        /* Bone */
  --th-surface-raised: #FFFFFF;
  --th-ink: #0E0E10;            /* Obsidian */
  --th-ink-muted: #5A5A66;
  --th-line: #E2E2E8;
  --th-accent: #E8FF47;         /* Voltage */
  --th-accent-ink: #353D00;     /* Forest */
}

[data-theme="dark"] {
  --th-surface: #0E0E10;
  --th-surface-raised: #1A1A1F; /* Graphite */
  --th-ink: #F0F0F2;            /* Chalk */
  --th-ink-muted: #8A8A99;      /* Ash */
  --th-line: #2C2C35;           /* Iron */
  --th-accent: #E8FF47;
  --th-accent-ink: #E8FF47;
}
```

### The contrast rule that makes light mode work

**Voltage `#E8FF47` on Bone `#F5F5F7` is about 1.1:1. It is invisible.** `DESIGN.md` demands ≥7:1 for body and ≥4.5:1 for large text, so Voltage can never be accent *text* on a light ground.

The palette already solves this: **`--color-forest: #353D00`** is roughly 10:1 on Bone.

So in light mode:

- **Voltage is a fill only**, always with Obsidian text on it (~15:1). Buttons, badges, highlight blocks.
- **Forest is the accent ink** — links, small caps labels, icons, focus rings, active borders.
- In dark mode both collapse back to Voltage, exactly as today.

This is the single rule that determines whether light mode looks designed or broken. Put it in `DESIGN.md`.

Verify every new pairing at WebAIM before shipping it, per `DESIGN.md`.

## 1.4 — Theme switching

**Default light.** An explicit choice wins; there is no `prefers-color-scheme` fallback. That is deliberate — the user asked for light by default, and honouring the OS would make the default unpredictable. Note it in the spec so nobody "fixes" it later.

**Persist in a cookie, not `localStorage`.** The layout is a Server Component, so a cookie can be read during SSR and `data-theme` rendered onto `<html>` directly — no flash of the wrong theme, no blocking inline script, no `suppressHydrationWarning`. `localStorage` cannot do this without a flash.

The toggle is a small Client Component that writes the cookie and refreshes. Give it an accessible label ("Switch to dark theme") and a `:focus-visible` ring per the `DESIGN.md` standard.

## 1.5 — Public header and footer

**Header:** logo, nav (Pricing, Guides, About), theme toggle, and a Sign in / Get started pair. On mobile, collapse to a sheet — `DESIGN.md` mobile rules apply, and the ≤480px breakpoint is already a known weak spot.

**Footer**, four columns, matching the reference layout but **only linking pages that exist after PR 2**:

| Brand | Product | Guides | Company & legal |
|---|---|---|---|
| Logo, one-line tagline, "Made in Nigeria 🇳🇬" | Pricing, About | For builders, For testers, Get started | Contact, Privacy policy, Terms of service, Sign in |

No Features, Download or Blog. Add them when those pages exist.

## 1.6 — One thing to raise before building

`DESIGN.md` mandates **DM Mono for all body text**. That is a strong, good choice inside a developer tool's UI. Across long marketing prose — a pricing page, an about page, two guides — monospace body copy is materially harder to read and will make the pages feel heavier than the reference.

**Do not change it unilaterally.** Flag it in the spec and offer the option: keep DM Mono everywhere (consistent, distinctive), or keep Syne headings + DM Mono for UI/labels/code and introduce one readable sans for long-form public prose only. Let the user decide.

---

# PR 2 — Public pages

**Branch:** `feat/public-pages`
**Base:** `main` with PR 1 merged
**Migration:** none

Every page built on PR 1's tokens, correct in both themes, responsive to 360px.

## 2.1 — `/pricing`

Content comes from **`docs/Twnhall_Monetisation_Plan_v4.docx`** (also in the project as `claude/Twnhall_v2_Change_Decisions.md`'s sibling doc). Read it before writing copy.

| | Community — Free | Pro — $19/mo · ₦10–12k |
|---|---|---|
| Projects | Unlimited | Unlimited |
| **Tester reports per month** | **5** | **20** |
| Earn extra reports by testing | +1 per report you complete | Same |
| Testers per mission | Up to 5 | Up to 8 |
| Active missions at once | 2 | 5 |
| AI insights | 3/month | Unlimited |
| CSV export | ✓ | ✓ |
| Shareable report | — | ✓ |
| Priority in the tester queue | — | ✓ |

**Critical — there is no checkout.** Per the plan's Phase 2, the Pro call-to-action opens a conversation, not a payment form. Label it honestly: *"Hitting your limit? Get in touch"* → `/contact`. **Do not build a Subscribe button that goes nowhere** — a dead checkout is worse than an honest one.

Use the plan's vocabulary exactly: **tester report** (one real person tests your product and writes up what they found), **testers per mission**, **active missions**. Include the one-line gloss for each; the plan §2 has the wording.

Add a short note explaining the 5-testers-per-mission rule as methodology, not rationing — the Nielsen Norman Group finding that five people surface ~85% of usability problems. The plan §5 has the framing and the caveat.

## 2.2 — `/guides/builder` and `/guides/tester`

**Written from scratch.** `/guidelines` predates the v2 testing model and describes a product that no longer exists.

**Builder guide** covers: creating a project (category, two-sentence summary), the three test categories (Process Flow, Component, UI Design), building a test case from a template or from scratch, device targets, how many testers to ask for and why, reading an audit log, what pass/fail/blocked mean, reviewing and rating.

**Tester guide** covers: what a mission is, how to read the builder's test case, filling the audit log per step, when a step is pass vs fail vs blocked, what "actual result / summary of the issue / steps to reproduce" each want, screenshot guidance, what makes a report useful enough to be rated well.

Source of truth for behaviour is the code, not the old page — particularly `auditEntrySchema` in `lib/validation/schemas.ts` for which fields each status owes. Get that right; a guide that contradicts the form is worse than no guide.

Add a `/guides` index linking both. Redirect `/guidelines` → `/guides` permanently; update `lib/access.ts`'s public list and `app/sitemap.js`.

## 2.3 — `/about` and `/contact`

**About:** what Twnhall is, who it is for, the reciprocal model, the trained tester cohort, Nigerian-built. Short.

**Contact:** the footer links to it and PR 2's pricing CTA depends on it. A simple form or a mailto plus whatever channel is actually monitored. **Make sure someone reads wherever this goes** — the Pro upgrade path runs through it.

## 2.4 — Routing

Add `/pricing`, `/guides`, `/guides/builder`, `/guides/tester`, `/about`, `/contact` to the public list in `lib/access.ts`. Confirm `middleware.ts` lets a **logged-in** user reach them — it currently bounces authenticated users from `/` to `/explore`, and that must not extend to the marketing pages. Extend `scripts/access.test.mts`.

Update `app/sitemap.js` and `app/robots.js`.

---

# PR 3 — Email and password auth

**Branch:** `feat/email-password-auth`
**Base:** `main` with PR 2 merged
**Migration:** none expected — Supabase owns this state
**Risk:** high — touches the auth invariant the whole app rests on

## 3.1 — Name collision, settle it first

**`app/verify/[role]/` already exists** and means "complete your role profile." It is not email verification.

The new page must **not** live under `/verify`. Use **`/confirm-email`**. Two gates with near-identical names is how someone eventually wires the wrong one. Say so in the spec.

## 3.2 — The gate chain

Current order, from `app/api/auth/callback/route.ts` and `middleware.ts`:

```
auth → profile upsert → terms gate → choose-account → per-role verification → dashboard
```

Email confirmation inserts **first**, before terms:

```
auth → email confirmed? → profile upsert → terms → choose-account → per-role verification → dashboard
```

**Supabase's `email_confirmed_at` is the source of truth.** Do not add a column; the `accepted_terms_at` / `verification_completed_at` pattern does not apply here because Supabase already owns this state.

**The 36 existing Google users are unaffected** — OAuth sets `email_confirmed_at` at first sign-in. Verify that against the live database before shipping, and say what you found.

## 3.3 — Identity linking, the part most likely to break

A person signs up with `alice@gmail.com` and a password. Later they click "Continue with Google" with the same address.

Supabase can link these into one user, but the behaviour depends on project settings and on whether the email was confirmed. **Get this explicitly right rather than discovering it in production:**

- Linking must happen **only when the email is confirmed.** An unconfirmed password account claiming a Google address is an account-takeover path — anyone can type someone else's address at signup.
- `CLAUDE.md`'s invariant — *"one person cannot hold two identities"* — depends on the unique email constraint. Email/password preserves it, but **verify that, don't assume it.**
- Check the Supabase Auth settings for automatic identity linking, report what they are, and state in the spec what happens in each of the four cases: password-first-then-Google (confirmed / unconfirmed), and Google-first-then-password.

This deserves its own test and its own paragraph in the spec.

## 3.4 — Sign up, sign in, reset

**Sign up** (`/signup`): full name, email, password (min 8), confirm password. Google button above an "or with email" divider. `full_name` must go into `user_metadata` at `signUp()` so the existing callback upsert picks it up unchanged — read that upsert before writing this.

*(Skip the Cloudflare Turnstile shown in the reference. Note in the spec that email signup is spammable and the confirmation gate is currently the only defence; Supabase's built-in rate limits help but are not a bot check. Worth revisiting.)*

**Sign in** (`/login`): Google, divider, email + password, "Forgot password?", link to signup. One page for everyone — no builder/tester split.

**Password reset:** `/forgot-password` and `/reset-password` via Supabase's recovery flow. The reference shows the link, so the pages have to exist.

**Validation** in `lib/validation/schemas.ts` per `CLAUDE.md`. Heed the rule that **a form's control names must match its schema keys** — `useFocusFirstError` and `FieldError` both resolve by that string, and `SettingsForm` is the cautionary tale. And **do not disable the submit button** to express "not ready"; validate on click and name the missing field.

## 3.5 — `/confirm-email`

Holding page: "We sent a link to `<email>`", a **Resend** button, and "Wrong address? Sign out and register again."

**The resend button needs a cooldown** — 60 seconds, disabled with a visible countdown. Without one it is an email-bomb button pointed at whatever address someone typed.

Confirmation lands on a success page, then continues into the terms gate.

Drop the reference's "I've verified — continue" button unless you have a reason for it: it invites clicking before the email is read, and the confirmation link already returns the user to the app.

## 3.6 — Branded confirmation email — an infrastructure note

The reference shows a branded email from `verify@task2k.com`. **That does not come from your `emails/` React Email templates.** Supabase Auth sends confirmation mail through its own SMTP with its own templates.

To brand it you must configure **Supabase Auth SMTP to use Resend** and edit the templates in the Supabase dashboard. Your Resend account and domain already exist, so this is configuration, not code — but it is a step that is easy to miss and it lives outside the repo. Document it in the spec and in the README's env section.

## 3.7 — Avatars

`app/api/auth/callback/route.ts` reads `avatar_url` from Google metadata. Email/password users have none, and `CLAUDE.md` is explicit that **the `avatars` bucket does not exist** and Twnhall stores no images for this.

So: render an **initials avatar** from `full_name` wherever `avatar_url` is null. Do not create a bucket, do not add upload. Find every surface that renders an avatar and make it handle null — the sidebar, admin users, any submission byline.

## 3.8 — Tests

- Signup: happy path, duplicate email, weak password, mismatched confirmation.
- Sign-in: wrong password, unconfirmed email (must be blocked at the gate).
- Every branch of §3.3's linking matrix.
- Resend cooldown enforced server-side, not only in the UI.
- A null `avatar_url` renders initials everywhere.
- Existing Google users are unaffected by the new gate.
- Extend `scripts/access.test.mts` for the new public and gate routes.

---

## After all three PRs

- **`CLAUDE.md`** — the surface rule (§1.1), the new public route group, the auth section's identity-linking behaviour, the `/confirm-email` vs `/verify/[role]` distinction.
- **`DESIGN.md`** — the semantic token set, the Voltage-fill / Forest-ink rule, the theme toggle, the public header and footer.
- **`README.md`** — the Supabase SMTP configuration step.
- **`TownHall_Checklist (1).xlsx`** — QA rows for theme persistence across reload, both themes on every public page, signup, confirmation, resend cooldown, password reset, and Google/password linking.

## Known debt — do not fix in these PRs

Mobile ≤480px beyond the new pages, dashboard theming, the engineer test suite at 0/46, back-button-after-logout. All logged, all out of scope here.

One thing worth saying in the PR description: the public pages will now look considerably better than the dashboard behind them. That gap is expected at this stage and closes when dashboard theming lands — but it is worth knowing before you show anyone.
