'use client';
import {useEffect,useState} from 'react';
type Sitemap={id:string;url:string;status:'pending'|'approved'|'rejected'};
type Site={id:string;url:string;title:string;description:string;sitemap_url:string|null;status:string;website_sitemaps?:Sitemap[]};
type Job={id:string;website_id:string;status:string;discovered:number;processed:number;indexed:number;failed:number;created_at:string;websites?:{url:string}|null};
type Page={id:string;url:string;title:string;description:string;is_published:boolean;website_id:string};
export function AdminWorkspace(){
 const [tab,setTab]=useState('overview'),[sites,setSites]=useState<Site[]>([]),[jobs,setJobs]=useState<Job[]>([]),[pages,setPages]=useState<Page[]>([]);
 const [sitemapUrls,setSitemapUrls]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 function latestJob(id:string){return jobs.filter(j=>j.website_id===id).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0]}
 function jobLabel(j?:Job){if(!j)return 'Not indexed';if(j.status==='queued')return 'Queued';if(j.status==='running')return 'In progress';if(j.status==='failed'||(j.status==='completed'&&(j.failed>0||j.indexed===0)))return 'Finished with errors';if(j.status==='completed')return 'Finished';return 'Unknown'}
 function websiteLabel(s:Site){if(s.status==='pending')return 'Awaiting approval';if(s.status==='rejected')return 'Rejected';return jobLabel(latestJob(s.id))}

 async function refresh(){
  const [a,b,c]=await Promise.all([fetch('/api/admin/submissions'),fetch('/api/admin/crawl'),fetch('/api/admin/pages')]);
  if(a.ok)setSites((await a.json()).websites||[]);
  if(b.ok)setJobs((await b.json()).jobs||[]);
  if(c.ok)setPages((await c.json()).pages||[]);
 }
 useEffect(()=>{refresh()},[]);
 async function call(path:string,body:object){setBusy(true);setMessage('');try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');setMessage(d.jobId?'Sitemap saved and indexing queued.':d.done?'Crawl completed.':d.warning||'Updated successfully');await refresh();return d}catch(e){setMessage(String(e));return null}finally{setBusy(false)}}
 async function indexAll(jobId:string){
 setBusy(true);setMessage('Indexing website pages...');
 try{
  for(let batch=0;batch<300;batch++){
   const response=await fetch('/api/admin/crawl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'process',jobId})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Crawl failed');
   setMessage('Indexed '+result.indexed+' pages, processed '+result.processed+' URLs, '+result.failed+' failures.');
   if(result.done){setMessage(result.status==='failed'?'Indexing finished with errors: '+result.indexed+' pages indexed, '+result.failed+' failed.':'Indexing finished: '+result.indexed+' pages indexed.');break;}
  }
  await refresh();
 }catch(error){setMessage('Crawl paused: '+String(error))}
 finally{setBusy(false)}
 }
 async function reviewSitemap(sitemap:Sitemap,status:'approved'|'rejected'){
  setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/admin/sitemaps',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:sitemap.id,status})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to review sitemap');
   setMessage(d.jobId?'Sitemap approved and indexing queued.':d.warning||'Sitemap '+status+'.');
   await refresh();
   if(d.jobId)await indexAll(d.jobId);
  }catch(e){setMessage(String(e))}finally{setBusy(false)}
 }
 async function approve(s:Site,status:string){setBusy(true);try{const r=await fetch('/api/admin/submissions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,status})});const d=await r.json();setMessage(r.ok?(d.jobId?'Approved and indexing queued.':'Saved'):(d.error||'Update failed'));await refresh()}finally{setBusy(false)}}
 return <div style={{maxWidth:1100,margin:'0 auto'}}><div className="actions" style={{flexWrap:'wrap',marginBottom:25}}>{[['overview','Overview'],['websites','Websites'],['submit','Add sitemap'],['jobs','Crawl jobs'],['pages','Indexed pages'],['settings','Settings']].map(([key,label])=><button type="button" key={key} className={tab===key?'':'secondary'} onClick={()=>setTab(key)}>{label}</button>)}<button className="secondary" onClick={refresh}>Refresh</button><button className="secondary" onClick={async()=>{await fetch('/api/admin/logout',{method:'POST'});location.reload()}}>Log out</button></div>
 <p role="status" className="status">{message}</p>
 {tab==='overview'&&<><h2>Search engine overview</h2><div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))'}}>{[['Websites',sites.length],['Awaiting review',sites.filter(x=>x.status==='pending').length],['Indexed pages',pages.length],['Active crawl jobs',jobs.filter(x=>x.status==='queued'||x.status==='running').length]].map(([name,n])=><div key={name} className="panel" style={{margin:0}}><strong>{n}</strong><p className="muted">{name}</p></div>)}</div><p className="muted">Use Websites to review submissions, Add website to start a new crawl, and Crawl jobs to process pending sitemap batches.</p></>}
 {tab==='submit'&&<div className="panel"><h2>Add sitemaps and index pages</h2><form onSubmit={async e=>{e.preventDefault();const d=await call('/api/admin/websites',{sitemapUrls});if(d){setSitemapUrls('');if(d.jobId)await indexAll(d.jobId);setTab('websites')}}}><label>Sitemap XML URLs (one per line)</label><textarea rows={5} value={sitemapUrls} onChange={e=>setSitemapUrls(e.target.value)} placeholder={'https://example.org/posts-sitemap.xml\\nhttps://example.org/courses-sitemap.xml'} required/><p className="muted">All sitemaps must belong to the same website. Existing entries are kept. Maximum 30 URLs per submission.</p><button disabled={busy}>Add sitemaps and index website</button></form></div>}
 {tab==='websites'&&<><h2>Website management</h2>{sites.map(s=><div className="adminrow" key={s.id}><strong>{s.title||s.url}</strong><p><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></p><p className="muted"><strong>Approval:</strong> {s.status==='approved'?'Approved':s.status==='pending'?'Awaiting approval':'Rejected'} · <strong>Indexing:</strong> {websiteLabel(s)} · <strong>Indexed pages (latest run):</strong> {latestJob(s.id)?.indexed??0} · <strong>Failed URLs:</strong> {latestJob(s.id)?.failed??0}</p><div className="muted" style={{marginBottom:12}}><strong>Sitemaps ({s.website_sitemaps?.length??0}):</strong>{s.website_sitemaps?.length?s.website_sitemaps.map(sm=><div key={sm.id} style={{padding:'6px 0',overflowWrap:'anywhere'}}><a href={sm.url} target="_blank" rel="noopener noreferrer">{sm.url}</a> · <strong>{sm.status==='approved'?'Approved':sm.status==='pending'?'Pending review':'Rejected'}</strong>{sm.status!=='approved'&&<button type="button" className="secondary" style={{marginLeft:8}} disabled={busy} onClick={()=>reviewSitemap(sm,'approved')}>Approve sitemap</button>}{sm.status==='pending'&&<button type="button" className="secondary" style={{marginLeft:5}} disabled={busy} onClick={()=>reviewSitemap(sm,'rejected')}>Reject sitemap</button>}</div>):<p>No sitemap URLs added yet</p>}</div><div className="actions">{s.status!=='approved'&&<button disabled={busy} onClick={()=>approve(s,'approved')}>Approve and index</button>}<button disabled={busy} className="secondary" onClick={()=>approve(s,'rejected')}>Reject</button><button disabled={busy||s.status!=='approved'} className="secondary" onClick={()=>call('/api/admin/crawl',{action:'start',websiteId:s.id})}>Reindex</button></div></div>)}</>}
 {tab==='jobs'&&<><h2>Crawl jobs</h2><p className="muted">Process batches of six sitemap/page requests. Large sites require repeated batches; no unlimited crawl is attempted in one request.</p>{jobs.map(j=><div className="adminrow" key={j.id}><strong>{j.websites?.url||j.website_id}</strong><p className="muted">Status: {jobLabel(j)} · Discovered: {j.discovered} · Processed: {j.processed} · Indexed: {j.indexed} · Failed: {j.failed}</p><button disabled={busy||j.status==='completed'||j.status==='failed'} onClick={()=>indexAll(j.id)}>Index all pages</button><button className="secondary" disabled={busy||j.status==='completed'||j.status==='failed'} onClick={()=>call('/api/admin/crawl',{action:'process',jobId:j.id})}>Process next batch</button></div>)}</>}
 {tab==='pages'&&<><h2>Indexed pages</h2><p className="muted">Latest 150 pages. Disable a page to remove it from public search results.</p>{pages.map(p=><div className="adminrow" key={p.id}><strong>{p.title||p.url}</strong><p><a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a></p><p className="muted">{p.description}</p><button disabled={busy} className="secondary" onClick={async()=>{setBusy(true);try{await fetch('/api/admin/pages',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,is_published:!p.is_published})});await refresh()}finally{setBusy(false)}}}>{p.is_published?'Unpublish':'Publish'}</button></div>)}</>}
 {tab==='settings'&&<div className="panel"><h2>Indexing settings</h2><p className="muted">Current safety limits: 10,000 queued URLs per crawl, six tasks per batch, same-domain HTTPS only, restricted response size and fetch timeouts.</p><p className="muted">Public submissions require Cloudflare Turnstile. Admin access requires Supabase authentication.</p></div>}
 </div>
}
