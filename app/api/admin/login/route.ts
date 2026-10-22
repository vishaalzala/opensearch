import { NextRequest, NextResponse } from 'next/server';
import { publicClient, resolveAdmin, adminUser } from '../../../../lib/admin-auth';

export async function POST(req: NextRequest) {
 let body: {identifier?: string; password?: string};
 try { body = await req.json(); } catch { return NextResponse.json({error:'Invalid request'},{status:400}); }
 const identifier=String(body.identifier||'').trim().slice(0,254);
 const password=String(body.password||'');
 if(!identifier || !password) return NextResponse.json({error:'Enter your username/email and password'},{status:400});
 try {
  const email=await resolveAdmin(identifier);
  if(!email) return NextResponse.json({error:'Invalid credentials'},{status:401});
  const client=publicClient();
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error || !data.user || !data.session || !data.user.email_confirmed_at || !(await adminUser(data.user.id)))
   return NextResponse.json({error:'Invalid credentials or unverified email'},{status:401});
  // Temporary password-only mode. The admin allowlist and verified email remain mandatory.
  const response=NextResponse.json({ok:true});
  response.cookies.set('os_admin_session',data.session.access_token,{
   httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',
   maxAge:Math.min(3600,data.session.expires_in||3600)
  });
  response.cookies.set('os_admin_pending','',{httpOnly:true,path:'/api/admin',maxAge:0});
  response.headers.set('Cache-Control','no-store');
  return response;
 } catch { return NextResponse.json({error:'Login configuration unavailable'},{status:503}); }
}
