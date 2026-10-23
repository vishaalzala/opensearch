'use client';
import {useEffect,useState} from 'react';
type Result={id:string;url:string;title:string;description:string|null;tags:string[]};
export default function Search(){
 const [q,setQ]=useState(''),[results,setResults]=useState<Result[]>([]),[state,setState]=useState('Loading...'),[page,setPage]=useState(1),[totalPages,setTotalPages]=useState(0);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const query=(params.get('q')||'').trim();
  const current=Math.min(1000,Math.max(1,Number.parseInt(params.get('page')||'1',10)||1));
  setQ(query);setPage(current);
  if(query.length<2){setState('Enter at least two characters');return}
  let active=true;
  setState('Searching...');
  fetch('/api/search?q='+encodeURIComponent(query)+'&page='+current,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
   if(!active)return;
   setResults(d.results||[]);
   setTotalPages(d.totalPages||0);
   setState(d.total?String(d.total)+' results · Page '+current+' of '+d.totalPages:'No results');
  }).catch(()=>{if(active)setState('Search unavailable; try again later')});
  return()=>{active=false};
 },[]);
 const pages:number[]=[];
 const start=Math.max(1,Math.min(page-2,Math.max(1,totalPages-4)));
 for(let n=start;n<=Math.min(totalPages,start+4);n++)pages.push(n);
 const link=(p:number)=>'/search?q='+encodeURIComponent(q)+'&page='+p;
 return <main>
  <a href="/" aria-label="OpenSearch homepage" className="brand" style={{display:'inline-block',marginBottom:18}}>Open<span>Search</span></a>
  <form action="/search" className="searchform"><input name="q" defaultValue={q} placeholder="Search..." required minLength={2}/><button>Search</button></form>
  <p className="muted status">{state}</p>
  {results.map(r=><div className="result" key={r.id}><small>{r.url}</small><h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title||r.url} ↗</a></h3><p>{r.description}</p></div>)}
  {totalPages>1&&<nav aria-label="Search result pages" style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:32}}>
   {page>1&&<a href={link(page-1)} style={{padding:10}}>← Previous</a>}
   {start>1&&<><a href={link(1)} style={{padding:10}}>1</a>{start>2&&<span aria-hidden="true">…</span>}</>}
   {pages.map(n=><a key={n} href={link(n)} aria-current={n===page?'page':undefined} style={{padding:'9px 13px',borderRadius:9,background:n===page?'#2865d9':'#eef2f8',color:n===page?'white':'#2363cc',fontWeight:n===page?700:400}}>{n}</a>)}
   {start+4<totalPages&&<><span aria-hidden="true">…</span><a href={link(totalPages)} style={{padding:10}}>{totalPages}</a></>}
   {page<totalPages&&<a href={link(page+1)} style={{padding:10}}>Next →</a>}
  </nav>}
  <p className="muted" style={{marginTop:24}}>Only approved, indexed websites appear in results.</p>
 </main>;
}
