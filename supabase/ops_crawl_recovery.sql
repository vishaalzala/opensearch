-- OpenSearch crawler lease recovery and one-call admin counts.
-- Already applied to production on 2026-10-24. Idempotent for new databases.
alter table public.crawl_queue
 add column if not exists claimed_at timestamptz;

create index if not exists crawl_queue_claimed_idx
 on public.crawl_queue(job_id,status,claimed_at) where status='processing';

create or replace function public.admin_overview_counts()
returns jsonb language sql stable security invoker set search_path = ''
as $$
select jsonb_build_object(
 'websites',(select count(*) from public.websites),
 'approved',(select count(*) from public.websites where status='approved'),
 'pendingWebsites',(select count(*) from public.websites where status='pending'),
 'pendingSitemaps',(select count(*) from public.website_sitemaps where status='pending'),
 'sitemaps',(select count(*) from public.website_sitemaps),
 'indexedPages',(select count(*) from public.search_pages where is_published=true),
 'allPages',(select count(*) from public.search_pages),
 'queuedJobs',(select count(*) from public.crawl_jobs where status='queued'),
 'runningJobs',(select count(*) from public.crawl_jobs where status='running'),
 'failedJobs',(select count(*) from public.crawl_jobs where status='failed'),
 'completedJobs',(select count(*) from public.crawl_jobs where status='completed'),
 'failedUrls',(select count(*) from public.crawl_queue where status='failed')
)
$$;

revoke all on function public.admin_overview_counts() from public,anon,authenticated;
grant execute on function public.admin_overview_counts() to service_role;
