import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {startCrawl,runCrawlBatch} from '../../../../lib/crawl-queue';
export const maxDuration=60;
export async function GET(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const jobId=req.nextUrl.searchParams.get('jobId');
 if(jobId){
  const {data,error}=await db().from('crawl_queue').select('url,last_error,attempts,status,kind').eq('job_id',jobId).eq('status','failed').order('id',{ascending:false}).limit(50);
  return error?NextResponse.json({error:'Could not load URL errors'},{status:503}):NextResponse.json({errors:data??[]});
 }
 const {data,error}=await db().from('crawl_jobs').select('id,website_id,status,discovered,processed,indexed,failed,error,created_at,updated_at,websites(url)').order('created_at',{ascending:false}).limit(100);
 return error?NextResponse.json({error:error.message},{status:503}):NextResponse.json({jobs:data});
}
export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json().catch(()=>null);
 if(!b)return NextResponse.json({error:'Invalid request'},{status:400});
 try{
 if(b.action==='start'&&typeof b.websiteId==='string'){
  const {data:site,error}=await db().from('websites').select('id,url,sitemap_url,status').eq('id',b.websiteId).single();
  if(error||!site||site.status!=='approved')return NextResponse.json({error:'Approve this website first'},{status:400});
  return NextResponse.json({jobId:await startCrawl(site)});
 }
 if(b.action==='process'&&typeof b.jobId==='string')return NextResponse.json(await runCrawlBatch(b.jobId));
 return NextResponse.json({error:'Invalid action'},{status:400});
 }catch(e){return NextResponse.json({error:String(e).slice(0,240)},{status:503})}
}
