import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {parseWebsiteSubmission} from '../../../../lib/sitemaps';
import {startCrawl} from '../../../../lib/crawl-queue';

export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>null);
 const parsed=parseWebsiteSubmission({websiteUrl:body?.websiteUrl,sitemapUrls:body?.sitemapUrls??body?.sitemapUrl},30);
 if('error' in parsed)return NextResponse.json({error:parsed.error},{status:400});
 const database=db();
 try{
  const {data:existing,error:findError}=await database.from('websites')
   .select('id,url,status,sitemap_url').eq('url',parsed.websiteUrl).maybeSingle();
  if(findError)throw findError;
  let site:{id:string;url:string;sitemap_url:string|null};
  let websiteAdded=false;
  let approvedWebsite=false;
  if(existing){
   if(existing.status!=='approved'){
    const {error}=await database.from('websites')
     .update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',existing.id);
    if(error)throw error;
    approvedWebsite=true;
   }
   site={id:existing.id,url:existing.url,sitemap_url:existing.sitemap_url};
  }else{
   const {data:created,error}=await database.from('websites').insert({
    url:parsed.websiteUrl,title:new URL(parsed.websiteUrl).hostname,
    sitemap_url:parsed.urls[0]||null,status:'approved',reviewed_at:new Date().toISOString()
   }).select('id,url,sitemap_url').single();
   if(error||!created)throw error??Error('Could not save website');
   site=created;
   websiteAdded=true;
  }

  let added=0,approvedFromPending=0,duplicates=0;
  if(parsed.urls.length){
   const {data:previous,error:previousError}=await database.from('website_sitemaps')
    .select('url,status').eq('website_id',site.id).in('url',parsed.urls);
   if(previousError)throw previousError;
   const known=new Map((previous||[]).map(row=>[row.url,row.status]));
   added=parsed.urls.filter(url=>!known.has(url)).length;
   approvedFromPending=parsed.urls.filter(url=>known.has(url)&&known.get(url)!=='approved').length;
   duplicates=parsed.urls.length-added-approvedFromPending;
   if(added||approvedFromPending){
    const {error}=await database.from('website_sitemaps').upsert(
     parsed.urls.map(url=>({website_id:site.id,url,status:'approved',submitted_by:'admin',reviewed_at:new Date().toISOString()})),
     {onConflict:'website_id,url'});
    if(error)throw error;
   }
  }

  const changed=websiteAdded||approvedWebsite||added>0||approvedFromPending>0;
  const shouldIndex=changed||parsed.websiteProvided;
  if(!shouldIndex)return NextResponse.json({
   ok:true,status:'duplicate',added,duplicates,approvedFromPending,websiteAdded,website:site.url,
   message:'All submitted sitemaps are already approved. No duplicates were added.'
  });
  const message=[
   websiteAdded?'Website added and approved.':approvedWebsite?'Website approved.':parsed.websiteProvided?'Existing website selected for reindexing.':'',
   added?added+' sitemap'+(added===1?'':'s')+' added.':'',
   approvedFromPending?approvedFromPending+' sitemap'+(approvedFromPending===1?'':'s')+' approved.':'',
   duplicates?duplicates+' sitemap'+(duplicates===1?'':'s')+' already registered.':''
  ].filter(Boolean).join(' ');
  try{
   const jobId=await startCrawl(site);
   return NextResponse.json({ok:true,status:'queued',website:site.url,websiteAdded,added,duplicates,approvedFromPending,jobId,
    message:message+' Indexing queued.'});
  }catch{
   return NextResponse.json({ok:true,status:'saved',website:site.url,websiteAdded,added,duplicates,approvedFromPending,
    message:message+' Saved, but indexing could not start. Retry in Crawl Monitor.'});
  }
 }catch{
  return NextResponse.json({error:'Unable to save website. Please retry.'},{status:503});
 }
}
