-- Let testers read their own submissions.
--
-- Today testers have INSERT but no SELECT on test_results (see the comment in
-- actions/submissions.ts explaining why the insert generates its own id rather
-- than using a returning select). That makes "My Submissions" on Tester Home
-- impossible to render, so this is the one RLS change the split requires.
--
-- Deliberately NOT added: an UPDATE policy for builders reviewing submissions.
-- RLS cannot restrict which columns an update touches, so a builder UPDATE
-- policy would also let a builder rewrite tester_comment. Review writes go
-- through createAdminClient() in actions/review.ts instead, which can restrict
-- the column set — matching how every other privileged write in this codebase
-- already works.
--
-- Safe to run more than once.

drop policy if exists "testers read own submissions" on public.test_results;

create policy "testers read own submissions"
  on public.test_results for select
  using (tester_id = auth.uid());
