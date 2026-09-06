-- Remove payments from the product.
--
-- Testing on Twnhall is reciprocal and unpaid. The payment machinery was
-- half-built and then reverted — commit_mission_credits and request_withdrawal
-- are already gone, and Withdraw was an inert button. This drops what remained
-- rather than leaving it dormant: a nullable payout_cents sitting unused is
-- exactly the thing someone wires back up later without knowing why it was
-- abandoned.
--
-- ── What this destroys, recorded here because the column will not survive ──
--
-- Four missions advertised a payout when this ran:
--
--   $12.00  Login & Sign Up Flow                  cc770987-135f-494e-b3a5-036ff62a9658
--    $8.00  General WishIT Mobile UI Experience   f0f34329-57f5-4f31-955d-dabd4c1f93a5
--    $6.00  Test functionality                    c352f3f1-9ab3-4b83-ba9e-fde7cab431a2
--    $1.00  Inventory Tracking                    2a62095c-ed0d-4fb8-9a17-943edc9c1363
--
-- The other 12 were already at 0. One submission was marked paid —
-- 6b3b7bbd-64e6-4f25-8dba-3f527ea22c27, on "Test functionality", reviewed
-- 2026-06-30 — and one more sat approved-but-unsettled on the same mission.
-- After this migration a collapsed paid row is indistinguishable from a
-- genuinely approved one, which is why the ids are written down here.
--
-- ── Order is load-bearing ────────────────────────────────────────────────
--
-- The UPDATE must precede the new CHECK, or the constraint fails to validate
-- against the existing paid row.
--
-- Not touched: test_results.rating / review_note / reviewed_at belong to the
-- review flow, not to payment. missions.load_test_at and testers_needed shipped
-- in the same migration as payout_cents (20260805_03) but are load-testing
-- columns and are unrelated. test_results_tester_status_idx stays — the feed
-- still filters by status, only the vocabulary narrowed.
--
-- Safe to run more than once.

-- ── 1. Collapse any paid submissions into approved ───────────────────────
update public.test_results
   set status = 'approved'
 where status = 'paid';

-- ── 2. Rewrite the status constraint without 'paid' ──────────────────────
alter table public.test_results
  drop constraint if exists test_results_status_check;

do $$
begin
  alter table public.test_results
    add constraint test_results_status_check
    check (status in ('pending', 'approved', 'changes_requested'));
exception
  when duplicate_object then null;
end $$;

-- ── 3. Drop the payout column and its constraint ─────────────────────────
alter table public.missions
  drop constraint if exists missions_payout_cents_check;

alter table public.missions
  drop column if exists payout_cents;
