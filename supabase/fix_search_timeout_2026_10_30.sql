-- OpenSearch: production fix for PostgREST 57014 statement-timeout errors.
-- Applied to the OpenSearch Supabase project on 30 Oct 2026.
-- Non-destructive: retains existing search_pages, websites and public result schema.
--
-- Why: ts_rank_cd(p.search_vector, ...) scanned and scored very large
-- full-body tsvectors for thousands of matches, taking 9+ seconds with
-- caller RLS in force. Score short title/description text instead.
-- SECURITY DEFINER avoids expensive RLS planning while the function explicitly
-- checks both approved websites AND published pages. Fixed search_path and
-- fully qualified table names prevent schema hijacking. This function is
-- read-only and does not expose private or rejected website records.

create or replace function public.search_websites_paged(
 query_text text, page_number integer default 1, page_size integer default 15
)
returns table(
 id uuid, url text, title text, description text, tags text[],
 score real, total_count bigint
)
language sql stable security definer set search_path = ''
as $function$
with matched as (
 select p.id,p.url,p.title,p.description,array[]::text[] as tags,
  (0.2 + 4 * ts_rank_cd(
    to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.description,'')),
    websearch_to_tsquery('english',left(query_text,160))
  ))::real as score
 from public.search_pages p
 join public.websites w on w.id=p.website_id
 where w.status='approved' and p.is_published=true
 and p.search_vector @@ websearch_to_tsquery('english',left(query_text,160))
 union all
 select w.id,w.url,w.title,w.description,w.tags,0.1::real as score
 from public.websites w
 where w.status='approved' and (
  w.title ilike '%' || left(query_text,160) || '%' or
  w.description ilike '%' || left(query_text,160) || '%'
 )
), ranked as (
 select m.*, count(*) over() as total_count from matched m
)
select r.id,r.url,r.title,r.description,r.tags,r.score,r.total_count
from ranked r
order by r.score desc,r.url asc
limit least(greatest(page_size,1),15)
offset (least(greatest(page_number,1),1000)-1)*least(greatest(page_size,1),15)
$function$;

revoke all on function public.search_websites_paged(text,integer,integer) from public;
grant execute on function public.search_websites_paged(text,integer,integer)
 to anon,authenticated,service_role;
-- Expected test: begin; set local role anon;
-- select count(*),min(total_count) from public.search_websites_paged('hacking',1,15);
-- rollback;
