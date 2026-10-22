'use client';
import {useEffect,useState} from 'react';
import {readCache,saveCache} from '../../lib/cache';
type Result={id:string;url:string;title:string;description:string|null;tags:string[]};
export default function Search(){const [q,setQ]=useState(''),[results,setResults]=useState<Result[]>([]),[state,setState]=useState('Loading...');
useEffect(()=>{const query=new URLSearchParams(window.location.search).get('q')?.trim()||'';setQ(query);if(query.length<2){setState('Enter at least two characters');return}let active=true;
readCache(query).then(c=>{if(active&&c){setResults(c);setState('Showing cached results; checking for updates...')}});
fetch('/api/search?q='+encodeURIComponent(query)).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(!active)return;setResults(d.results||[]);setState(`${(d.results||[]).length} results`);saveCache(query,d.results||[])}).catch(()=>{if(active)setState(s=>s.includes('cached')?'Offline — showing cached results':'Search unavailable; try again later')});return()=>{active=false}},[]);
return <main><a href="/" aria-label="OpenSearch homepage" className="brand" style={{display:"inline-block",marginBottom:18}}>Open<span>Search</span></a><form action="/search" className="searchform"><input name="q" defaultValue={q} placeholder="Search..." required minLength={2}/><button>Search</button></form><p className="muted status">{state}</p>{results.map(r=><div className="result" key={r.id}><small>{r.url}</small><h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title||r.url} ↗</a></h3><p>{r.description}</p></div>)}<p className="muted" style={{marginTop:24}}>Only approved, indexed websites appear in results.</p></main>}
