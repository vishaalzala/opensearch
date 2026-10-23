import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {runCrawlBatch} from '../../../../lib/crawl-queue';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

// Independent of user navigation. This endpoint is NOT callable without
// an explicitly configured private CRON_SECRET in Vercel Production settings.
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<20)return NextResponse.json({error:'Background crawler not configured'},{status:503});
 if(req.headers.get('authorization')!==`Bearer ${secret}`)
  return NextResponse.json({error:'Unauthorized'},{status:401});

 try{
  const client=db();
  // Fair rotation: an updated job moves to the back of the queue.
  const {data:jobs,error}=await client.from('crawl_jobs')
   .select('id,status,updated_at').in('status',['queued','running'])
   .order('updated_at',{ascending:true}).limit(40);
  if(error)throw Error('Cannot query crawl jobs');
  for(const job of jobs||[]){
   const {data:pending}=await client.from('crawl_queue').select('id').eq('job_id',job.id)
    .in('status',['pending','processing']).limit(1);
   if(!pending?.length)continue;
   const result=await runCrawlBatch(job.id,3);
   return NextResponse.json({ok:true,jobId:job.id,...result},{
    headers:{'Cache-Control':'private, no-store'}
   });
  }
  return NextResponse.json({ok:true,processed:0,idle:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){
  return NextResponse.json({error:'Crawler iteration failed',detail:e instanceof Error?e.message:'Unknown error'},{status:503});
 }
}
