-- OpenSearch forum-mode metadata. Applied to production 24 Oct 2026.
-- Idempotent and non-destructive; all existing entries default to standard websites/pages.
alter table public.websites add column if not exists site_type text not null default 'website';
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.websites'::regclass and conname='websites_site_type_check') then
  alter table public.websites add constraint websites_site_type_check check(site_type in ('website','forum'));
 end if;
end $$;
alter table public.search_pages add column if not exists page_type text not null default 'webpage';
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.search_pages'::regclass and conname='search_pages_page_type_check') then
  alter table public.search_pages add constraint search_pages_page_type_check check(page_type in ('webpage','forum_thread'));
 end if;
end $$;
-- No public table grants. Existing service-role backend and moderation remain authoritative.
