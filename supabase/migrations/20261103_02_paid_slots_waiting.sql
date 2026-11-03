-- Dispute readiness: watch paid test cases waiting for testers
-- (docs/specs/SPEC-dispute-readiness.md §2).
--
-- A paying builder whose test case sits unfilled is the likeliest Paystack
-- dispute ("value not given"). unfilled_slots_ageing watches supply in
-- general after 7 days; this rule watches only paid slots (monthly and
-- carried — never the free signup grant), after 3, measured from the test
-- case's latest reservation. The measurement is lib/alerts/run.ts.
--
-- Seed only; safe to re-run. Rollback: delete the row.

insert into public.alert_rules (key, name, description, severity, threshold, window_minutes, cooldown_minutes) values
  ('paid_slots_waiting', 'Paid test case waiting',
   'A paying builder has waited this many days for testers. Find supply before it becomes a dispute.',
   'warning', 3, null, 1440)
on conflict (key) do nothing;
