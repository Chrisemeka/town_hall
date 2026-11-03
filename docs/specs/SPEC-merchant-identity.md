# SPEC: Merchant Identity

**Status:** Ready — §0 filled in by the owner, 3 Nov 2026. Twnhall is not registered; the site names the two people running it (§1's third case).
**Branch:** `feat/merchant-identity`
**Source:** `docs/TWNHALL_PAYSTACK_MSA_PROMPT.md`, PR 1; `docs/Twnhall_Paystack_MSA_Review.md` §2.1, §2.5
**Migration:** none
**New dependency:** none
**New env var:** none
**Risk:** low. One constant and the pages that print it. The only real way
this goes wrong is a placeholder reaching a public page, and §4's test
blocks that.

## Summary

Paystack's Merchant Services Agreement, Section B (Card payments), requires the
merchant's website to show, for every transaction:

> "Your official name, complete description of the goods sold or services
> offered, return and refund policy, customer service contact information,
> including email address and or telephone number, address, delivery policy,
> your consumer data protection policy …"

The point is that "the Cardholder must understand that you, the Merchant, is
responsible for the Transaction". Section A §1.1 adds that the statement
descriptor must be "recognizable to your Customers".

Today the public site names no legal entity and shows no address anywhere. The
only contact is `twnhallhq@gmail.com`. It is defined in `lib/contact.ts` and also
**hardcoded twice**: `/terms` line 131 and `/privacy` line 116.

This PR records **who Twnhall legally is** in one constant and prints it
wherever a customer looks for it: the footer, `/contact`, `/terms` and
`/privacy`. It writes no policy: the refund, delivery and billing text is
`SPEC-billing-policy.md` (PR 3), which reads from this constant.

## §0 — Owner inputs

Fill these in, then set Status to *Ready*. Claude Code: if any row is blank,
**stop and ask**. Never invent a name, number or address.

| # | Input | Value | Notes |
|---|---|---|---|
| O1 | Legal name | Awoniyi Amos and Anyanwu Chukwuemeka (not registered: the people running it) | Exactly as on the CAC certificate. If Twnhall isn't registered yet, see below. |
| O2 | Registration | none | RC for a company, BN for a registered business name. |
| O3 | Postal address | 23 Olatunji Idowu Street, off Alidada, Okota, Lagos State, Nigeria | Shown on every public page. A registered office, co-working or virtual-office address is fine. A home address is the owner's call. |
| O4 | Support email | `support@twnhall.com` (changed from `twnhallhq@gmail.com` on 4 Nov 2026) | A mailbox someone reads daily. A domain address (e.g. `support@twnhall.com`) reads as official to Paystack's compliance review; `twnhallhq@gmail.com` is legal but doesn't. Write "keep" to keep it. |
| O5 | Phone | `+2348127984934` | Optional: the MSA says email "and or" phone. E.164, e.g. `+2348012345678`, or "none". |
| O6 | Statement descriptor | `TWNHALL` | Set in the Paystack dashboard, not in code. Recorded here so the site and the bank statement use the same name. |

**If Twnhall isn't registered:** Paystack onboards it as a *Starter Business*
(₦8,000,000 collection limit, no Transfers). The site then names the person
running it, as in §1's third variant. Registering a business name with CAC
later is a change to O1/O2 and nothing else.

## §1 — One constant: `lib/merchant.ts`

```ts
// Who a customer is paying. Paystack's MSA (Section B, Card payments) requires
// the site to show the official name, a contact and an address for every
// transaction. Written by hand, never derived. Checked: <date>.
//
// Every public surface reads from here. A second copy anywhere fails
// lib/__tests__/merchant.test.ts.

export type Registration = { kind: "RC" | "BN"; number: string }

export const MERCHANT = {
  tradingName: "Twnhall",
  legalName: "…",                       // O1
  registration: null as Registration | null, // O2
  address: ["…", "Lagos", "Nigeria"],   // O3, one line per entry
  supportEmail: "…",                    // O4
  phone: null as string | null,         // O5, E.164
} as const

/** "12 Example Street, Lagos, Nigeria" */
export function addressLine(): string

/** The sentence that says who you are paying. */
export function legalLine(): string
```

`legalLine()` has three cases, and each one is tested:

| Case | Output |
|---|---|
| Registered, legal name differs from "Twnhall" | `Twnhall is a trading name of Acme Labs Ltd (RC 1234567), 12 Example Street, Lagos, Nigeria.` |
| Registered as "Twnhall" | `Twnhall (BN 1234567), 12 Example Street, Lagos, Nigeria.` |
| Not registered | `Twnhall is operated by Ada Obi, 12 Example Street, Lagos, Nigeria.` |

`lib/contact.ts` keeps exporting `CONTACT_EMAIL`, now set to
`MERCHANT.supportEmail`. That way `mailto()` and its callers (`/contact` and
`AllowanceNotice`) don't change.

The file stays pure and React-free, like `lib/docNav.ts`, so a node test can
import it.

## §2 — Where it renders

| Surface | Today | After |
|---|---|---|
| `components/public/PublicFooter.tsx`, bottom row | `© {year} Twnhall. All rights reserved.` | `© {year} {legalName}. All rights reserved.`, with `legalLine()` beneath it in the same muted 12px style. The bottom row is shared by both layouts, so this is one edit. |
| `/contact` | Email routes, the plain address, X | A third short block after the plain address: **"Write to us"**, then `addressLine()`, and **"Call us"** with a `tel:` link when `phone` is set. |
| `/terms`, opening paragraph | "Welcome to Twnhall, where…" | Add: *"These terms are an agreement between you and {legalName} ("Twnhall", "we", "us")."* A billing policy can only bind once the contracting party is named. |
| `/terms` § Contact | Hardcoded Gmail | `MERCHANT.supportEmail`, `addressLine()`, and the phone if set |
| `/privacy`, opening paragraph | — | Add: *"{legalName} is responsible for your personal data. Under the Nigeria Data Protection Act 2023, that makes us its data controller."* |
| `/privacy` § Contact Us | Hardcoded Gmail | As `/terms` |

Leave the "Last updated" lines alone here; PR 3 changes both pages
substantively and sets them then.

**Not in this PR:** the guides, `/pricing`, `/about`, emails. The Resend sender
(`FROM_NOTIFICATIONS` in `lib/mail.ts`) doesn't change.

## §3 — The statement descriptor (not code)

Set it in the Paystack dashboard when the account is activated, and make sure it
matches O6. Banks truncate long descriptors, so keep it short and identical to
the brand on the site. The legal name may differ, and the footer's
`legalLine()` is what connects the two for a customer looking at their
statement.

## §4 — Tests

**`lib/__tests__/merchant.test.ts`**

- No field is empty, and none contains a placeholder: `…`, `...`, `TODO`,
  `XXX`, `____`, `example`.
- `supportEmail` is a valid address. `phone` is null or matches
  `^\+234\d{10}$`.
- `legalLine()` produces each of §1's three cases, using fixture objects (the
  function takes an optional merchant argument that defaults to `MERCHANT`).
