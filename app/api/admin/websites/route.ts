import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {parseSitemaps} from '../../../../lib/sitemaps';
import {startCrawl} from '../../../../lib/crawl-queue';

export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>null);
 const parsed=parseSitemaps(body?.sitemapUrls??body?.sitemapUrl,30);
 if('error' in parsed)return NextResponse.json({error:parsed.error},{status:400});
 const database=db();
 try{
  const {data:existing,error:findError}=await database.from('websites')
   .select('id,url,status,sitemap_url').eq('url',parsed.websiteUrl).maybeSingle();
  if(findError)throw findError;
  let site:{id:string;url:string;sitemap_url:string|null};
  if(existing){
   if(existing.status!=='approved'){
    const {error}=await database.from('websites').update({status:'approved',reviewed_at:new Date().toISOString()}).eq('id',existing.id);
    if(error)throw error;
   }
   site={id:existing.id,url:existing.url,sitemap_url:existing.sitemap_url};
  }else{
   const {data:newSite,error}=await database.from('websites').insert({
    url:parsed.websiteUrl,title:new URL(parsed.websiteUrl).hostname,sitemap_url:parsed.urls[0],
    status:'approved',reviewed_at:new Date().toISOString()
   }).select('id,url,sitemap_url').single();
   if(error||!newSite)throw error??Error('Unable to create website');
   site=newSite;
  }
  // Preserve all previously saved sitemap URLs instead of replacing website.sitemap_url.
  const {error:saveError}=await database.from('website_sitemaps').upsert(
   parsed.urls.map(url=>({website_id:site.id,url,status:'approved',submitted_by:'admin',reviewed_at:new Date().toISOString()})),
   {onConflict:'website_id,url'});
  if(saveError)throw saveError;
  try{
   const jobId=await startCrawl(site);
   return NextResponse.json({ok:true,websiteId:site.id,sitemapsAdded:parsed.urls.length,jobId});
  }catch{
   return NextResponse.json({ok:true,websiteId:site.id,sitemapsAdded:parsed.urls.length,warning:'Sitemaps saved but indexing could not be queued'});
  }
 }catch{return NextResponse.json({error:'Unable to save sitemaps'},{status:503})}
}
