import { NextRequest,NextResponse } from 'next/server';
import { adminUser,publicClient,readPendingLogin } from '../../../../lib/admin-auth';
export async function POST(req:NextRequest){
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 const token=String(b.code||'').trim();
 if(!/^\d{6,8}$/.test(token))return NextResponse.json({error:'Enter the email verification code'},{status:400});
 try{
 const email=readPendingLogin(req.cookies.get('os_admin_pending')?.value);
 if(!email)return NextResponse.json({error:'Login expired. Start again.'},{status:401});
 const {data,error}=await publicClient().auth.verifyOtp({email,token,type:'email'});
 if(error||!data.user||!data.session||!data.user.email_confirmed_at||!(await adminUser(data.user.id)))return NextResponse.json({error:'Invalid or expired code'},{status:401});
 const res=NextResponse.json({ok:true});
 res.cookies.set('os_admin_session',data.session.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:Math.min(3600,data.session.expires_in||3600)});
 res.cookies.set('os_admin_pending','',{path:'/api/admin',maxAge:0});
 res.cookies.set('os_admin','',{path:'/',maxAge:0});
 return res;
 }catch{return NextResponse.json({error:'Verification unavailable'},{status:503})}
}
