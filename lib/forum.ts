import {validWebsite} from './safety';
import {extract,safeFetch} from './sitemap-indexer';

export type SiteType='website'|'forum';
export function siteTypeOf(v:unknown):SiteType|null {
 return v==='forum'?'forum':v==='website'||v==null?'website':null;
}
const blocked=/(^|\/)(?:login|logout|register|signup|signin|account|members?|users?|u|profiles?|inbox|messages?|private|notifications?|search|find|attachments?|downloads?|admin|api|ajax)(?:\/|$|\.)/i;
const files=/\.(?:ico|jpe?g|png|gif|svg|webp|css|js|mp4|mp3|woff2?|pdf|zip|gz|rss|xml)$/i;
export function forumLink(input:string,host:string):string|null{
 try{
  const cleaned=validWebsite(input);if(!cleaned)return null;
  const u=new URL(cleaned);
  if(u.protocol!=='https:'||u.hostname!==host||blocked.test(u.pathname)||files.test(u.pathname))return null;
  if([...u.searchParams.keys()].some(k=>/^(session|sid|token|action|auth|do)$/i.test(k)))return null;
  const keep=new URLSearchParams();
  const php=/\/(?:viewtopic|showthread)\.php$/i.test(u.pathname);
  for(const key of php?['t','p','f','start']:['page']){
   const value=u.searchParams.get(key);
   if(value&&/^\d{1,6}$/.test(value)&&Number(value)<=(key==='page'?10:key==='start'?250:999999))keep.set(key,String(Number(value)));
  }
  if(php&&!keep.has('t')&&!keep.has('f')&&!keep.has('p'))return null;
  u.search=keep.toString();u.hash='';
  return u.toString();
 }catch{return null}
}
export function likelyThread(url:string){
 try{
  const u=new URL(url);
  return /\/(?:t|threads?|topics?|discussions?|posts?)\//i.test(u.pathname)||
   /\/(?:viewtopic|showthread)\.php$/i.test(u.pathname)&&!!(u.searchParams.get('t')||u.searchParams.get('p'));
 }catch{return false}
}
export function noIndex(html:string){
 return [...html.matchAll(/<meta\b[^>]*>/gi)].some(m=>
  /\bname\s*=\s*["']?(?:robots|opensearchbot)\b/i.test(m[0])&&
  /\bcontent\s*=\s*["'][^"']*\bnoindex\b/i.test(m[0]));
}
export function nonCanonical(html:string,url:string){
 try{
  const tag=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).find(t=>/\brel\s*=\s*["']canonical["']/i.test(t));
  const href=tag?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];if(!href)return false;
  const canonical=new URL(href,url),current=new URL(url);
  return canonical.origin!==current.origin||canonical.pathname.replace(/\/$/,'')!==current.pathname.replace(/\/$/,'')||canonical.search!==current.search;
 }catch{return false}
}
function structuredThread(html:string){
 const match=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0,6);
 for(const script of match){
  try{
   const document=JSON.parse(script[1]);
   const nodes=Array.isArray(document)?document:Array.isArray(document['@graph'])?document['@graph']:[document];
   const item=nodes.find((n:{'@type'?:string})=>/DiscussionForumPosting|QAPage/.test(String(n?.['@type']||'')));
   if(item)return {title:typeof item.headline==='string'?item.headline:'',body:typeof item.text==='string'?item.text:''};
  }catch{}
 }
 return null;
}
export function forumThread(html:string,url:string){
 return likelyThread(url)||!!structuredThread(html)||/["']DiscussionForumPosting["']/.test(html.slice(0,160000));
}
export function forumPage(html:string,url:string){
 const base=extract(html,url),data=structuredThread(html);
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
 const body=(data?.body|| (main?extract(main,url).body:base.body)).slice(0,12000);
 return {...base,title:(data?.title||base.title).slice(0,220),description:(base.description||body.slice(0,250)).slice(0,1000),body,page_type:'forum_thread'};
}
type Rule={pattern:string;allow:boolean};
export function parseRobots(raw:string){
 const groups:{agents:string[];rules:Rule[];delay:number}[]=[];
 let group:{agents:string[];rules:Rule[];delay:number}={agents:[],rules:[],delay:0};
 const save=()=>{if(group.agents.length)groups.push(group);group={agents:[],rules:[],delay:0}};
 for(const line of raw.split(/\r?\n/)){
  const value=line.split('#')[0].trim(),ix=value.indexOf(':');if(ix<0)continue;
  const name=value.slice(0,ix).trim().toLowerCase(),text=value.slice(ix+1).trim();
  if(name==='user-agent'){if(group.rules.length)save();group.agents.push(text.toLowerCase());continue}
  if(!group.agents.length)continue;
  if((name==='allow'||name==='disallow')&&text)group.rules.push({pattern:text,allow:name==='allow'});
  if(name==='crawl-delay'&&Number.isFinite(Number(text)))group.delay=Math.max(group.delay,Math.min(10,Number(text)));
 }
 save();
 const specific=groups.filter(g=>g.agents.includes('opensearchbot'));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 return {
  delayMs:1000*Math.max(1.5,...selected.map(g=>g.delay)),
  permits(url:string){
   const u=new URL(url),path=u.pathname+u.search;
   let score=-1,permitted=true;
   for(const rule of selected.flatMap(g=>g.rules)){
    const core=rule.pattern.replace(/\$$/,'');
    const pattern=core.split('*').map(p=>p.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')).join('.*');
    try{
     if(new RegExp('^'+pattern+(rule.pattern.endsWith('$')?'$':'')).test(path)){
      const len=core.replace(/\*/g,'').length;
      if(len>score||(len===score&&rule.allow)){score=len;permitted=rule.allow}
     }
    }catch{}
   }
   return permitted;
  }
 };
}
type Robots=ReturnType<typeof parseRobots>;
const cache=new Map<string,{value:Robots;expires:number}>();
export async function forumRobots(host:string):Promise<Robots>{
 const cached=cache.get(host);if(cached&&cached.expires>Date.now())return cached.value;
 let rules=parseRobots('User-agent: *\nDisallow: /');
 try{
  const txt=await safeFetch('https://'+host+'/robots.txt',host,150000,'robots');
  rules=parseRobots(txt);
 }catch(e){if(e instanceof Error&&e.message.startsWith('HTTP 404'))rules=parseRobots('')}
 if(cache.size>200)cache.clear();
 cache.set(host,{value:rules,expires:Date.now()+300000});
 return rules;
}
