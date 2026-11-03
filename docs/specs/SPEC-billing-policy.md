# SPEC: Billing, Refund and Delivery Policy

**Status:** Ready to build — B1–B11 decided 3 Nov 2026 (§1). Before merge, a Nigerian lawyer reads §2–§4's final text and an accountant confirms B6 and B7.
**Branch:** `feat/billing-policy`
**Base:** `main`, after `feat/merchant-identity` (PR 1) **and** `feat/paid-report-carryover` (PR 2) merge. The policy names the merchant and promises the carry-over, so both have to be true first.
**Source:** `docs/TWNHALL_PAYSTACK_MSA_PROMPT.md`, PR 3; `docs/Twnhall_Paystack_MSA_Review.md` §2.1–§2.4, §3.2
**Migration:** none
**New dependency:** none
**New env var:** none
**Risk:** low in code, high in words. Everything here is copy and links,
and every sentence is a promise a customer can hold Twnhall to in a
dispute. Nothing may describe something the product doesn't do (CLAUDE.md,
"the pricing page's honesty").

## Summary

Paystack's MSA, Section B (Card payments), requires the website to carry:

- a **return and refund policy**
- a **delivery policy**
- a **consumer data protection policy**
- the merchant's name, contact and address (done in PR 1)

> "If you accept any recurring Transactions, the Cardholder must be informed
> about how to stop receiving the goods and or services and discontinue the
> Charges."

Section E §1 says the merchant is "solely responsible for disclosing to
Customers that Paystack processes Transactions for you and may receive Personal
Data from you about the Customers", and affirms compliance with the NDPA.
Section D §3 says refunds are the merchant's to handle.

Twnhall has none of this.

- `/terms` says only that paid plans "are arranged with us directly; there is no
  checkout."
- `/privacy` doesn't mention billing records, Paystack, the legal basis for
  processing, international transfers or the right to complain to the NDPC.
- No page says what happens if a builder pays and testers don't deliver.

**This PR:**

1. Adds **`/refunds`**, the Billing and Refund Policy, as a fifth long document
   in `lib/docNav.ts`.
2. Gives `/terms` a **Paid Plans** section that makes `/refunds` part of the
   terms.
3. Brings `/privacy` up to what the MSA and the NDPA expect.
4. Links all of it from `/pricing`, the plan section in `/settings`, the
   footer and the sitemap.
5. Rewrites `CLAUDE.md`'s **Payments** rule with the MSA guardrails any future
   checkout must meet.

## §0 — Verified before writing this

- Paid plans have **no automatic renewal today**. An admin records each period
  through the plan dialog. The daily cron lapses an `active` subscription past
  `period_end` to Community, and emails the builder and admins three days
  before (`app/api/cron/daily/route.ts`, steps `expired` and `reminded`).
  "Your plan doesn't renew by itself" is therefore true today. A recurring
  checkout would make it false, which is why §6 binds that future PR.
- `subscriptions` stores `amount_ngn`, `payment_reference`, `period_start` and
  `period_end`. Its rows outlive account deletion (`account_id` is
  `on delete set null`, `profile_id` has no FK). `/privacy` says neither.
- `/privacy` § Deletion says deletion removes "projects, test cases,
  submissions, screenshots, ratings, and reputation". Billing records stay, so
  the page has to say they do.
- `lib/docNav.ts` holds four documents. `docNav.test.ts` fails on drift between
  a page and its list. CLAUDE.md says "no switcher across the four documents,
  by decision". That stays true for five.
- `components/public/__tests__/pricing.test.ts` asserts `/pricing` "writes no
  price of its own". `/refunds` follows the same rule and prints prices through
  `priceLine()` from `lib/plans.ts`.
- `app/sitemap.js` dates the legal pages `2026-05-25`; both pages say "Last
  updated: October 13, 2026". Fix this here.
- `PublicFooter`'s rule: "Never add an entry before its destination exists."
  The link and the page ship in the same commit.

## §1 — Decisions

Claude Code: if any decision below isn't marked decided, **stop and ask**.
Don't pick.

**Decided by the owner, 3 Nov 2026:** B1 is **(b), a Paystack payment link**.
B2–B11 are **as recommended**. B6 and B7 still need the accountant's
confirmation before merge.

**Supabase region:** `eu-west-1`, Ireland (EU). The owner named Ireland, and
the database host's address sits in AWS's published `eu-west-1` range.

