import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';

export async function GET(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const params=req.nextUrl.searchParams;
 const websiteId=params.get('websiteId')||'';
 const search=(params.get('search')||'').trim().replace(/[%_,()]/g,'').slice(0,80);
 const status=params.get('status')||'all';
 const page=Math.max(1,Math.min(100000,Number.parseInt(params.get('page')||'1',10)||1));
 const perPage=25;
 let query=db().from('search_pages').select('id,url,title,description,is_published,website_id,updated_at',{count:'exact'})
  .order('updated_at',{ascending:false}).range((page-1)*perPage,page*perPage-1);
 if(websiteId)query=query.eq('website_id',websiteId);
 if(status==='published')query=query.eq('is_published',true);
 if(status==='hidden')query=query.eq('is_published',false);
 if(search)query=query.or('url.ilike.%'+search+'%,title.ilike.%'+search+'%');
 const {data,count,error}=await query;
 if(error)return NextResponse.json({error:'Unable to load pages'},{status:503});
 return NextResponse.json({pages:data??[],total:count??0,page,perPage,totalPages:Math.ceil((count??0)/perPage)},
  {headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>null);
 if(typeof body?.id!=='string'||typeof body.is_published!=='boolean')
  return NextResponse.json({error:'Invalid request'},{status:400});
 const {error}=await db().from('search_pages').update({is_published:body.is_published,updated_at:new Date().toISOString()}).eq('id',body.id);
 return error?NextResponse.json({error:'Unable to update page'},{status:503}):NextResponse.json({ok:true});
}
