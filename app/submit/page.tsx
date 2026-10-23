'use client';
import {useEffect,useState} from 'react';
declare global {interface Window{turnstile?:{render:(element:string,options:{sitekey:string,callback:(token:string)=>void})=>void}}}
export default function Submit(){
 const [sitemapUrls,setSitemapUrls]=useState(''),[token,setToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const sitekey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 useEffect(()=>{
  if(!sitekey)return;
  const script=document.createElement('script');
  script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async=true;
  script.onload=()=>window.turnstile?.render('#turnstile',{sitekey,callback:setToken});
  document.head.appendChild(script);
  return()=>{script.remove()};
 },[sitekey]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sitemapUrls,token})});
   const d=await r.json();
   setMessage(d.message||d.error||'Unknown response');
   if(r.ok)setSitemapUrls('');
  }catch{setMessage('Unable to reach server')}
  finally{setBusy(false)}
 }
 return <main><div className="panel">
  <a href="/" aria-label="OpenSearch home" style={{display:'inline-block',marginBottom:12,textDecoration:'none'}}><span className="brand">Open<span>Search</span></span></a>
  <h1>Submit sitemaps</h1>
  <p className="muted">Submit one or more XML sitemaps for the same website. Our administrators review each new sitemap before indexing.</p>
  <form onSubmit={submit}>
   <label htmlFor="sitemaps">Sitemap XML URLs (one per line)</label>
   <textarea id="sitemaps" rows={5} value={sitemapUrls} onChange={e=>setSitemapUrls(e.target.value)}
    placeholder={'https://example.com/posts-sitemap.xml\nhttps://example.com/courses-sitemap.xml'} required/>
   <p className="muted" style={{fontSize:12}}>Each URL must use HTTPS and belong to the same website. Existing approved sitemaps will not be replaced. Maximum 20 URLs per submission.</p>
   <div id="turnstile" style={{marginBottom:16}}/>
   {!sitekey&&<p className="muted">Submission verification must be configured before launch.</p>}
   <button disabled={busy||!token}>{busy?'Submitting...':'Submit sitemaps for review'}</button>
  </form>
  <p role="status" className="status">{message}</p>
 </div></main>;
}
