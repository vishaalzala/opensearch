import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {validWebsite} from '../../../../lib/safety';
import {startCrawl} from '../../../../lib/crawl-queue';
export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json().catch(()=>null);
 const sitemapUrl=validWebsite(String(b?.sitemapUrl||'').trim());
 if(!sitemapUrl||new URL(sitemapUrl).protocol!=='https:')return NextResponse.json({error:'Enter a valid HTTPS sitemap URL'},{status:400});
 const parsed=new URL(sitemapUrl);
 if(!/\.xml(?:\.gz)?$/i.test(parsed.pathname))return NextResponse.json({error:'Enter a sitemap XML URL'},{status:400});
 const websiteUrl=parsed.origin+'/';
 const database=db();
 const {data:existing}=await database.from('websites').select('id,url').eq('url',websiteUrl).maybeSingle();
 let site:{id:string;url:string;sitemap_url:string};
 if(existing){
  const {data,error}=await database.from('websites').update({sitemap_url:sitemapUrl,status:'approved',reviewed_at:new Date().toISOString()}).eq('id',existing.id).select('id,url,sitemap_url').single();
  if(error||!data)return NextResponse.json({error:'Could not update sitemap'},{status:503});
  site=data;
 }else{
  const {data,error}=await database.from('websites').insert({url:websiteUrl,title:parsed.hostname,sitemap_url:sitemapUrl,status:'approved',reviewed_at:new Date().toISOString()}).select('id,url,sitemap_url').single();
  if(error||!data)return NextResponse.json({error:'Could not save website'},{status:503});
  site=data;
 }
 try{return NextResponse.json({ok:true,site,jobId:await startCrawl(site)})}
 catch{return NextResponse.json({ok:true,site,warning:'Sitemap saved, but indexing could not be queued'})}
}
