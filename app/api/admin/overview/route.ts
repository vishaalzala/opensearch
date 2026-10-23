import {NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';

export const dynamic='force-dynamic';
export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await db().rpc('admin_overview_counts');
 if(error)return NextResponse.json({error:'Unable to fetch dashboard counts'},{status:503});
 return NextResponse.json({
  counts:data,
  updatedAt:new Date().toISOString(),
  configuration:{
   turnstile:!!process.env.TURNSTILE_SECRET_KEY&&!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
   emailOtp:false,
   autonomousCrawler:!!process.env.CRON_SECRET,
   indexedUrlCapPerCrawl:10000,
   crawlBatchSize:6
  }
 },{headers:{'Cache-Control':'private, no-store'}});
}
