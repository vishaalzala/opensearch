import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
export async function GET(request:NextRequest){
 const query=(request.nextUrl.searchParams.get('q')||'').trim();
 if(query.length<2 || query.length>160) return NextResponse.json({results:[]});
 try{const {data,error}=await db().rpc('search_websites',{query_text:query,result_limit:25});if(error)throw error;
 return NextResponse.json({results:data||[]},{headers:{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=60'}});
 }catch{return NextResponse.json({error:'Search temporarily unavailable'},{status:503})}
}
