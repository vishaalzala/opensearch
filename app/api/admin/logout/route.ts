import { NextResponse } from 'next/server';
export async function POST(){
 const r=NextResponse.json({ok:true});
 r.cookies.set('os_admin_session','',{httpOnly:true,path:'/',maxAge:0});
 r.cookies.set('os_admin_pending','',{httpOnly:true,path:'/api/admin',maxAge:0});
 r.cookies.set('os_admin','',{httpOnly:true,path:'/',maxAge:0});
 return r;
}
