import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';
export async function GET(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const websiteId=req.nextUrl.searchParams.get('websiteId');
 let q=db().from('search_pages').select('id,url,title,description,is_published,website_id,updated_at').order('updated_at',{ascending:false}).limit(150);
 if(websiteId)q=q.eq('website_id',websiteId);
 const {data,error}=await q;
 return error?NextResponse.json({error:'Unable to load pages'},{status:503}):NextResponse.json({pages:data});
}
export async function PATCH(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const b=await req.json().catch(()=>null);
 if(typeof b?.id!=='string'||typeof b.is_published!=='boolean')return NextResponse.json({error:'Invalid request'},{status:400});
 const {error}=await db().from('search_pages').update({is_published:b.is_published,updated_at:new Date().toISOString()}).eq('id',b.id);
 return error?NextResponse.json({error:'Unable to update page'},{status:503}):NextResponse.json({ok:true});
}
