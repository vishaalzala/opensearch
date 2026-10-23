import {NextRequest,NextResponse} from 'next/server';
import {createHmac} from 'node:crypto';
import {db} from '../../../lib/db';
import {parseWebsiteSubmission} from '../../../lib/sitemaps';

export async function POST(request:NextRequest){
 const payload=await request.json().catch(()=>null);
 if(!payload)return NextResponse.json({error:'Invalid JSON'},{status:400});
 // Honeypot for unsophisticated automated submissions. Real users never see this field.
 if(typeof payload.companyWebsite==='string'&&payload.companyWebsite.trim())
  return NextResponse.json({ok:true,status:'pending',added:0,duplicates:0,message:'Submission received.'});
 const parsed=parseWebsiteSubmission({websiteUrl:payload.websiteUrl,sitemapUrls:payload.sitemapUrls??payload.sitemapUrl},20);
 if('error' in parsed)return NextResponse.json({error:parsed.error},{status:400});
 try {
  const database=db();
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||
    request.headers.get('x-real-ip')?.trim()||'unknown';
  const key=process.env.SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return NextResponse.json({error:'Submission security unavailable'},{status:503});
  const bucket=createHmac('sha256',key).update('public-submit:'+ip).digest('hex');
  // This database-side counter enforces five submission attempts per IP per hour,
  // including when the optional captcha provider has not been configured.
  const {data:allowed,error:quotaError}=await database.rpc('consume_submission_quota',{p_key:bucket,p_limit:5});
  if(quotaError)return NextResponse.json({error:'Submission security temporarily unavailable'},{status:503});
  if(!allowed)return NextResponse.json({error:'Submission limit reached. Please try again in an hour.'},{status:429});

  const secret=process.env.TURNSTILE_SECRET_KEY;
  const turnstileEnabled=!!secret&&!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const token=String(payload.token||'');
  // When Turnstile is fully configured we require it. Otherwise the server-side
  // rate limiter and mandatory admin approval protect this early-access form.
  if(turnstileEnabled && secret) {
   if(!token)return NextResponse.json({error:'Complete the verification before submitting'},{status:400});
   const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({secret,response:token,remoteip:ip==='unknown'?'':ip}),
    cache:'no-store',signal:AbortSignal.timeout(8000)
   });
   const result=await check.json();
   if(!result.success)return NextResponse.json({error:'Verification failed'},{status:403});
  }

  const {data:found,error:findError}=await database.from('websites')
   .select('id,status').eq('url',parsed.websiteUrl).maybeSingle();
  if(findError)throw findError;
  let websiteId:string|undefined=found?.id;
  let websiteAdded=false;
  if(!websiteId) {
   const {data:created,error:createError}=await database.from('websites')
    .insert({url:parsed.websiteUrl,title:new URL(parsed.websiteUrl).hostname,
      sitemap_url:parsed.urls[0]||null,status:'pending'}).select('id').single();
   if(createError) {
    if(createError.code!=='23505')throw createError;
    const {data:existing,error:e}=await database.from('websites')
      .select('id').eq('url',parsed.websiteUrl).single();
    if(e)throw e;
    websiteId=existing?.id;
   }else {websiteId=created?.id;websiteAdded=!!created?.id;}
  }
  if(!websiteId)throw Error('Website not created');
  // New sitemaps for an approved website still require their own review.
  // A website-only submission creates no fake sitemap rows.
  let count=0;
  if(parsed.urls.length){
   const {data:added,error:insertError}=await database.from('website_sitemaps')
    .upsert(parsed.urls.map(url=>({website_id:websiteId,url,status:'pending',submitted_by:'public'})),
     {onConflict:'website_id,url',ignoreDuplicates:true}).select('url');
   if(insertError)throw insertError;
   count=added?.length??0;
  }
  const duplicates=parsed.urls.length-count;
  const status=websiteAdded||count>0?'pending':'duplicate';
  let message='';
  if(websiteAdded)message='Website submitted for admin review.';
  else if(!parsed.urls.length)message=found?.status==='approved'
     ?'This website is already approved. You can add a sitemap to suggest more pages.'
     :'This website is already awaiting review.';
  if(count)message+=(message?' ':'')+count+' new sitemap'+(count===1?'':'s')+' awaiting review.';
  if(duplicates)message+=(message?' ':'')+duplicates+' sitemap'+(duplicates===1?' was':'s were')+' already submitted.';
  return NextResponse.json({
   ok:true,status,added:count,websiteAdded,duplicates,website:parsed.websiteUrl,
   message:message||'This website and its sitemaps were already submitted.'
  },{status:websiteAdded||count>0?201:200,headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Unable to save sitemaps. Please try again.'},{status:503});
 }
}
