import {NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';

export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db();
 const queries={
  websites:client.from('websites').select('id',{head:true,count:'exact'}),
  approved:client.from('websites').select('id',{head:true,count:'exact'}).eq('status','approved'),
  pendingWebsites:client.from('websites').select('id',{head:true,count:'exact'}).eq('status','pending'),
  pendingSitemaps:client.from('website_sitemaps').select('id',{head:true,count:'exact'}).eq('status','pending'),
  sitemaps:client.from('website_sitemaps').select('id',{head:true,count:'exact'}),
  indexedPages:client.from('search_pages').select('id',{head:true,count:'exact'}).eq('is_published',true),
  allPages:client.from('search_pages').select('id',{head:true,count:'exact'}),
  queuedJobs:client.from('crawl_jobs').select('id',{head:true,count:'exact'}).eq('status','queued'),
  runningJobs:client.from('crawl_jobs').select('id',{head:true,count:'exact'}).eq('status','running'),
  failedJobs:client.from('crawl_jobs').select('id',{head:true,count:'exact'}).eq('status','failed'),
  completedJobs:client.from('crawl_jobs').select('id',{head:true,count:'exact'}).eq('status','completed'),
  failedUrls:client.from('crawl_queue').select('id',{head:true,count:'exact'}).eq('status','failed')
 };
 const entries=Object.entries(queries);
 const results=await Promise.all(entries.map(async([key,query])=>{
  const {count,error}=await query;
  if(error)throw new Error(key+': database query failed');
  return [key,count??0] as const;
 }));
 const counts=Object.fromEntries(results);
 return NextResponse.json({
  counts,updatedAt:new Date().toISOString(),
  configuration:{
   turnstile:!!process.env.TURNSTILE_SECRET_KEY&&!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
   emailOtp:false,
   autonomousCrawler:false,
   indexedUrlCapPerCrawl:10000,
   crawlBatchSize:6
  }
 },{headers:{'Cache-Control':'no-store'}});
}
