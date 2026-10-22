import {NextRequest,NextResponse} from 'next/server';
import {publicClient,resolveAdmin} from '../../../../lib/admin-auth';
export async function POST(req:NextRequest){
 let b:any;try{b=await req.json()}catch{return NextResponse.json({ok:true})}
 try {
 const email=await resolveAdmin(String(b.identifier||'').slice(0,254));
 if(email)await publicClient().auth.resetPasswordForEmail(email,{redirectTo:'https://opensearch-pi.vercel.app/smartadmin/reset-password'});
 }catch{}
 return NextResponse.json({ok:true,message:'If this admin exists, a password reset email will be sent.'});
}
