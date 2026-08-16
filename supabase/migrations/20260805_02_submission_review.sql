-- Builder review of tester submissions (approve / request changes / rate).
--
-- The rating lives on the submission rather than in a ratings table: a rating
-- is 1:1 with a submission, so a join table would carry a foreign key and
-- nothing else. A tester's average rating is avg(rating) over their rated rows.
--
-- Existing rows take status='pending' from the column default. That is a
-- default on a new column, not a rewrite — but it does mean the 19 existing
-- submissions surface to testers as "Pending Review", since no builder has
-- reviewed them.
--
-- Safe to run more than once.

alter table public.test_results
  add column if not exists status text not null default 'pending',
  add column if not exists rating int,
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  alter table public.test_results
    add constraint test_results_status_check
    check (status in ('pending', 'approved', 'changes_requested', 'paid'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.test_results
    add constraint test_results_rating_check
    check (rating is null or rating between 1 and 5);
exception
  when duplicate_object then null;
end $$;

-- Drives the tester's "My Submissions" feed and every earnings/reputation
-- aggregate on Tester Home, all of which filter by (tester_id, status).
create index if not exists test_results_tester_status_idx
  on public.test_results(tester_id, status);
