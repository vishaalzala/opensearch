import { NextRequest,NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { validWebsite } from '../../../lib/safety';
export async function POST(request:NextRequest) {
 let payload:any;try{payload=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const sitemapUrl=validWebsite(String(payload.sitemapUrl||'').trim());
 if(!sitemapUrl||new URL(sitemapUrl).protocol!=='https:'||! /\.xml(?:\.gz)?$/i.test(new URL(sitemapUrl).pathname))return NextResponse.json({error:'Enter a valid HTTPS sitemap.xml URL'},{status:400});
 const url=new URL(sitemapUrl).origin+'/';
 if(!process.env.TURNSTILE_SECRET_KEY) return NextResponse.json({error:'Submission verification not configured'},{status:503});
 const token=String(payload.token||'');if(!token)return NextResponse.json({error:'Verification required'},{status:400});
 try{
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
 const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip}),cache:'no-store'});
 const verified=await check.json();if(!verified.success)return NextResponse.json({error:'Verification failed'},{status:403});
 const {error}=await db().from('websites').insert({url,title:new URL(url).hostname,sitemap_url:sitemapUrl,status:'pending'});
 if(error){if(error.code==='23505')return NextResponse.json({message:'This website is already registered. Contact an administrator to update its sitemap.'});throw error}
 return NextResponse.json({message:'Submitted for admin review'},{status:201});
 }catch{return NextResponse.json({error:'Unable to submit website'},{status:503})}
}
