import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {validWebsite} from '../../../../lib/safety';
import {startCrawl} from '../../../../lib/crawl-queue';
export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json().catch(()=>null);
 const url=validWebsite(String(b?.url||''));
 const sitemapUrl=b?.sitemapUrl?validWebsite(String(b.sitemapUrl)):null;
 if(!url||new URL(url).protocol!=='https:')return NextResponse.json({error:'Valid HTTPS URL required'},{status:400});
 if(b?.sitemapUrl&&(!sitemapUrl||new URL(sitemapUrl).hostname!==new URL(url).hostname||new URL(sitemapUrl).protocol!=='https:'))return NextResponse.json({error:'Sitemap must be HTTPS and on the same domain'},{status:400});
 const {data,error}=await db().from('websites').upsert({url,title:new URL(url).hostname,sitemap_url:sitemapUrl,status:'approved',reviewed_at:new Date().toISOString()},{onConflict:'url'}).select('id,url,sitemap_url').single();
 if(error||!data)return NextResponse.json({error:'Unable to save website'},{status:503});
 try{return NextResponse.json({ok:true,site:data,jobId:await startCrawl(data)})}catch{return NextResponse.json({ok:true,site:data,warning:'Website saved but crawl job could not be created'})}
}
