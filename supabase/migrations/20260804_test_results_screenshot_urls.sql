-- Multiple screenshots per feedback submission.
--
-- Backward compatible by design:
--   * `screenshot_url` (the original single-URL column) is kept and still
--     written with the first image, so anything reading it keeps working.
--   * Existing rows are backfilled into the new array, so old single-screenshot
--     submissions render through the same code path as new ones.
--
-- Safe to run more than once.

alter table public.test_results
  add column if not exists screenshot_urls text[] not null default '{}';

update public.test_results
   set screenshot_urls = array[screenshot_url]
 where screenshot_url is not null
   and coalesce(array_length(screenshot_urls, 1), 0) = 0;
