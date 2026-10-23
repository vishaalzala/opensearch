import {db} from './db';
import {validWebsite} from './safety';
import {safeFetch,locations,extract} from './sitemap-indexer';
const LIMIT=10000;
export async function startCrawl(site:{id:string;url:string;sitemap_url:string|null}) {
 const database=db();
 const {data:sitemaps,error:lookupError}=await database.from('website_sitemaps')
  .select('url').eq('website_id',site.id).eq('status','approved').order('created_at',{ascending:true}).limit(500);
 if(lookupError)throw Error('Unable to load approved sitemaps');
 const sitemapUrls=[...new Set((sitemaps||[]).map(s=>s.url))];
 // Legacy fallback when an older site's sitemap has not yet been migrated.
 if(!sitemapUrls.length && site.sitemap_url)sitemapUrls.push(site.sitemap_url);
 if(!sitemapUrls.length)throw Error('No approved sitemap URLs available');
 const {data:job,error}=await database.from('crawl_jobs').insert({website_id:site.id,status:'queued'}).select('id').single();
 if(error||!job)throw Error('Failed to start crawl');
 const initial=[
  ...sitemapUrls.map(url=>({job_id:job.id,url,kind:'sitemap'})),
  {job_id:job.id,url:site.url,kind:'page'}
 ];
 for(let i=0;i<initial.length;i+=100){
  const {error:queueError}=await database.from('crawl_queue').upsert(initial.slice(i,i+100),
   {onConflict:'job_id,url,kind',ignoreDuplicates:true});
  if(queueError){
   await database.from('crawl_jobs').update({status:'failed',error:'Failed to queue approved sitemaps'}).eq('id',job.id);
   throw Error('Failed to queue approved sitemaps');
  }
 }
 return job.id as string;
}
export async function runCrawlBatch(jobId:string) {
 const {data:job,error}=await db().from('crawl_jobs').select('id,website_id,status,discovered,processed,indexed,failed').eq('id',jobId).single();
 if(error||!job)throw Error('Crawl not found');
 const {data:site}=await db().from('websites').select('id,url,status').eq('id',job.website_id).single();
 if(!site||site.status!=='approved')throw Error('Website must be approved');
 const host=new URL(site.url).hostname;
 const {data:queue,error:qError}=await db().from('crawl_queue').select('id,url,kind,attempts').eq('job_id',jobId).eq('status','pending').order('id').limit(6);
 if(qError)throw Error('Cannot read queue');
 if(!queue?.length){const status=job.failed>0||job.indexed===0?'failed':'completed';await db().from('crawl_jobs').update({status,error:status==='failed'?'Indexing finished with errors or no indexed pages':null,updated_at:new Date().toISOString()}).eq('id',jobId);return {done:true,status,processed:job.processed,indexed:job.indexed,failed:job.failed}}
 let processed=0,indexed=0,failed=0,discovered=0;
 for(const task of queue){
  // Claim the task atomically so double-clicked batches do not duplicate work.
  const {data:claimed}=await db().from('crawl_queue').update({status:'processing',attempts:task.attempts+1}).eq('id',task.id).eq('status','pending').select('id').maybeSingle();
  if(!claimed)continue;
  try{
   if(task.kind==='sitemap'){
    const xml=await safeFetch(task.url,host,1_000_000,'xml');
    const kind=/<sitemapindex\b/i.test(xml)?'sitemap':'page';
    const urls=[...new Set(locations(xml))].filter(u=>{try{const parsed=new URL(u);return parsed.protocol==='https:'&&parsed.hostname===host&&!!validWebsite(u)}catch{return false}});
    const {count}=await db().from('crawl_queue').select('id',{count:'exact',head:true}).eq('job_id',jobId);
    const capacity=Math.max(0,LIMIT-(count||0));
    for(let i=0;i<Math.min(urls.length,capacity);i+=100){
     const rows=urls.slice(i,Math.min(i+100,capacity)).map(url=>({job_id:jobId,url,kind}));
     const {error:e}=await db().from('crawl_queue').upsert(rows,{onConflict:'job_id,url,kind',ignoreDuplicates:true});
     if(e)throw e;
    }
    discovered+=Math.min(urls.length,capacity);
   }else{
    const html=await safeFetch(task.url,host,400_000,'html');
    const page=extract(html,task.url);
    // Discover same-site links from indexed pages, subject to the crawl limit.
    const hrefs=[...html.matchAll(/<a\\b[^>]*\\bhref=["']([^"']+)["']/gi)].map(m=>m[1]);
    const links=[...new Set(hrefs.map(h=>{try{return new URL(h,task.url).toString()}catch{return ''}}).filter(h=>{try{const u=new URL(h);return u.protocol==='https:'&&u.hostname===host&&!!validWebsite(h)&&!/(\\.(pdf|jpg|jpeg|png|gif|webp|zip|mp4|css|js)(\\?|$))/i.test(u.pathname)}catch{return false}}))].slice(0,200);
    const {count:queued}=await db().from('crawl_queue').select('id',{count:'exact',head:true}).eq('job_id',jobId);
    const free=Math.max(0,LIMIT-(queued||0));
    for(let i=0;i<Math.min(links.length,free);i+=100){await db().from('crawl_queue').upsert(links.slice(i,Math.min(i+100,free)).map(url=>({job_id:jobId,url,kind:'page'})),{onConflict:'job_id,url,kind',ignoreDuplicates:true});}
    discovered+=Math.min(links.length,free);
    const {error:e}=await db().from('search_pages').upsert({...page,website_id:site.id,is_published:true},{onConflict:'url'});
    if(e)throw e;
    indexed++;
   }
   await db().from('crawl_queue').update({status:'done'}).eq('id',task.id);
  }catch(e){
   failed++;await db().from('crawl_queue').update({status:'failed',last_error:String(e).slice(0,300)}).eq('id',task.id);
  }
  processed++;
 }
 const {data:pending}=await db().from('crawl_queue').select('id').eq('job_id',jobId).eq('status','pending').limit(1);
 const done=!pending?.length;
 const totalIndexed=job.indexed+indexed,totalFailed=job.failed+failed;
 const status=done?(totalFailed>0||totalIndexed===0?'failed':'completed'):'running';
 await db().from('crawl_jobs').update({status,error:status==='failed'?'Indexing finished with failed URLs or no indexed pages':null,discovered:job.discovered+discovered,processed:job.processed+processed,indexed:totalIndexed,failed:totalFailed,updated_at:new Date().toISOString()}).eq('id',jobId);
 return {done,status,processed:job.processed+processed,indexed:totalIndexed,failed:totalFailed,discovered:job.discovered+discovered};
}
