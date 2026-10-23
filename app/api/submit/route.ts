import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../lib/db';
import {parseSitemaps} from '../../../lib/sitemaps';

export async function POST(request:NextRequest){
 const payload=await request.json().catch(()=>null);
 if(!payload)return NextResponse.json({error:'Invalid JSON'},{status:400});
 const parsed=parseSitemaps(payload.sitemapUrls??payload.sitemapUrl,20);
 if('error' in parsed)return NextResponse.json({error:parsed.error},{status:400});
 if(!process.env.TURNSTILE_SECRET_KEY)return NextResponse.json({error:'Submission verification not configured'},{status:503});
 const token=String(payload.token||'');
 if(!token)return NextResponse.json({error:'Verification required'},{status:400});
 try{
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip}),
   cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  const verification=await response.json();
  if(!verification.success)return NextResponse.json({error:'Verification failed'},{status:403});
  const database=db();
  const {data:found,error:findError}=await database.from('websites').select('id').eq('url',parsed.websiteUrl).maybeSingle();
  if(findError)throw findError;
  let websiteId=found?.id;
  if(!websiteId){
   const {data:created,error:createError}=await database.from('websites').insert({
    url:parsed.websiteUrl,title:new URL(parsed.websiteUrl).hostname,sitemap_url:parsed.urls[0],status:'pending'
   }).select('id').single();
   if(createError){
    if(createError.code!=='23505')throw createError;
    const {data:existing}=await database.from('websites').select('id').eq('url',parsed.websiteUrl).single();
    websiteId=existing?.id;
   }else websiteId=created?.id;
  }
  if(!websiteId)throw Error('Website could not be created');
  // Public submissions only INSERT pending new sitemaps; duplicates never change approval.
  const {data:added,error:insertError}=await database.from('website_sitemaps')
   .upsert(parsed.urls.map(url=>({website_id:websiteId,url,status:'pending',submitted_by:'public'})),
   {onConflict:'website_id,url',ignoreDuplicates:true}).select('url');
  if(insertError)throw insertError;
  const count=added?.length??0;
  return NextResponse.json({message:count?count+' sitemap(s) submitted for admin review.':'These sitemap URLs have already been submitted.',added:count},{status:count?201:200});
 }catch{return NextResponse.json({error:'Unable to submit sitemaps'},{status:503})}
}
