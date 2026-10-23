import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
import {startCrawl} from '../../../../lib/crawl-queue';
export async function PATCH(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>null);
 if(typeof body?.id!=='string'||!['approved','rejected'].includes(body.status))
  return NextResponse.json({error:'Invalid sitemap or status'},{status:400});
 const database=db();
 const {data:sitemap,error:getError}=await database.from('website_sitemaps')
  .select('id,website_id,url,status').eq('id',body.id).single();
 if(getError||!sitemap)return NextResponse.json({error:'Sitemap not found'},{status:404});
 const {error:updateError}=await database.from('website_sitemaps')
  .update({status:body.status,reviewed_at:new Date().toISOString()}).eq('id',sitemap.id);
 if(updateError)return NextResponse.json({error:'Unable to update sitemap'},{status:503});
 if(body.status==='rejected')return NextResponse.json({ok:true});
 const {data:site,error:siteError}=await database.from('websites')
  .select('id,url,sitemap_url,status').eq('id',sitemap.website_id).single();
 if(siteError||!site)return NextResponse.json({error:'Website not found'},{status:404});
 if(site.status!=='approved')return NextResponse.json({ok:true,warning:'Sitemap approved; website still requires approval.'});
 try{return NextResponse.json({ok:true,jobId:await startCrawl(site)})}
 catch{return NextResponse.json({ok:true,warning:'Sitemap approved but unable to start indexing.'})}
}
