import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {db} from './db';
import {validWebsite} from './safety';

const MAX_PAGES=30;
function addressIsPublic(value:string) {
 if(isIP(value)===6){const a=value.toLowerCase();return !(a==='::1'||a==='::'||a.startsWith('fc')||a.startsWith('fd')||a.startsWith('fe8')||a.startsWith('fe9')||a.startsWith('fea')||a.startsWith('feb')||a.startsWith('::ffff:'))}
 const p=value.split('.').map(Number);
 return p.length===4 && p.every(n=>Number.isInteger(n)&&n>=0&&n<256) &&
 !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||
 (p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||
 (p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||
 (p[0]===192&&p[1]===0)||(p[0]===198&&(p[1]===18||p[1]===19)));
}
async function checkUrl(input:string,origin:string) {
 const normalized=validWebsite(input);
 if(!normalized)throw Error('Invalid page URL');
 const u=new URL(normalized);
 if(u.protocol!=='https:'||u.hostname!==origin)throw Error('Outside approved HTTPS domain');
 const ips=await lookup(u.hostname,{all:true,verbatim:true});
 if(!ips.length||ips.some(x=>!addressIsPublic(x.address)))throw Error('Blocked network address');
 return u.toString();
}
async function safeFetch(input:string,host:string,maxBytes:number,kind:'xml'|'html') {
 const url=await checkUrl(input,host);
 const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'OpenSearchBot/0.1 (+https://opensearch-pi.vercel.app)','Accept':kind==='xml'?'application/xml,text/xml':'text/html'}});
 if(!response.ok)throw Error('Remote fetch failed');
 const type=response.headers.get('content-type')||'';
 if(kind==='xml'&&!/(xml|text\/plain)/i.test(type))throw Error('Not XML');
 if(kind==='html'&&!/text\/html/i.test(type))throw Error('Not HTML');
 const reader=response.body?.getReader();
 if(!reader)throw Error('Missing response body');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('Page too large');chunks.push(value)}}finally{reader.cancel().catch(()=>{})}
 const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length}
 return new TextDecoder().decode(out);
}
function locations(xml:string){return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,'&').trim()).filter(Boolean)}
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).trim()}
function extract(html:string,url:string) {
 const title=decode((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||new URL(url).pathname);
 const description=decode((html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)||[])[1]||'');
 const clean=decode(html.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).slice(0,12000);
 return {url,title:title.slice(0,220)||url,description:description.slice(0,1000),body:clean.slice(0,12000)};
}
export async function indexApprovedWebsite(site:{id:string;url:string;sitemap_url:string|null}) {
 const host=new URL(site.url).hostname;
 const sitemap=site.sitemap_url||new URL('/sitemap.xml',site.url).toString();
 const xml=await safeFetch(sitemap,host,1_000_000,'xml');
 const links=locations(xml);
 let urls=links;
 if(/<sitemapindex\b/i.test(xml)){
  urls=[];
  for(const nested of links.slice(0,3)){try{urls.push(...locations(await safeFetch(nested,host,1_000_000,'xml')))}catch{}}
 }
 urls=[...new Set(urls)].filter(u=>{try{return new URL(u).hostname===host&&new URL(u).protocol==='https:'}catch{return false}}).slice(0,MAX_PAGES);
 let indexed=0,failed=0;
 for(const pageUrl of urls){
  try{
   const html=await safeFetch(pageUrl,host,400_000,'html');
   const page=extract(html,pageUrl);
   const {error}=await db().from('search_pages').upsert({...page,website_id:site.id,is_published:true},{onConflict:'url'});
   if(error)throw error;indexed++;
  }catch{failed++}
 }
 return {discovered:urls.length,indexed,failed,limited:urls.length===MAX_PAGES};
}
