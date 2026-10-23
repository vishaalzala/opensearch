import {validWebsite} from './safety';

/** Validate every submitted XML sitemap; never silently discard invalid entries. */
export function parseSitemaps(input:unknown, limit=20):
 {websiteUrl:string; urls:string[]} | {error:string} {
 const raw=Array.isArray(input)?input:typeof input==='string'?input.split(/[\r\n,]+/):[];
 if(raw.length>limit)return {error:'Submit no more than '+limit+' sitemaps at once.'};
 if(!raw.length)return {error:'Enter at least one sitemap XML URL.'};
 const normalized:string[]=[];
 for(const entry of raw) {
  if(typeof entry!=='string'||!entry.trim())continue;
  const url=validWebsite(entry.trim());
  if(!url)return {error:'Invalid sitemap URL: '+String(entry).slice(0,100)};
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!/\.xml$/i.test(parsed.pathname))
   return {error:'Each sitemap must be a public HTTPS .xml URL.'};
  normalized.push(parsed.toString());
 }
 const urls=[...new Set(normalized)];
 if(!urls.length)return {error:'Enter at least one sitemap XML URL.'};
 const origin=new URL(urls[0]).origin;
 if(urls.some(url=>new URL(url).origin!==origin))return {error:'All sitemaps in one submission must belong to the same website.'};
 return {websiteUrl:origin+'/',urls};
}
