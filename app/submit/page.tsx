'use client';
import {useEffect,useRef,useState} from 'react';
declare global {
 interface Window {
  turnstile?: {
   render:(element:string,options:{sitekey:string,callback:(token:string)=>void})=>void;
   reset?:()=>void;
  }
 }
}
type Notice={success:boolean;text:string;added?:number;duplicates?:number;website?:string};
export default function Submit(){
 const [sitemapUrls,setSitemapUrls]=useState('');
 const [token,setToken]=useState('');
 const [notice,setNotice]=useState<Notice|null>(null);
 const [busy,setBusy]=useState(false);
 const field=useRef<HTMLTextAreaElement>(null);
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
  e.preventDefault();setBusy(true);setNotice(null);
  try{
   const r=await fetch('/api/submit',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sitemapUrls,token,companyWebsite:''})
   });
   const d=await r.json();
   if(!r.ok) {
    setNotice({success:false,text:d.error||'Submission failed. Please retry.'});
   }else{
    setNotice({success:true,text:d.message||'Submission saved.',added:d.added,duplicates:d.duplicates,website:d.website});
    if(d.added>0)setSitemapUrls('');
   }
  }catch{setNotice({success:false,text:'Cannot reach the server. Please retry.'})}
  finally{
   setBusy(false);
   if(sitekey){setToken('');window.turnstile?.reset?.();}
  }
 }

 return <main><div className="panel">
  <a href="/" aria-label="OpenSearch home" style={{display:'inline-block',marginBottom:12,textDecoration:'none'}}>
   <span className="brand">Open<span>Search</span></span>
  </a>
  <h1>Submit sitemaps</h1>
  <p className="muted">Add one or more sitemaps for the same website. You can return later to add more. New sitemaps require administrator approval.</p>
  <form onSubmit={submit}>
   <label htmlFor="sitemaps">Sitemap XML URLs (one per line)</label>
   <textarea id="sitemaps" ref={field} rows={5} value={sitemapUrls} onChange={e=>setSitemapUrls(e.target.value)}
    placeholder={'https://example.com/posts-sitemap.xml\nhttps://example.com/courses-sitemap.xml'} required/>
   <p className="muted" style={{fontSize:12}}>Existing sitemap entries are preserved. Only new URLs are added. Maximum 20 URLs per submission.</p>
   <div id="turnstile" style={{marginBottom:sitekey?16:0}}/>
   {!sitekey&&<p className="muted" style={{fontSize:12}}>Submissions are rate-limited and checked by an administrator before indexing.</p>}
   <button disabled={busy||!!sitekey&&!token}>{busy?'Saving sitemaps…':'Submit sitemaps for review'}</button>
  </form>
  {notice&&<div role="status" aria-live="polite" className="panel" style={{margin:'18px 0 0',padding:16,background:notice.success?'#f4fbf7':'#fff6f4',borderColor:notice.success?'#bfe8d0':'#f0c7c4'}}>
   <strong>{notice.success?'Submission confirmed':'Submission not saved'}</strong>
   <p style={{marginBottom:8}}>{notice.text}</p>
   {notice.website&&<p className="muted" style={{fontSize:13}}>Website: {notice.website}</p>}
   {notice.success&&<button type="button" className="secondary" onClick={()=>{setSitemapUrls('');setNotice(null);field.current?.focus()}}>Add another sitemap</button>}
  </div>}
 </div></main>;
}
