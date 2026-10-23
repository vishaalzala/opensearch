# OpenSearch Hybrid — Central Search MVP

OpenSearch is a community-reviewed website index using Next.js, Vercel, and Supabase. The live central index is the first phase of a planned local-first and peer-to-peer search project. WebRTC search and PWA/local indexing are **not yet implemented**.

## Submission modes

Both the public form at `/submit` and the administrator form at `/smartadmin/add-sitemap` accept:

| Input | What happens |
| --- | --- |
| Website HTTPS URL only | Domain is registered; after approval, crawl begins at its homepage and follows discovered same-site links |
| One or more HTTPS XML sitemaps only | Website is derived from the sitemap host; approved sitemaps are queued along with the homepage |
| Website + sitemap(s) | Homepage and all approved sitemap links are queued together |

- A submission needs **at least one** input. Sitemap URLs are optional, one per line (20 public / 30 admin).
- Website and sitemaps must share the exact HTTPS origin; `www` and non-`www` count as different origins. URLs with private IPs and localhost are rejected by validation.
- For existing websites, new sitemaps are appended without deleting previous approved records.
- Public visitors cannot approve submissions or start crawls. A new public website stays **pending**; new sitemaps for an already-approved site also stay **pending** until admin review.
- An already-registered website with no new sitemap produces a duplicate/already-registered confirmation rather than duplicating a database row.
- Admins approve directly via their authenticated account and may queue reindexing.

## Running and configuration

1. Configure a Supabase project containing `websites`, `website_sitemaps`, `search_pages`, `crawl_jobs`, `crawl_queue`, `admin_users` and the public submission quota function.
2. Configure Vercel environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), and `SESSION_SECRET` (secure long random value).
3. Configure Supabase Auth, verify admin email and grant access using the `admin_users` allowlist.
4. Cloudflare Turnstile can be configured using `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Public submissions are also server-rate-limited and always require approval.
5. Run `npm install`, `npm run typecheck`, and `npm run dev` locally, or deploy through the linked GitHub/Vercel integration.

## Indexing details and limitations

- Approved sitemap files and website homepages feed a bounded crawl queue.
- Pages are fetched and indexed into Supabase for keyword search. Sitemap-only and website-only submissions both use this same indexing pipeline.
- Sitemap URL indexes are supported; the parser expects uncompressed `.xml` and HTTPS. Compressed `.xml.gz` is **not supported**.
- Website-only crawling can discover pages linked from accessible HTML; it does not guarantee complete website coverage or discover every unlinked page.
- The current system limits queued URLs per job to 10,000, with requests processed in batches. The admin UI can process more than one batch, but indexing is **not yet a persistent autonomous background worker**.
- A valid production build does not demonstrate the crawl works for every external site. Some sites block automated fetches, redirect unexpectedly, or return non-HTML pages.
- Before wider deployment, expand crawler compliance with robots.txt and noindex, harden server-side URL/DNS handling against rebinding, and add backoff, retry, fair scheduling, and search quality tests.
- Supabase remains the master index; IndexedDB integration and WebRTC peer search are planned future phases.

## Security

- Never commit credentials or expose the service-role key in a `NEXT_PUBLIC_` variable.
- All administrator actions enforce Supabase Auth and the admin allowlist.
- Public submissions have rate limiting, optional Turnstile, and mandatory moderation.
- Peer-to-peer search is not enabled; no visitor device data is currently shared with peers.


## Background crawler operations

The independent worker is `GET /api/cron/crawl`. Vercel Cron invokes it hourly via `vercel.json` on plans that allow hourly scheduling. It is **fail-closed** until a strong `CRON_SECRET` is configured as an encrypted **Production** environment variable in Vercel. Vercel automatically supplies `Authorization: Bearer <CRON_SECRET>` to the scheduled request. Do **not** make this endpoint public or place the secret in `NEXT_PUBLIC_*`.

- The worker processes at most **three** queued requests on each tick, ordered by the least-recently-updated job. It does not run during search API requests.
- The existing authorised `/api/admin/crawl` and Crawl Monitor manual controls remain available unchanged.
- Interrupted `processing` records can be reclaimed after a 10-minute lease expiry (up to three attempts).
- Remote sites may return HTTP 403, non-HTML files or connection failures; those pages cannot safely be indexed and are reported under crawl errors.
- On Hobby plans, Vercel supports **daily**, not hourly, cron scheduling. Change the schedule to once daily if deploying on Hobby. Processing millions of pages needs a dedicated job queue / worker and higher rate and cost planning.
- The Vercel environment-variable connector previously returned a project-not-found error when attempting to configure the cron secret. Verify `CRON_SECRET` in the Vercel dashboard before claiming autonomous indexing is enabled.
- Scheduled processing uses isolated serverless function executions; it does not block home/search routes, but it still consumes function usage and database resources. Keep a low work budget until usage has been measured.

## Privacy copy

The public homepage says OpenSearch does not store search history in its application database or use IP addresses to build search profiles. Hosting and security providers may still process request metadata as needed for network delivery and abuse protection. Public form rate-limiting uses a keyed hash derived from the requesting IP address rather than saving its raw value in the quota table.
