# OpenSearch Hybrid — Phase 1 + local cache
A lightweight independent website search MVP. Google-style homepage, search, anonymous submission (Cloudflare Turnstile), manual approval and local IndexedDB query cache. Not yet peer-to-peer and not a full web crawler.

## Setup
1. Create a **new** Supabase project, separate from existing applications.
2. Run `supabase/schema.sql` in its SQL editor.
3. Copy `.env.example` to `.env.local`, set Supabase project URL and server-only `service_role` key, long unique ADMIN_PASSWORD (20+ chars), SESSION_SECRET (32+ chars), and Cloudflare Turnstile keys.
4. `npm install`, `npm run typecheck`, `npm run dev`.
5. Submit a URL on `/submit` and approve it on `/admin`, editing the title and description. Search its keywords on `/search?q=...`.
6. Deploy Next.js project to Vercel, setting the same variables in Vercel environment settings. Restrict admin and optionally use stronger authentication before wider deployment.

## Security and limitations
- Never place the service role key in `NEXT_PUBLIC_*`; the service role bypasses RLS. All database operations here are server-side.
- Public website metadata is **not fetched automatically** in this version: this avoids SSRF and unsafe crawler targets. An admin manually supplies title/description. Future crawlers must check public DNS, redirects and robots.txt and impose rate/size limits.
- Turnstile is required for public submission, and production should add edge rate limiting on `/api/submit`, `/api/admin/login` and `/api/search` (WAF, reverse proxy or provider rate limits).
- Admin starter uses a single environment password; enable stronger authentication/MFA before production. Avoid sharing the password.
- Cache uses IndexedDB. There is no real WebRTC peer discovery yet; local cached records may be stale and should not be treated as fresh. The master database is authoritative.
- Search is limited to titles, descriptions, URLs and tags for approved websites; not full-site crawling or Google-scale coverage.
- Do not upload private/security-sensitive content or expose private search histories. Only share public approved index records if peer sharing is added later.
