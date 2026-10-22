-- Run only in a NEW Supabase project. Never in WorkshopHQ.
create extension if not exists pgcrypto;
create table if not exists public.websites (
 id uuid primary key default gen_random_uuid(),
 url text not null unique,
 title text not null default '',
 description text not null default '',
 tags text[] not null default '{}',
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(url,'')), 'C') ||
    setweight(to_tsvector('english', array_to_string(tags,' ')), 'B')
 ) stored
);
create index if not exists websites_search_idx on public.websites using gin(search_vector);
create index if not exists websites_status_idx on public.websites(status);
alter table public.websites enable row level security;
revoke all on public.websites from anon, authenticated;
-- Public-facing requests are implemented by server routes, never exposed service key.
create or replace function public.search_websites(query_text text, result_limit int default 20)
returns table (id uuid, url text, title text, description text, tags text[], score real)
language sql stable security invoker set search_path = '' as $$
 select w.id,w.url,w.title,w.description,w.tags,
 ts_rank_cd(w.search_vector,websearch_to_tsquery('english',left(query_text,160))) as score
 from public.websites w
 where w.status='approved' and w.search_vector @@ websearch_to_tsquery('english',left(query_text,160))
 order by score desc,w.reviewed_at desc nulls last
 limit least(greatest(result_limit,1),50)
$$;
revoke all on function public.search_websites(text,int) from public,anon,authenticated;
grant execute on function public.search_websites(text,int) to service_role;