| # | Decision | Recommendation |
|---|---|---|
| **B1** | **How do builders pay today?** (a) bank transfer to the business account, (b) a Paystack payment link or invoice, (c) both. | Whatever is true. **The Paystack lines in §4 and §5 ship only if (b) or (c).** If (a), they wait for the checkout PR, and §6's guardrail says so. |
| **B2** | **Change-of-mind refund window.** | **Full refund within 7 days of paying, provided no test case has been published using that period's reports.** |
| **B3** | **Partial refunds for cancelling mid-period.** | **No.** The plan runs to the end of the paid period. B4 and B5 are the exceptions. |
| **B4** | **Always refunded, in full:** duplicate charge, wrong amount, a plan paid for but never applied, a charge after cancelling. | **Yes, all four.** |
| **B5** | **If Twnhall ends a paid plan early** (closes the account for a reason other than a breach, or stops offering the plan). | **Refund the unused part of the period, pro rata by day.** |
| **B6** | **Taxes.** | *"Prices are in naira and include any tax we're required to charge."* **Accountant to confirm** VAT status before merge. |
| **B7** | **How long billing records are kept after an account is deleted.** | **6 years.** Nigerian tax law expects records kept about that long; accountant to confirm the number. |
| **B8** | **Telling existing users the terms changed.** | **Email every builder through the admin broadcast on the day it ships. No re-acceptance:** `accepted_terms_at` stays as it is. The change adds paid-plan terms and makes no existing obligation heavier. |
| **B9** | **Minimum age to buy a paid plan.** | **18.** A payment is a contract. Whether the free tier needs an age floor too is a separate question for the lawyer, not this PR. |
| **B10** | **Notice before a price change.** | **30 days by email, and never mid-period.** |
| **B11** | **Response times the page promises.** | **Reply within one business day; start an agreed refund within two.** Only promise what someone can keep. Paystack gives the merchant **16 hours** to answer a chargeback, so somebody watches that inbox anyway. |

## §2 — `/refunds`: the Billing and Refund Policy

**Route:** `app/(public)/refunds/page.tsx`, in `DocLayout` like `/terms`, with
`metadata.title` set to `"Billing and Refund Policy — Twnhall"`.

**`lib/docNav.ts`:** a fifth entry. Ids are written out, never slugged,
because they end up in shared links (the refund link in an email points at
`#refunds`).

```ts
{
  slug: "refunds",
  href: "/refunds",
  numbered: true,
  sections: [
    { id: "who", title: "Who You're Paying" },
    { id: "what", title: "What You're Buying" },
    { id: "paying", title: "Prices and Payment" },
    { id: "renewal", title: "Billing Periods and Renewal" },
    { id: "delivery", title: "How Reports Are Delivered" },
    { id: "undelivered", title: "Reports You Paid For but Didn't Receive" },
    { id: "cancel", title: "Cancelling" },
    { id: "refunds", title: "Refunds" },
    { id: "disputes", title: "If Something's Wrong with a Charge" },
    { id: "changes", title: "Changes to Prices and This Policy" },
    { id: "contact", title: "Contact" },
  ],
},
```

