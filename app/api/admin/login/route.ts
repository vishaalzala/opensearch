import { NextRequest,NextResponse } from 'next/server';
import { publicClient,resolveAdmin,adminUser,createPendingLogin } from '../../../../lib/admin-auth';
export async function POST(req:NextRequest){
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 const identifier=String(b.identifier||'').trim().slice(0,254),password=String(b.password||'');
 if(!identifier||!password)return NextResponse.json({error:'Enter your username/email and password'},{status:400});
 try{
 const email=await resolveAdmin(identifier);
 if(!email)return NextResponse.json({error:'Invalid credentials'},{status:401});
 const client=publicClient();
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error||!data.user||!data.user.email_confirmed_at||!(await adminUser(data.user.id)))return NextResponse.json({error:'Invalid credentials or unverified email'},{status:401});
 // No authenticated admin cookie is issued until the email OTP has been verified.
 const {error:otpError}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
 if(otpError)return NextResponse.json({error:'Could not send verification email. Check SMTP configuration.'},{status:503});
 const out=NextResponse.json({otpRequired:true});
 out.cookies.set('os_admin_pending',createPendingLogin(email),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin',maxAge:300});
 return out;
 }catch{return NextResponse.json({error:'Login configuration unavailable'},{status:503})}
}
