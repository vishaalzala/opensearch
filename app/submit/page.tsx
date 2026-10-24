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
 const [websiteUrl,setWebsiteUrl]=useState('');
 const [siteType,setSiteType]=useState<'website'|'forum'>('website');
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
  e.preventDefault();
  if(!websiteUrl.trim()&&!sitemapUrls.trim()){setNotice({success:false,text:'Enter a website URL or a sitemap XML URL.'});return}
  setBusy(true);setNotice(null);
  try{
   const r=await fetch('/api/submit',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({websiteUrl,sitemapUrls,siteType,token,companyWebsite:''})
   });
   const d=await r.json();
   if(!r.ok) {
    setNotice({success:false,text:d.error||'Submission failed. Please retry.'});
   }else{
    setNotice({success:true,text:d.message||'Submission saved.',added:d.added,duplicates:d.duplicates,website:d.website});
    if(d.added>0||d.websiteAdded){setWebsiteUrl('');setSitemapUrls('');}
   }
  }catch{setNotice({success:false,text:'Cannot reach the server. Please retry.'})}
  finally{
   setBusy(false);
   if(sitekey){setToken('');window.turnstile?.reset?.();}
  }
 }

 return <main className="submit-page"><div className="panel">
  <a href="/" aria-label="OpenSearch home" style={{display:'inline-block',marginBottom:12,textDecoration:'none'}}>
   <span className="brand">Open<span>Search</span></span>
  </a>
  <h1>Submit a website or forum</h1>
  <p className="muted">Suggest a public website or discussion forum for OpenSearch indexing. All submissions are reviewed.</p>
  <form onSubmit={submit}>
   <label htmlFor="site-type">Site type</label>
   <select id="site-type" value={siteType} onChange={e=>setSiteType(e.target.value as 'website'|'forum')}
    style={{width:'100%',padding:'13px 15px',marginBottom:16,border:'1px solid #dce1ea',borderRadius:11,background:'#fff'}}>
    <option value="website">Website / blog</option>
    <option value="forum">Discussion forum</option>
   </select>
   {siteType==='forum'&&<p className="muted" style={{fontSize:12}}>Only publicly accessible threads are indexed. Login, member profiles and private messages are excluded. Public forum sitemaps are recommended.</p>}
   <label htmlFor="website">Website URL <span className="muted">(optional if a sitemap is provided)</span></label>
   <input id="website" type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)}
    placeholder="https://example.com" autoComplete="url"/>
   <label htmlFor="sitemaps">Sitemap XML URLs <span className="muted">(optional)</span></label>
   <textarea id="sitemaps" ref={field} rows={4} value={sitemapUrls} onChange={e=>setSitemapUrls(e.target.value)}
    placeholder={'https://example.com/post-sitemap.xml\nhttps://example.com/page-sitemap.xml'}/>
   <p className="muted" style={{fontSize:12}}>Add at least one URL. Use HTTPS and the same domain for all links. If you don't have a sitemap, we can discover accessible pages from the homepage after approval.</p>
   <div id="turnstile" style={{marginBottom:sitekey?16:0}}/>
   <button disabled={busy||!!sitekey&&!token}>{busy?'Submitting…':'Submit for review'}</button>
  </form>
  {notice&&<div role="status" aria-live="polite" className="panel" style={{margin:'18px 0 0',padding:16,background:notice.success?'#f4fbf7':'#fff6f4',borderColor:notice.success?'#bfe8d0':'#f0c7c4'}}>
   <strong>{notice.success?'Submission confirmed':'Submission not saved'}</strong>
   <p style={{marginBottom:8}}>{notice.text}</p>
   {notice.website&&<p className="muted" style={{fontSize:13}}>Website: {notice.website}</p>}
   {notice.success&&<button type="button" className="secondary" onClick={()=>{setWebsiteUrl('');setSitemapUrls('');setNotice(null);document.getElementById('website')?.focus()}}>Add another website or sitemap</button>}
  </div>}
 </div></main>;
}
