import {validWebsite} from './safety';

export type ParsedSubmission={websiteUrl:string;urls:string[];websiteProvided:boolean};

/** Website URL, same-origin XML sitemap URLs, or both. */
export function parseWebsiteSubmission(input:{websiteUrl?:unknown;sitemapUrls?:unknown;sitemapUrl?:unknown},limit=20):
 ParsedSubmission | {error:string}{
 const supplied=typeof input.websiteUrl==='string'?input.websiteUrl.trim():'';
 const rawSitemaps=input.sitemapUrls??input.sitemapUrl??'';
 const entries=Array.isArray(rawSitemaps)?rawSitemaps:typeof rawSitemaps==='string'?rawSitemaps.split(/[\r\n,]+/):[];
 const links=entries.filter((value):value is string=>typeof value==='string'&&value.trim().length>0);
 if(links.length>limit)return {error:'Add no more than '+limit+' sitemaps per submission.'};
 if(!supplied&&!links.length)return {error:'Enter a website URL or at least one sitemap XML URL.'};
 let websiteUrl='';
 if(supplied){
  const valid=validWebsite(supplied);
  if(!valid||new URL(valid).protocol!=='https:')return {error:'Website must use a valid public HTTPS URL.'};
  websiteUrl=new URL(valid).origin+'/';
 }
 const urls:string[]=[];
 for(const entry of links){
  const valid=validWebsite(entry.trim());
  if(!valid)return {error:'Invalid sitemap URL: '+entry.slice(0,110)};
  const target=new URL(valid);
  if(target.protocol!=='https:'||!/\.xml$/i.test(target.pathname)){
   return {error:'Sitemaps must be public HTTPS .xml URLs.'};
  }
  // Remove harmless empty question marks; preserve meaningful sitemap query parameters.
  urls.push(target.toString().replace(/\?$/,''));
 }
 const unique=[...new Set(urls)];
 if(!websiteUrl&&unique.length)websiteUrl=new URL(unique[0]).origin+'/';
 if(unique.some(url=>new URL(url).origin!==new URL(websiteUrl).origin))
  return {error:'Website and sitemap URLs must have the same HTTPS origin (including www).'};
 return {websiteUrl,urls:unique,websiteProvided:!!supplied};
}

/** Backwards-compatible validator for callers that only submit XML sitemaps. */
export function parseSitemaps(input:unknown,limit=20){
 return parseWebsiteSubmission({sitemapUrls:input},limit);
}
