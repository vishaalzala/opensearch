'use client';
import type {SVGProps} from 'react';

export type AdminIconName='overview'|'websites'|'sitemap'|'review'|'pages'|'crawls'|'users'|'settings'|'plus'|'refresh'|'logout'|'search'|'external'|'chevron'|'check'|'warning'|'clock'|'menu'|'close'|'arrow'|'filter'|'database'|'shield'|'activity'|'globe';
export function AdminIcon({name,size=18,...props}:{name:AdminIconName;size?:number}&SVGProps<SVGSVGElement>){
 const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const,...props};
 const icon:Record<AdminIconName,React.ReactNode>={
 overview:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 websites:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 6-5 12 0 18M12 3c5 6 5 12 0 18"/></>,
 sitemap:<><circle cx="12" cy="4" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="19" cy="20" r="2"/><path d="M12 6v6M5 18v-4h14v4M12 12v6"/></>,
 review:<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/></>,
 pages:<><path d="M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 12h8M8 16h8"/></>,
 crawls:<><path d="M4 16a8 8 0 0 1 16-8"/><path d="m20 3 1 5-5 1M20 8a8 8 0 0 1-16 8"/><path d="m4 21-1-5 5-1"/></>,
 users:<><circle cx="10" cy="8" r="4"/><path d="M2 21v-2a8 8 0 0 1 16 0v2M17 4a4 4 0 0 1 0 8M20 14a7 7 0 0 1 2 5v2"/></>,
 settings:<><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/></>,
 plus:<path d="M12 5v14M5 12h14"/>,
 refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 8a7 7 0 0 1 12-2l2 6M18 16a7 7 0 0 1-12 2l-2-6"/></>,
 logout:<><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M13 8l4 4-4 4M8 12h9"/></>,
 search:<><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></>,
 external:<><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 14v5H5V5h6"/></>,
 chevron:<path d="m9 6 6 6-6 6"/>,
 check:<path d="m4 12 5 5L20 6"/>,
 warning:<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
 menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
 close:<path d="M5 5l14 14M19 5 5 19"/>,
 arrow:<path d="m5 12 14 0m-6-6 6 6-6 6"/>,
 filter:<><path d="M4 6h16M7 12h10M10 18h4"/></>,
 database:<><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
 shield:<><path d="M12 2 20 6v6c0 5-4 8-8 10-4-2-8-5-8-10V6l8-4Z"/><path d="m8 12 3 3 5-6"/></>,
 activity:<path d="M2 12h4l3-7 5 14 3-7h5"/>,
 globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 6-5 12 0 18M12 3c5 6 5 12 0 18"/></>
 };
 return <svg {...common}>{icon[name]}</svg>;
}