**Copy, section by section.** Hold this to the house voice: second person,
short sentences, no "hereinafter". `{…}` means read it from code, never write
it out. *[B#]* marks text that depends on a decision.

1. **Who You're Paying.** `{legalLine()}` Starter and Pro are sold by
   `{MERCHANT.legalName}`. We are responsible for the service you buy, for
   support, and for refunds. *[B1 b/c:]* Payments are processed by Paystack. We
   never see or store your card number or security code.

2. **What You're Buying.** A paid plan gives you a number of **tester reports**
   each calendar month (Lagos time). A tester report is one real person testing
   your product against your test case and sending you a structured report:
   what they did, what broke, and screenshots. Then, for each paid plan from
   `PLANS`:
   - `{plan.name}`: `{priceLine(plan)}`, `{plan.monthlyReports}` tester reports
     a month, `{plan.activeMissions}` active test cases at once.

   Everything else a plan includes is on [Pricing](/pricing).

3. **Prices and Payment.** Prices are in naira. *[B6]* They include any tax
   we're required to charge. **We never add a card or processing fee on top.**
   You pay in advance for each billing period. *[B1]* We agree your plan by
   email, then send you `{a Paystack payment link | our bank details}`. Your
   plan starts once the payment arrives, and we email you to confirm it, with
   the date the period ends.

4. **Billing Periods and Renewal.** A billing period is one month from the day
   your plan starts, unless we agree another length in writing. **Your plan
   doesn't renew by itself.** Three days before a period ends we email you. If
   you want another period, get in touch and we'll send the next payment
   request. If you do nothing, the plan ends on its end date and the account
   moves to Community. Test cases already live keep the testers they have.
   *(Not "reply": that email comes from the notifications address, and its
   button already goes to `/contact`.)*

5. **How Reports Are Delivered.** Everything you buy is delivered online,
   inside Twnhall. A report is delivered when a tester submits it to your test
   case. It appears on the test case's page, and we email you when it arrives.
   Reports arrive as testers complete them. **We don't promise a turnaround
   time.** A test case is open to up to five testers, and you can close it
   early and keep everything that came in. Nothing physical is shipped.

6. **Reports You Paid For but Didn't Receive.** If testers don't deliver every
   report a test case was open to, the reports you didn't receive are never
   lost. Close the test case and they come back to your balance. If the month
   they came from has already ended, they come back as **carried reports**,
   which don't expire and stay yours on any plan. Monthly reports you never
   publish on a test case expire at the end of the month, as [Pricing](/pricing)
   explains. If you close a test case on the last day of a month, its reports
   come back to that month.

7. **Cancelling.** You don't need to cancel: a plan that isn't renewed ends on
   its own. To stop a plan early, or to move to a smaller one, email
   `{MERCHANT.supportEmail}` from your account's email address. We confirm by
   email. Your plan runs to the end of the period you've paid for, and you
   won't be asked to pay again. *[B3]* We don't refund the rest of a period you
   cancel part-way through, except as described under Refunds.

8. **Refunds.** You can have a full refund:
   - *[B2]* within 7 days of paying, if you haven't published a test case using
     that period's reports;
   - *[B4]* if you were charged twice, charged the wrong amount, paid for a plan
     that was never applied to your account, or charged after you cancelled;
   - *[B5]* for the unused part of a period, by day, if we close your account
     for a reason other than a breach of our [Terms](/terms), or stop offering
     your plan.

   To ask, email `{MERCHANT.supportEmail}` from your account's email address
   with the payment's date and amount. *[B11]* We reply within one business day. Once a
   refund is agreed, we start it within two business days, to the card or
   account you paid from. How long it then takes to reach you depends on your
   bank. We refund the full amount you paid.

9. **If Something's Wrong with a Charge.** Please email us before disputing a
   charge with your bank. We answer within one business day, and most problems
   are fixed faster that way than through a dispute. If you do dispute a charge,
   we'll give your bank or card issuer the record of what was delivered: which
   test cases you published, when, and when each report arrived. Testers appear
   in it only as "Tester 1", "Tester 2" and so on.

10. **Changes to Prices and This Policy.** *[B10]* We give you at least
    30 days' notice by email before a price change affects you, and never change
    the price of a period you've already paid for. Changes to this policy are
    posted here with a new date. A change that's worse for you applies only from
    your next billing period.

11. **Contact.** `{MERCHANT.supportEmail}` · `{addressLine()}` ·
    `{MERCHANT.phone}` if set.

"Last updated" at the top is the merge date.

## §3 — `/terms`

- **New section `paid-plans`, "Paid Plans"**, in `lib/docNav.ts` between
  `missions` and `ratings`. The numbering shifts, which is fine: the numbers are
  positions, and the ids don't move.
  > Starter and Pro are paid plans sold by `{MERCHANT.legalName}` at the prices
  > on our [Pricing](/pricing) page. *[B9]* You must be 18 or older to buy one.
  > A paid plan adds a monthly allowance of tester reports, as Pricing
  > describes. We don't promise how quickly reports arrive. Our [Billing and
  > Refund Policy](/refunds) is part of these terms. It covers how you pay,
  > billing periods, delivery, reports you paid for but didn't receive,
  > cancelling and refunds. *[B1 b/c]* Payments are processed by Paystack, and
  > we never store your card details. *[B6]* Prices include any tax we're
  > required to charge.
- **`missions`**: "Starter and Pro add a monthly allowance and are arranged
  with us directly; there is no checkout." becomes "Starter and Pro add a
  monthly allowance; see Paid Plans."
- **`termination`**: add "If we close an account on a paid plan for a reason
  other than a breach of these terms, we refund the unused part of its period
  (see our Billing and Refund Policy)."
- **`updates`**: add "We email you before a change to these terms or to our
  Billing and Refund Policy takes effect."
- **"Last updated"**: the merge date.

## §4 — `/privacy`

