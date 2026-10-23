'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {AdminIcon} from './icons';
import type {AdminIconName} from './icons';

type Sitemap={id:string;url:string;status:'approved'|'pending'|'rejected'};
type Site={id:string;url:string;title:string;description:string;status:'approved'|'pending'|'rejected';submitted_at:string;website_sitemaps?:Sitemap[]};
type Job={id:string;website_id:string;status:'queued'|'running'|'completed'|'failed';discovered:number;processed:number;indexed:number;failed:number;error?:string|null;created_at:string;updated_at?:string;websites?:{url:string}|null};
type Page={id:string;website_id:string;url:string;title:string;description:string;is_published:boolean;updated_at:string};
type Counts=Record<'websites'|'approved'|'pendingWebsites'|'pendingSitemaps'|'sitemaps'|'indexedPages'|'allPages'|'queuedJobs'|'runningJobs'|'failedJobs'|'completedJobs'|'failedUrls',number>;
type Metrics={counts:Counts;updatedAt:string;configuration:{turnstile:boolean;emailOtp:boolean;autonomousCrawler:boolean;indexedUrlCapPerCrawl:number;crawlBatchSize:number}};
type AdminMember={user_id:string;username:string;created_at:string};
type CrawlFailure={url:string;last_error:string|null;attempts:number;kind:string;status:string};
type Section='overview'|'websites'|'sitemaps'|'submissions'|'pages'|'crawls'|'admins'|'settings'|'add-sitemap';
const NAV:{title:string;links:{id:Section;label:string;icon:AdminIconName}[]}[]=[
 {title:'WORKSPACE',links:[{id:'overview',label:'Overview',icon:'overview'},{id:'websites',label:'Websites',icon:'websites'},{id:'sitemaps',label:'Sitemap library',icon:'sitemap'},{id:'submissions',label:'Review queue',icon:'review'}]},
 {title:'SEARCH OPERATIONS',links:[{id:'pages',label:'Indexed pages',icon:'pages'},{id:'crawls',label:'Crawl monitor',icon:'crawls'}]},
 {title:'PLATFORM',links:[{id:'admins',label:'Administrators',icon:'users'},{id:'settings',label:'Settings',icon:'settings'}]}
];
const TITLES:Record<Section,{title:string;description:string}>={
 overview:{title:'Overview',description:'Your search index, review queue and indexing health at a glance.'},
 websites:{title:'Websites',description:'Manage indexed domains, approvals and reindexing.'},
 sitemaps:{title:'Sitemap library',description:'Review every XML sitemap attached to your websites.'},
 submissions:{title:'Review queue',description:'Approve or reject community-submitted websites and sitemaps.'},
 pages:{title:'Indexed pages',description:'Search your page index and control what appears in public results.'},
 crawls:{title:'Crawl monitor',description:'Follow sitemap processing, progress and individual fetch failures.'},
 admins:{title:'Administrators',description:'View authorised administrators and current access requirements.'},
 settings:{title:'Settings & health',description:'Review configuration, controls and platform readiness.'},
 'add-sitemap':{title:'Add website',description:'Add a website URL, XML sitemap links, or both for indexing.'}
};
function statusLabel(value:string){
 const labels:Record<string,string>={approved:'Approved',pending:'Pending review',rejected:'Rejected',queued:'Queued',running:'In progress',completed:'Finished',failed:'Finished with errors'};
 return labels[value]||value;
}
function Pill({value}:{value:string}){
 const tone=['approved','completed','published'].includes(value)?'green':value==='queued'||value==='pending'||value==='running'?'amber':value==='rejected'||value==='failed'?'red':'neutral';
 return <span className={'admin-pill admin-pill-'+tone}><span className="admin-pill-dot"/>{statusLabel(value)}</span>;
}
function Empty({icon,title,description}:{icon:AdminIconName;title:string;description:string}){
 return <div className="admin-empty"><span className="admin-empty-icon"><AdminIcon name={icon} size={24}/></span><strong>{title}</strong><p>{description}</p></div>;
}
function TinyDate({date}:{date?:string|null}){
 if(!date)return <span>—</span>;
 const d=new Date(date);
 return <span title={d.toLocaleString()}>{Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>;
}
function Btn({children,onClick,disabled,icon,kind='soft'}:{children:React.ReactNode;onClick:()=>void;disabled?:boolean;icon?:AdminIconName;kind?:'soft'|'primary'|'danger'}){
 return <button type="button" onClick={onClick} disabled={disabled} className={'admin-btn admin-btn-'+kind}>{icon&&<AdminIcon name={icon} size={16}/>}<span>{children}</span></button>;
}
async function getJSON(path:string){const r=await fetch(path,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}

export function AdminWorkspace({onLogout}:{onLogout:()=>void}){
 const pathname=usePathname();
 const part=pathname.split('/')[2] as Section|undefined;
 const section:Section=part&&TITLES[part]?part:'overview';
 const [mobileMenu,setMobileMenu]=useState(false);
 const [sites,setSites]=useState<Site[]>([]);
 const [jobs,setJobs]=useState<Job[]>([]);
 const [metrics,setMetrics]=useState<Metrics|null>(null);
 const [admins,setAdmins]=useState<AdminMember[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[toast,setToast]=useState<{success:boolean;text:string}|null>(null);
 const [updated,setUpdated]=useState('');
 const [filter,setFilter]=useState(''),[siteStatus,setSiteStatus]=useState('all');
 const [sitemapStatus,setSitemapStatus]=useState('all');
 const [submittedWebsite,setSubmittedWebsite]=useState(''),[submittedUrls,setSubmittedUrls]=useState(''),[indexInfo,setIndexInfo]=useState('');
 const field=useRef<HTMLTextAreaElement>(null);
 const activeJobs=useRef(new Set<string>());
 const [activeRuns,setActiveRuns]=useState<string[]>([]);
 const [pageRows,setPageRows]=useState<Page[]>([]);
 const [pageTotal,setPageTotal]=useState(0);
 const [pageNum,setPageNum]=useState(1);
 const [pageQuery,setPageQuery]=useState(''),[pageSearch,setPageSearch]=useState('');
 const [pageSite,setPageSite]=useState(''),[pageVisibility,setPageVisibility]=useState('all');
 const [pageLoading,setPageLoading]=useState(false);
 const [failureJob,setFailureJob]=useState<string|null>(null),[failures,setFailures]=useState<CrawlFailure[]>([]);
 const title=TITLES[section];

 const bySite=useMemo(()=>new Map(sites.map(site=>[site.id,site])),[sites]);
 const latestJobs=useMemo(()=>{
  const map=new Map<string,Job>();
  for(const job of jobs){if(!map.has(job.website_id))map.set(job.website_id,job)}
  return map;
 },[jobs]);
 const sitemapRows=useMemo(()=>sites.flatMap(site=>(site.website_sitemaps||[]).map(sm=>({...sm,website_id:site.id,website_url:site.url}))),[sites]);
 const pendingSites=sites.filter(site=>site.status==='pending');
 const pendingSitemaps=sitemapRows.filter(sm=>sm.status==='pending');
 const filteredSites=sites.filter(site=>(siteStatus==='all'||site.status===siteStatus)&&((site.url+' '+site.title).toLowerCase().includes(filter.toLowerCase())));
 const filteredSitemaps=sitemapRows.filter(sm=>(sitemapStatus==='all'||sm.status===sitemapStatus)&&((sm.url+' '+sm.website_url).toLowerCase().includes(filter.toLowerCase())));
 function notify(text:string,success=true){setToast({text,success})}
 async function refresh(){
  setError('');
  try{
   const [siteData,jobData,metricData]=await Promise.all([
    getJSON('/api/admin/submissions'),getJSON('/api/admin/crawl'),getJSON('/api/admin/overview')
   ]);
   setSites(siteData.websites||[]);
   setJobs(jobData.jobs||[]);
   setMetrics(metricData);
   setUpdated(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  }catch(e){setError(e instanceof Error?e.message:'Could not load administrator data')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{setMobileMenu(false);setToast(null);setFilter('')},[section]);
 useEffect(()=>{
  if(section!=='admins')return;
  let active=true;
  getJSON('/api/admin/admins').then(d=>{if(active)setAdmins(d.admins||[])}).catch(e=>{if(active)setError(String(e))});
  return()=>{active=false};
 },[section]);
 useEffect(()=>{
  if(section!=='pages')return;
  let active=true;setPageLoading(true);
  const p=new URLSearchParams({page:String(pageNum),status:pageVisibility});
  if(pageSite)p.set('websiteId',pageSite);
  if(pageSearch)p.set('search',pageSearch);
  getJSON('/api/admin/pages?'+p.toString()).then(d=>{
   if(active){setPageRows(d.pages||[]);setPageTotal(d.total||0)}
  }).catch(e=>{if(active)notify(String(e),false)}).finally(()=>{if(active)setPageLoading(false)});
  return()=>{active=false};
 },[section,pageNum,pageSite,pageVisibility,pageSearch]);
 async function api(path:string,method:'POST'|'PATCH',payload:object){
  const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  if(!r.ok)throw Error(d.error||'Operation failed');
  return d;
 }
 async function indexAll(jobId:string,quiet=false){
  if(activeJobs.current.has(jobId))return;
  activeJobs.current.add(jobId);setActiveRuns(Array.from(activeJobs.current));
  if(!quiet)setBusy(true);
  try{
   let completed=false;
   for(let n=0;n<300;n++){
    const d=await api('/api/admin/crawl','POST',{action:'process',jobId});
    setIndexInfo('Indexing job '+jobId.slice(0,8)+': '+d.indexed+' pages, '+d.failed+' failed URLs');
    if(d.done){
     completed=true;
     notify(d.status==='failed'?'Indexing finished with errors. Review the crawl monitor.':'Indexing finished successfully.',d.status!=='failed');
     break;
    }
   }
   if(!completed)notify('Indexing paused after 300 batches. You can resume it from Crawl Monitor.',false);
   await refresh();
  }catch(e){notify('Indexing paused: '+String(e),false)}
  finally{
   activeJobs.current.delete(jobId);setActiveRuns(Array.from(activeJobs.current));
   if(!quiet)setBusy(false);
  }
 }
 async function addSitemaps(e:FormEvent){
  e.preventDefault();
  if(!submittedWebsite.trim()&&!submittedUrls.trim()){notify('Enter a website URL, sitemap XML URL, or both.',false);return}
  setBusy(true);setToast(null);
  try{
   const d=await api('/api/admin/websites','POST',{websiteUrl:submittedWebsite,sitemapUrls:submittedUrls});
   notify(d.message||'Sitemap submission saved.');
   if(d.websiteAdded||d.added>0||d.approvedFromPending>0){setSubmittedWebsite('');setSubmittedUrls('')}
   await refresh();
   if(d.jobId)void indexAll(d.jobId,true);
  }catch(e){notify(String(e),false)}
  finally{setBusy(false)}
 }
 async function reviewSite(site:Site,status:'approved'|'rejected'){
  setBusy(true);
  try{
   const d=await api('/api/admin/submissions','PATCH',{...site,status});
   notify(d.indexingError||((status==='approved'?'Website approved.':'Website rejected.')+(d.jobId?' Indexing queued.':'')),!d.indexingError);
   await refresh();
   if(d.jobId)void indexAll(d.jobId,true);
  }catch(e){notify(String(e),false)}
  finally{setBusy(false)}
 }
 async function reviewSitemap(sm:Sitemap,status:'approved'|'rejected'){
  setBusy(true);
  try{
   const d=await api('/api/admin/sitemaps','PATCH',{id:sm.id,status});
   notify(d.warning||('Sitemap '+(status==='approved'?'approved':'rejected')+'.'+(d.jobId?' Indexing queued.':'')),!d.warning);
   await refresh();
   if(d.jobId)void indexAll(d.jobId,true);
  }catch(e){notify(String(e),false)}
  finally{setBusy(false)}
 }
 async function startCrawl(site:Site){
  setBusy(true);
  try{
   const d=await api('/api/admin/crawl','POST',{action:'start',websiteId:site.id});
   notify('Reindexing queued for '+site.url);
   await refresh();
   if(d.jobId)void indexAll(d.jobId,true);
  }catch(e){notify(String(e),false)}
  finally{setBusy(false)}
 }
 async function togglePage(p:Page){
  setBusy(true);
  try{
   await api('/api/admin/pages','PATCH',{id:p.id,is_published:!p.is_published});
   setPageRows(rows=>rows.map(row=>row.id===p.id?{...row,is_published:!p.is_published}:row));
   notify(p.is_published?'Page hidden from public search.':'Page published in search.');
   await refresh();
  }catch(e){notify(String(e),false)}
  finally{setBusy(false)}
 }
 async function showFailures(jobId:string){
  if(failureJob===jobId){setFailureJob(null);return}
  try{
   const d=await getJSON('/api/admin/crawl?jobId='+encodeURIComponent(jobId));
   setFailures(d.errors||[]);setFailureJob(jobId);
  }catch(e){notify(String(e),false)}
 }
 async function logout(){
  await fetch('/api/admin/logout',{method:'POST'});
  onLogout();
 }
 const navLink=(id:Section,label:string,icon:AdminIconName,compact=false)=>
  <Link key={id} href={id==='overview'?'/smartadmin':'/smartadmin/'+id} className={'admin-nav-link'+(section===id?' is-active':'')} aria-current={section===id?'page':undefined} onClick={()=>setMobileMenu(false)}>
   <AdminIcon name={icon} size={18}/><span>{label}</span>
   {id==='submissions'&&((metrics?.counts.pendingSitemaps||0)+(metrics?.counts.pendingWebsites||0)>0)&&<span className="admin-nav-count">{(metrics?.counts.pendingSitemaps||0)+(metrics?.counts.pendingWebsites||0)}</span>}
  </Link>;

 return <div className="admin-app">
  {mobileMenu&&<button type="button" className="admin-mobile-overlay" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}/>}
  <aside className={'admin-sidebar'+(mobileMenu?' is-open':'')}>
   <div className="admin-sidebar-top"><Link className="admin-logo" href="/" aria-label="OpenSearch homepage">Open<span>Search</span><small>ADMIN</small></Link><button className="admin-icon-btn admin-close-mobile" onClick={()=>setMobileMenu(false)} aria-label="Close menu"><AdminIcon name="close"/></button></div>
   <div className="admin-sidebar-caption">SEARCH PLATFORM</div>
   <nav className="admin-nav" aria-label="Administrator navigation">
    {NAV.map(group=><div className="admin-nav-group" key={group.title}><div className="admin-nav-heading">{group.title}</div>{group.links.map(l=>navLink(l.id,l.label,l.icon))}</div>)}
   </nav>
   <div className="admin-sidebar-bottom"><div className="admin-environment"><span className="admin-online-dot"/> Production <span className="admin-env-sub">OpenSearch</span></div><button className="admin-nav-link admin-logout" type="button" onClick={logout}><AdminIcon name="logout" size={18}/> Sign out</button></div>
  </aside>

  <div className="admin-main-area">
   <header className="admin-topbar">
    <div className="admin-topbar-left"><button type="button" className="admin-icon-btn admin-menu-toggle" aria-label="Open navigation" onClick={()=>setMobileMenu(true)}><AdminIcon name="menu"/></button><span className="admin-breadcrumb">Workspace</span><AdminIcon name="chevron" size={13}/><span className="admin-breadcrumb-current">{title.title}</span></div>
    <div className="admin-top-actions">
     <a className="admin-top-link" href="/" target="_blank" rel="noreferrer"><AdminIcon name="external" size={15}/> View search</a>
     <button className="admin-icon-btn" onClick={()=>void refresh()} title="Refresh data" aria-label="Refresh data"><AdminIcon name="refresh" size={18}/></button>
     <div className="admin-avatar" title="Administrator account">A</div>
    </div>
   </header>
   <div className="admin-content">
    <div className="admin-page-heading"><div><div className="admin-eyebrow">OPENSEARCH CONTROL CENTER</div><h1>{title.title}</h1><p>{title.description}</p></div><div className="admin-heading-actions">
     <Link href="/smartadmin/add-sitemap" className="admin-btn admin-btn-primary"><AdminIcon name="plus" size={17}/> Add website</Link>
    </div></div>
    {toast&&<div className={'admin-notice'+(toast.success?' is-success':' is-error')} role="status"><AdminIcon name={toast.success?'check':'warning'} size={18}/><span>{toast.text}</span><button type="button" onClick={()=>setToast(null)} aria-label="Dismiss message"><AdminIcon name="close" size={15}/></button></div>}
    {error&&<div className="admin-notice is-error" role="alert"><AdminIcon name="warning" size={18}/> {error} <Btn onClick={()=>void refresh()}>Retry</Btn></div>}
    {activeRuns.length>0&&<div className="admin-notice is-info"><AdminIcon name="activity" size={18}/><span>{activeRuns.length} indexing run(s) processing in this browser. {indexInfo}</span></div>}
    {loading&&<div className="admin-loading"><span className="admin-spinner"/> Loading live index data…</div>}
    {!loading&&<>

    {section==='overview'&&<>
     <div className="admin-kpi-grid">
      {([
       {name:'Websites',value:metrics?.counts.websites??0,icon:'websites' as AdminIconName,info:(metrics?.counts.approved??0)+' approved',className:'blue'},
       {name:'Indexed pages',value:metrics?.counts.indexedPages??0,icon:'pages' as AdminIconName,info:(metrics?.counts.allPages??0)+' total page records',className:'violet'},
       {name:'Sitemap URLs',value:metrics?.counts.sitemaps??0,icon:'sitemap' as AdminIconName,info:'Across all websites',className:'teal'},
       {name:'Awaiting review',value:(metrics?.counts.pendingWebsites??0)+(metrics?.counts.pendingSitemaps??0),icon:'review' as AdminIconName,info:(metrics?.counts.pendingSitemaps??0)+' pending sitemaps',className:'amber'}
      ]).map(card=><div className="admin-kpi" key={card.name}><div className="admin-kpi-top"><span>{card.name}</span><span className={'admin-kpi-icon '+card.className}><AdminIcon name={card.icon} size={20}/></span></div><strong>{card.value.toLocaleString()}</strong><small>{card.info}</small></div>)}
     </div>
     <div className="admin-dashboard-columns">
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Needs your attention</h2><p>New submissions waiting for a decision</p></div><Link className="admin-text-link" href="/smartadmin/submissions">Review all <AdminIcon name="arrow" size={15}/></Link></div>
       {pendingSites.length+pendingSitemaps.length===0?<Empty icon="check" title="You're all caught up" description="No submissions currently need review."/>:
        <div className="admin-stack">
         {pendingSites.slice(0,3).map(s=><div className="admin-feed-row" key={s.id}><span className="admin-feed-icon"><AdminIcon name="websites" size={18}/></span><div><strong>{s.title||s.url}</strong><small>New website · <TinyDate date={s.submitted_at}/></small></div><Pill value="pending"/></div>)}
         {pendingSitemaps.slice(0,4).map(sm=><div className="admin-feed-row" key={sm.id}><span className="admin-feed-icon"><AdminIcon name="sitemap" size={18}/></span><div><strong className="admin-truncate">{sm.url}</strong><small>New sitemap · {sm.website_url}</small></div><Pill value="pending"/></div>)}
        </div>}
      </section>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Indexing health</h2><p>Status across all crawl jobs</p></div><Link href="/smartadmin/crawls" className="admin-text-link">Crawl monitor <AdminIcon name="arrow" size={15}/></Link></div>
       <div className="admin-health-grid"><div><strong>{(metrics?.counts.runningJobs??0)+(metrics?.counts.queuedJobs??0)}</strong><span>Active / queued</span></div><div><strong>{metrics?.counts.completedJobs??0}</strong><span>Finished</span></div><div><strong>{metrics?.counts.failedJobs??0}</strong><span>With errors</span></div></div>
       <div className="admin-health-note"><AdminIcon name="activity" size={16}/> {metrics?.configuration.autonomousCrawler?'Automatic worker enabled':'Indexing requires an active admin processing session; scheduled workers are not configured.'}</div>
      </section>
     </div>
     <section className="admin-panel"><div className="admin-panel-header"><div><h2>Recent website activity</h2><p>Latest sites and their current indexing status</p></div><Link href="/smartadmin/websites" className="admin-text-link">All websites <AdminIcon name="arrow" size={15}/></Link></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Website</th><th>Approval</th><th>Indexing</th><th>Sitemaps</th></tr></thead><tbody>{sites.slice(0,7).map(s=><tr key={s.id}><td><span className="admin-strong">{s.title||s.url}</span><small>{s.url}</small></td><td><Pill value={s.status}/></td><td>{s.status==='approved'?<Pill value={latestJobs.get(s.id)?.status||'none'}/>:<span className="admin-muted">—</span>}</td><td>{s.website_sitemaps?.length??0}</td></tr>)}</tbody></table>{sites.length===0&&<Empty icon="websites" title="No websites yet" description="Add your first sitemap to start indexing."/>}</div>
     </section>
    </>}

    {section==='websites'&&<section className="admin-panel"><div className="admin-panel-header"><div><h2>Website directory</h2><p>{sites.length} sites in the latest 100 records</p></div><div className="admin-filter-row"><div className="admin-search-field"><AdminIcon name="search" size={16}/><input aria-label="Find websites" placeholder="Search domains…" value={filter} onChange={e=>setFilter(e.target.value)}/></div><select aria-label="Website status" value={siteStatus} onChange={e=>setSiteStatus(e.target.value)}><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div></div>
     <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Website</th><th>Approval</th><th>Indexing</th><th>Sitemaps</th><th>Last run</th><th>Actions</th></tr></thead><tbody>{filteredSites.map(s=><tr key={s.id}><td><span className="admin-strong">{s.title||new URL(s.url).hostname}</span><a className="admin-sub-link" href={s.url} rel="noreferrer noopener" target="_blank">{s.url} <AdminIcon name="external" size={12}/></a></td><td><Pill value={s.status}/></td><td>{s.status==='approved'?<Pill value={latestJobs.get(s.id)?.status||'none'}/>:<span className="admin-muted">—</span>}</td><td>{s.website_sitemaps?.length??0}</td><td><TinyDate date={latestJobs.get(s.id)?.created_at}/></td><td><div className="admin-actions">{s.status!=='approved'&&<Btn disabled={busy} kind="primary" onClick={()=>void reviewSite(s,'approved')}>Approve</Btn>}{s.status==='approved'&&<Btn disabled={busy} icon="refresh" onClick={()=>void startCrawl(s)}>Reindex</Btn>}<Btn disabled={busy} kind="soft" onClick={()=>void reviewSite(s,'rejected')}>Reject</Btn></div></td></tr>)}</tbody></table></div>
     {filteredSites.length===0&&<Empty icon="websites" title="No matching websites" description="Try another filter or add a sitemap."/>}
    </section>}

    {section==='sitemaps'&&<section className="admin-panel"><div className="admin-panel-header"><div><h2>Sitemap directory</h2><p>{sitemapRows.length} XML links across all websites (latest 100 websites)</p></div><div className="admin-filter-row"><div className="admin-search-field"><AdminIcon name="search" size={16}/><input aria-label="Find sitemaps" placeholder="Filter sitemap URLs…" value={filter} onChange={e=>setFilter(e.target.value)}/></div><select aria-label="Sitemap status" value={sitemapStatus} onChange={e=>setSitemapStatus(e.target.value)}><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending review</option><option value="rejected">Rejected</option></select></div></div>
     <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Sitemap XML URL</th><th>Website</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredSitemaps.map(sm=><tr key={sm.id}><td><a className="admin-url" href={sm.url} rel="noopener noreferrer" target="_blank">{sm.url} <AdminIcon name="external" size={12}/></a></td><td>{sm.website_url}</td><td><Pill value={sm.status}/></td><td><div className="admin-actions">{sm.status!=='approved'&&<Btn disabled={busy} kind="primary" onClick={()=>void reviewSitemap(sm,'approved')}>Approve</Btn>}{sm.status!=='rejected'&&<Btn disabled={busy} onClick={()=>void reviewSitemap(sm,'rejected')}>Reject</Btn>}</div></td></tr>)}</tbody></table></div>
     {filteredSitemaps.length===0&&<Empty icon="sitemap" title="No sitemaps found" description="Add a sitemap or adjust your filters."/>}
    </section>}

    {section==='submissions'&&<div className="admin-dashboard-columns">
     <section className="admin-panel"><div className="admin-panel-header"><div><h2>Website approvals</h2><p>{metrics?.counts.pendingWebsites??pendingSites.length} awaiting review</p></div></div>
      {pendingSites.length===0?<Empty icon="check" title="No pending websites" description="New website submissions will appear here."/>:pendingSites.map(s=><div className="admin-review-card" key={s.id}><div><strong>{s.title||s.url}</strong><small>{s.url}</small><small><TinyDate date={s.submitted_at}/></small></div><div className="admin-actions"><Btn disabled={busy} kind="primary" onClick={()=>void reviewSite(s,'approved')}>Approve</Btn><Btn disabled={busy} onClick={()=>void reviewSite(s,'rejected')}>Reject</Btn></div></div>)}
     </section>
     <section className="admin-panel"><div className="admin-panel-header"><div><h2>Sitemap approvals</h2><p>{metrics?.counts.pendingSitemaps??pendingSitemaps.length} awaiting review</p></div></div>
      {pendingSitemaps.length===0?<Empty icon="check" title="No pending sitemaps" description="Community sitemap suggestions will appear here."/>:pendingSitemaps.map(sm=><div className="admin-review-card" key={sm.id}><div><strong className="admin-break">{sm.url}</strong><small>{sm.website_url}</small></div><div className="admin-actions"><Btn disabled={busy} kind="primary" onClick={()=>void reviewSitemap(sm,'approved')}>Approve</Btn><Btn disabled={busy} onClick={()=>void reviewSitemap(sm,'rejected')}>Reject</Btn></div></div>)}
     </section>
    </div>}

    {section==='pages'&&<section className="admin-panel"><div className="admin-panel-header"><div><h2>Search index</h2><p>{pageTotal.toLocaleString()} matching pages · 25 per page</p></div></div>
     <form className="admin-toolbar" onSubmit={e=>{e.preventDefault();setPageNum(1);setPageSearch(pageQuery)}}>
      <div className="admin-search-field"><AdminIcon name="search" size={17}/><input aria-label="Search indexed pages" value={pageQuery} onChange={e=>setPageQuery(e.target.value)} placeholder="Search titles or URLs"/></div>
      <select aria-label="Filter pages by website" value={pageSite} onChange={e=>{setPageSite(e.target.value);setPageNum(1)}}><option value="">All websites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.title||s.url}</option>)}</select>
      <select aria-label="Page visibility" value={pageVisibility} onChange={e=>{setPageVisibility(e.target.value);setPageNum(1)}}><option value="all">All pages</option><option value="published">Published</option><option value="hidden">Hidden</option></select>
      <button className="admin-btn admin-btn-primary" type="submit">Search</button>
     </form>
     {pageLoading&&<p className="admin-muted">Loading pages…</p>}
     <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Page</th><th>Website</th><th>Visibility</th><th>Updated</th><th>Action</th></tr></thead><tbody>{pageRows.map(p=><tr key={p.id}><td><span className="admin-strong">{p.title||p.url}</span><a className="admin-sub-link" href={p.url} target="_blank" rel="noopener noreferrer">{p.url} <AdminIcon name="external" size={12}/></a></td><td>{bySite.get(p.website_id)?.title||bySite.get(p.website_id)?.url||'Unknown'}</td><td><Pill value={p.is_published?'published':'hidden'}/></td><td><TinyDate date={p.updated_at}/></td><td><Btn disabled={busy} onClick={()=>void togglePage(p)}>{p.is_published?'Unpublish':'Publish'}</Btn></td></tr>)}</tbody></table></div>
     {!pageLoading&&pageRows.length===0&&<Empty icon="pages" title="No matching pages" description="Try changing the filters or index more websites."/>}
     <div className="admin-pagination"><span>Page {pageNum} of {Math.max(1,Math.ceil(pageTotal/25))}</span><div><Btn disabled={pageNum<=1||pageLoading} icon="chevron" onClick={()=>setPageNum(n=>Math.max(1,n-1))}>Previous</Btn><Btn disabled={pageNum*25>=pageTotal||pageLoading} icon="arrow" onClick={()=>setPageNum(n=>n+1)}>Next</Btn></div></div>
    </section>}

    {section==='crawls'&&<section className="admin-panel"><div className="admin-panel-header"><div><h2>Indexing jobs</h2><p>Latest {jobs.length} crawl jobs, with up to 50 failed URLs per job</p></div><Btn icon="refresh" onClick={()=>void refresh()}>Refresh</Btn></div>
     <div className="admin-crawl-list">{jobs.map(j=><div className="admin-crawl-entry" key={j.id}>
      <div className="admin-crawl-head"><div><strong>{j.websites?.url||bySite.get(j.website_id)?.url||j.website_id}</strong><small>Started <TinyDate date={j.created_at}/> · {j.id.slice(0,8)}</small></div><Pill value={j.status}/></div>
      <div className="admin-crawl-progress"><span style={{width:Math.min(100,Math.max(0,(j.processed/Math.max(j.discovered,j.processed,1))*100))+'%'}}/></div>
      <div className="admin-crawl-metrics"><span>{j.discovered.toLocaleString()} discovered</span><span>{j.processed.toLocaleString()} processed</span><span>{j.indexed.toLocaleString()} indexed</span><span>{j.failed.toLocaleString()} failed</span></div>
      {j.error&&<p className="admin-inline-error"><AdminIcon name="warning" size={15}/> {j.error}</p>}
      <div className="admin-actions"><Btn kind="primary" disabled={activeRuns.includes(j.id)||busy||j.status==='completed'||j.status==='failed'} onClick={()=>void indexAll(j.id)}>{activeRuns.includes(j.id)?'Indexing…':'Process remaining'}</Btn>{j.failed>0&&<Btn icon="warning" onClick={()=>void showFailures(j.id)}>{failureJob===j.id?'Hide errors':'Inspect errors'}</Btn>}</div>
      {failureJob===j.id&&<div className="admin-failure-box">{failures.length===0?<p>No stored failure details.</p>:failures.map((item,i)=><div className="admin-failure-row" key={i}><strong>{item.url}</strong><p>{item.last_error||'Unspecified error'} · {item.attempts} attempt(s)</p></div>)}</div>}
     </div>)}</div>{jobs.length===0&&<Empty icon="crawls" title="No crawl jobs" description="Add and approve a sitemap to start indexing."/>}
    </section>}

    {section==='add-sitemap'&&<div className="admin-form-columns"><section className="admin-panel admin-form-panel">
     <div className="admin-panel-header"><div><h2>Add website or sitemaps</h2><p>Both fields are optional individually, but at least one is required.</p></div><span className="admin-panel-emblem"><AdminIcon name="websites" size={22}/></span></div>
     <form onSubmit={addSitemaps}>
      <label htmlFor="admin-website-input" className="admin-form-label">Website HTTPS URL</label>
      <input id="admin-website-input" type="url" value={submittedWebsite} onChange={e=>setSubmittedWebsite(e.target.value)}
       placeholder="https://example.org" autoComplete="url" className="admin-textarea" style={{minHeight:0,marginBottom:18}}/>
      <label htmlFor="sitemapsInput" className="admin-form-label">Sitemap XML URLs (optional, one per line)</label>
      <textarea id="sitemapsInput" rows={5} ref={field} value={submittedUrls} onChange={e=>setSubmittedUrls(e.target.value)}
       className="admin-textarea" placeholder={'https://example.org/post-sitemap.xml\nhttps://example.org/page-sitemap.xml'}/>
      <p className="admin-help-text">Add a website by itself to discover accessible internal pages, add only XML sitemaps to derive the website automatically, or add both. All links must be HTTPS and from the same domain. Previously saved links are preserved.</p>
      <button className="admin-btn admin-btn-primary" type="submit" disabled={busy}><AdminIcon name="plus" size={17}/>{busy?'Saving…':'Save and start indexing'}</button>
     </form>
     </section><section className="admin-panel admin-guidance"><h2>Indexing workflow</h2>
      <div className="admin-guide-step"><span>1</span><div><strong>Add the website or sitemaps</strong><p>Start with a website URL, sitemap URL, or both.</p></div></div>
      <div className="admin-guide-step"><span>2</span><div><strong>Keep existing records</strong><p>Multiple sitemaps are grouped under their website; duplicates are not added.</p></div></div>
      <div className="admin-guide-step"><span>3</span><div><strong>Index permitted public pages</strong><p>The homepage and approved XML sitemap links feed the indexer in batches.</p></div></div>
      <div className="admin-guidance-note"><AdminIcon name="shield" size={17}/> Indexing runs in batches and may pause if this admin session ends. Resume the job in Crawl Monitor.</div>
      {indexInfo&&<p className="admin-muted" style={{padding:18}}>{indexInfo}</p>}
     </section></div>}

    {section==='admins'&&<section className="admin-panel"><div className="admin-panel-header"><div><h2>Authorised administrators</h2><p>Allowlisted accounts connected to Supabase Auth</p></div><Pill value="approved"/></div>
     <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Username</th><th>Access</th><th>Added</th></tr></thead><tbody>{admins.map(a=><tr key={a.user_id}><td><div className="admin-user-row"><span className="admin-user-avatar">{a.username.charAt(0).toUpperCase()}</span><strong>{a.username}</strong></div></td><td><Pill value="approved"/></td><td><TinyDate date={a.created_at}/></td></tr>)}</tbody></table></div>{admins.length===0&&<Empty icon="users" title="No administrators listed" description="Check Supabase Auth allowlist configuration."/>}<div className="admin-guidance-note admin-guidance-bottom"><AdminIcon name="shield" size={17}/> Admin creation and password changes are intentionally managed through Supabase Auth. This screen does not expose passwords or allow self-granting access.</div>
    </section>}

    {section==='settings'&&<div className="admin-settings-grid">
     <section className="admin-panel"><div className="admin-panel-header"><div><h2>Search platform</h2><p>Current application configuration</p></div><AdminIcon name="database" size={20}/></div>
      <div className="admin-setting-row"><div><strong>Supabase index</strong><small>Approved website and page records</small></div><Pill value={metrics?'approved':'unknown'}/></div>
      <div className="admin-setting-row"><div><strong>URL limit per crawl</strong><small>Bounded queue capacity</small></div><b>{metrics?.configuration.indexedUrlCapPerCrawl.toLocaleString()??'—'}</b></div>
      <div className="admin-setting-row"><div><strong>Fetch requests per batch</strong><small>Limits requests per serverless execution</small></div><b>{metrics?.configuration.crawlBatchSize??'—'}</b></div>
      <div className="admin-setting-row"><div><strong>Automatic background worker</strong><small>Independent of the browser session</small></div><Pill value={metrics?.configuration.autonomousCrawler?'approved':'none'}/></div>
     </section>
     <section className="admin-panel"><div className="admin-panel-header"><div><h2>Security & submissions</h2><p>How public requests and admins are protected</p></div><AdminIcon name="shield" size={20}/></div>
      <div className="admin-setting-row"><div><strong>Administrator authentication</strong><small>Supabase Auth with allowlisted accounts</small></div><Pill value="approved"/></div>
      <div className="admin-setting-row"><div><strong>Login email OTP</strong><small>Temporarily deferred</small></div><Pill value={metrics?.configuration.emailOtp?'approved':'none'}/></div>
      <div className="admin-setting-row"><div><strong>Cloudflare Turnstile</strong><small>Used when configured; otherwise server rate limits apply</small></div><Pill value={metrics?.configuration.turnstile?'approved':'none'}/></div>
      <div className="admin-setting-row"><div><strong>Review requirement</strong><small>Public sitemaps must be approved before indexing</small></div><Pill value="approved"/></div>
     </section>
     <div className="admin-guidance-note admin-settings-wide"><AdminIcon name="warning" size={18}/> These settings are read-only operational indicators. Enabling background workers, SMTP OTP or changing security keys requires a reviewed engineering change and deployment.</div>
    </div>}

    </>}
    <div className="admin-content-footer"><span>OpenSearch administration · Production</span><span>Data checked {updated||'—'} · Live Supabase index</span></div>
   </div>
  </div>
 </div>;
}
