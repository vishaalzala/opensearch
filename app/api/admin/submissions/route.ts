import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {isAdmin} from '../../../../lib/admin';
import {startCrawl} from '../../../../lib/crawl-queue';
export const maxDuration=60;
export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await db().from('websites').select('id,url,title,description,sitemap_url,status,submitted_at').order('submitted_at',{ascending:false}).limit(100);
 return error?NextResponse.json({error:'Database error'},{status:503}):NextResponse.json({websites:data});
}
export async function PATCH(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(typeof b.id!=='string'||!['approved','rejected','pending'].includes(b.status))return NextResponse.json({error:'Invalid request'},{status:400});
 const {data:site,error}=await db().from('websites').update({status:b.status,reviewed_at:new Date().toISOString(),title:String(b.title||'').slice(0,220),description:String(b.description||'').slice(0,1000)}).eq('id',b.id).select('id,url,sitemap_url').single();
 if(error)return NextResponse.json({error:'Update failed'},{status:503});
 if(b.status!=='approved')return NextResponse.json({ok:true});
 try {
  const jobId=await startCrawl(site);
  return NextResponse.json({ok:true,jobId});
 }catch(e){
  return NextResponse.json({ok:true,indexingError:'Website approved, but unable to queue indexing.'});
 }
}