New sections go into `lib/docNav.ts` (privacy is unnumbered). The order
becomes: `collect`, `automated-analysis`, `visibility`, `providers`,
**`transfers`**, `analytics`, `use`, **`legal-basis`**, `sharing`, `security`,
**`rights`**, `deletion`, `changes`, `contact`.

- **`collect`**: a new paragraph:
  > **Billing Information:** if you buy Starter or Pro, we keep a record of
  > each billing period: the plan, its start and end dates, the amount you
  > paid, the payment reference, and how you paid. *[B1 b/c]* When you pay by
  > card, Paystack collects your card details. We never see or store your card
  > number or security code.
- **`providers`**: *[B1 b/c]* add a line:
  > **Paystack:** processes payments for Starter and Pro. Paystack receives
  > what it needs to take a payment, including your name, email address and
  > payment details, and handles them under its own privacy policy.

  This is the MSA Section E §1 disclosure.
- **`transfers`, "Where Your Data Is Processed"** (new):
  > Some of the providers above process data outside Nigeria. We use them under
  > contracts that require them to protect it.

  Then name where. **The implementer checks the Supabase project's region in
  the Supabase dashboard and writes it in.** Don't guess. Vercel, Google,
  Resend and Cloudflare run globally.
- **`legal-basis`, "Why We're Allowed to Use Your Information"** (new): one line
  each.
  - **Contract**: running your account and any plan you buy.
  - **Legitimate interests**: security, preventing abuse, counting visits
    first-party, improving the service.
  - **Legal obligation**: keeping billing records.
  - **Consent**: where we ask for it. You can withdraw it.
- **`rights`, "Your Rights"** (new): under the NDPA you can ask us to:
  - give you a copy of your data;
  - correct it;
  - delete it;
  - stop or limit how we use it;
  - send it to you in a format you can reuse;
  - withdraw any consent you gave.

  Email `{MERCHANT.supportEmail}`. If you're unhappy with our answer, you can
  complain to the Nigeria Data Protection Commission.
- **`deletion`**: add:
  > We keep billing records for *[B7]* six years after the period they cover,
  > even after you delete your account, because tax law requires it. Nothing
  > else about the account is kept.
- **`contact`**: from `MERCHANT` (done in PR 1).
- **"Last updated"**: the merge date.

## §5 — Links

- **`/pricing`**:
  - FAQ **"How do I pay for Starter or Pro?"**: rewrite to match B1. Keep "There
    is no checkout" while it's true. Add "Prices include any tax we're required
    to charge, and no card fee is added."
  - **New FAQ, "Can I cancel, or get a refund?"**: "Your plan doesn't renew by
    itself, so there's nothing to cancel unless you want to stop early. Refunds
    are in our [Billing and Refund Policy](/refunds)."
  - Add a "Billing and refunds" link to the `META` line under the plans.
  - The "writes no price of its own" test must still pass.
- **`components/settings/PlanSection.tsx`**: on a paid plan only, add one line
  above "Get in touch":
  > "Your plan doesn't renew by itself. Cancelling, refunds, and reports
  > testers didn't deliver: [Billing and refunds](/refunds)."

  It's a link to a policy, not a control. **Amend CLAUDE.md's "plan section's
  honesty" rule** to say it may also link the billing policy. That's the only
  addition, and the rest of the rule stands.
- **`PublicFooter.tsx`**: "Billing and refunds" → `/refunds`, in Company &
  legal, after Terms of service.
- **`app/sitemap.js`**: add `/refunds`. Set `legalLastModified` to the merge
  date, and fix its comment.
- **`lib/subscriptions.ts` → `planNotice()`**: the `start` and `extend` notices
  end with "Billing, cancelling and refunds: {site}/refunds". This is the
  confirmation a builder gets for each paid period, so it's the record a
  dispute is answered with.
- **Email (B8)**: draft the broadcast in the PR description. An admin sends it
  from `/admin` on the day it ships. The PR sends nothing.

## §6 — `CLAUDE.md`: the Payments rule, rewritten

Replace the **Payments** entry under *Do Not Touch* with the current rule plus
the MSA guardrails. A future checkout PR **must** meet these, and the next
person to build one reads them here:

