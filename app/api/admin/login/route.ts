import { NextRequest,NextResponse } from 'next/server';
import { matchesPassword,createAdminToken } from '../../../../lib/admin';
export async function POST(request:NextRequest){let body:any;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 if(!matchesPassword(String(body.password||'')))return NextResponse.json({error:'Invalid credentials'},{status:401});
 const r=NextResponse.json({ok:true});r.cookies.set('os_admin',createAdminToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*3600});return r;}