- **One copy only.** Read every `.ts`/`.tsx` file under `app/`, `components/`,
  `emails/` and `lib/` with `fs`, the same way `pricing.test.ts` "writes no
  price of its own". The literal support email, and the string `twnhallhq`,
  appear in `lib/merchant.ts` and nowhere else.

**`components/public/__tests__/footer.test.ts`** (new)

- `renderToStaticMarkup(PublicFooter)` contains `MERCHANT.legalName` and
  `addressLine()`.

**`/terms` and `/privacy`**

- Rendered with `renderToStaticMarkup`, both contain `MERCHANT.legalName` and
  `MERCHANT.supportEmail`.
- Neither contains `mailto:twnhallhq` (unless O4 is "keep"; then they contain it
  through the constant only).

## §5 — Docs

- **`CLAUDE.md`**: add a paragraph after "Prices are written, never computed":
  > **Who Twnhall is, legally, is one constant: `lib/merchant.ts`.** Paystack's
  > MSA requires the official name, a contact and the address on the site for
  > every transaction. The footer, `/contact`, `/terms` and `/privacy` read it,
  > and so does `/refunds` (PR 3). Never write the legal name, address or
  > support email anywhere else; `merchant.test.ts` fails on a second copy.
- **`TownHall_Checklist (1).xlsx`**: add QA rows for the footer legal line on
  phone and desktop, and the `/contact` address.

## Acceptance criteria

1. Every public page's footer shows the legal name and the address, on phone
   and desktop.
2. `/contact` shows the postal address, and the phone if one is set.
3. `/terms` and `/privacy` name the legal entity and read the support email from
   `MERCHANT`.
4. No hardcoded contact email remains outside `lib/merchant.ts`.
5. All four gates pass.

## Commit sequence

1. `docs(spec): merchant identity`
2. `feat(lib): the merchant constant`
3. `feat(public): the legal line in the footer, the address on contact`
4. `feat(legal): terms and privacy name the merchant`
5. `test(merchant): no placeholder, no second copy`
6. `docs: record the merchant constant`

## Out of scope

- Refund, delivery and billing text (PR 3).
- Registering the business, the Paystack account, and NDPC registration. These
  are the owner's tasks, listed in the prompt's checklist.
- Changing the Resend sending domain.