> - **Payments** — money moves in **one direction only: builders pay
>   `{legalName}` for a plan** (decided 27 Oct 2026). Nothing pays out through
>   the product (the cohort is paid by bank transfer from `/admin/payouts`'
>   CSV). Never reintroduce a payout field, money balance, wallet,
>   tester-facing earnings or `paid` state. When Paystack is wired in, the
>   Merchant Services Agreement binds the code
>   (`docs/Twnhall_Paystack_MSA_Review.md`):
>   - **No payment aggregation.** No split payments, subaccounts or "pay a
>     tester" flows through Twnhall's Paystack account. MSA Section B makes
>     this a material breach with immediate termination.
>   - **Prices are what the customer pays.** Never enable Paystack's "pass
>     fees to customers", and never add a surcharge (card scheme rule, MSA
>     Section B). Fees come out of margin.
>   - **Card data never touches Twnhall.** Use Paystack's hosted checkout or
>     Popup only: no card fields in the app, and never store a card number or
>     CVV (MSA Section E §3).
>   - **The secret key is server-only.** `PAYSTACK_SECRET_KEY`, never
>     `NEXT_PUBLIC_`. Only the public key may reach the browser (MSA Section C).
>   - **The webhook verifies before it writes.** HMAC-SHA512 of the raw body
>     against `x-paystack-signature`, then idempotency on the reference, then
>     `applyProviderEvent()`, which stays the only entry.
>   - **Recurring billing ships with its off switch.** If Paystack
>     Subscriptions are used, the same PR adds a self-serve cancel that also
>     disables the Paystack subscription, and rewrites `/refunds` §Renewal
>     (MSA Section B: the cardholder must be told how to stop the charges).
>     Paystack's own Dispute Policy cites "a cancelled subscription that was
>     still charged".
>   - **`/privacy` names Paystack before the first Paystack payment**, of any
>     kind (MSA Section E §1).
>
>   Until a checkout ships, no card or bank details are collected anywhere in
>   the app.

Also update the long-documents paragraph from "the four documents" to five, and
the plan-section honesty rule (§5).

## §7 — Tests

- **`components/public/__tests__/docNav.test.ts`**: passes with the fifth
  document and the new sections.
- **`components/public/__tests__/refunds.test.ts`** (new). Render `/refunds`
  and check that it:
  - contains `priceLine()` for every paid plan;
  - contains `MERCHANT.legalName` and `MERCHANT.supportEmail`;
  - has links to `/pricing` and `/terms`;
  - contains no `₦` or `$` digit in its source, and no "Subscribe" or "Upgrade"
    (the honesty rule);
  - contains no "Paystack" unless B1 is (b) or (c). Hard-code the expectation
    to the decided B1.
- **`/terms`**:
  - contains a link to `/refunds`;
  - no longer contains "there is no checkout" in the `missions` section.
- **`/privacy`**:
  - contains "Nigeria Data Protection Commission" and the B7 retention text;
  - mentions Paystack only per B1.
- **`pricing.test.ts`**:
  - the cancel/refund FAQ links `/refunds`;
  - still writes no price of its own.
- **`PlanSection`**:
  - a paid plan shows the `/refunds` link and Community doesn't;
  - still no "Upgrade" or "Subscribe".
- **`footer.test.ts`** (from PR 1): links `/refunds`.
- **`lib/__tests__/subscriptions.test.ts`**: `planNotice("start" | "extend")`
  ends with the `/refunds` line.
- **Sitemap**: includes `/refunds`.

## Acceptance criteria

1. `/refunds` is reachable from the footer, `/pricing`, `/terms`, a paid
   builder's `/settings`, and the plan-confirmation email.
2. Every price on `/refunds` matches `/pricing` character for character.
3. Every decision-dependent sentence matches its decided value. No sentence
   describes a checkout, automatic renewal or turnaround promise that doesn't
   exist.
4. `/privacy` names the controller, the legal bases, the transfers, the rights
   and the NDPC, and says how long billing records are kept.
5. A lawyer has read §2–§4's final text (the owner confirms in the PR).
6. All four gates pass.

## Commit sequence

1. `docs(spec): billing, refund and delivery policy`
2. `feat(legal): the billing and refund policy page`
3. `feat(legal): paid plans in the terms`
4. `feat(legal): billing records, legal basis, transfers and rights in privacy`
5. `feat(public): link the policy from pricing, settings, footer and sitemap`
6. `feat(mail): plan confirmations link the policy`
7. `test(legal): the policy says only what is true`
8. `docs: the payments rule under the Paystack MSA`

## Out of scope

- The checkout itself, and recurring billing. §6 is what they must meet.
- Registering with the NDPC, VAT registration, and the Paystack account. These
  are the owner's tasks, listed in the prompt.
- An age gate on the free tier (lawyer question, B9).
- Rewriting the Terms' liability section. Nigerian consumer-protection law may
  limit a blanket exclusion; ask the lawyer when they read §3.
