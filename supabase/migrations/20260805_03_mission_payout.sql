-- Mission payout, category tag, and the real-human load-test window.
--
-- payout_cents = 0 means unpaid. All 11 existing missions stay unpaid and
-- render without a payout chip.
--
-- load_test_at is what makes a mission render as the distinct load-test card
-- type on Tester Home — deliberately separate from any simulated load-test
-- parameters, which are a different thing and must not be conflated here.
-- The rest of the load-test feature (builder scheduling form, tester opt-in
-- registration, reminders) is a separate phase; these two columns exist now
-- so the card type has something real to read.
--
-- Safe to run more than once.

alter table public.missions
  add column if not exists payout_cents   int not null default 0,
  add column if not exists category       text,
  add column if not exists load_test_at   timestamptz,
  add column if not exists testers_needed int;

do $$
begin
  alter table public.missions
    add constraint missions_payout_cents_check check (payout_cents >= 0);
exception
  when duplicate_object then null;
end $$;

-- ponytail: `category` is free text, no enum. It will drift into inconsistent
-- tags once there are enough missions to matter — swap to a check constraint or
-- a lookup table with a picker in the mission form at that point.
