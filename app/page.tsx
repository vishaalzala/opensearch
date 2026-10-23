import Link from 'next/link';

export default function Home(){
 return <main className="home-shell">
  <section className="home-content" aria-label="OpenSearch web search">
   <h1 className="home-wordmark">Open<span>Search</span></h1>
   <form role="search" action="/search" method="get" className="home-search">
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/></svg>
    <label htmlFor="home-search-input" className="visually-hidden">Search the web</label>
    <input id="home-search-input" name="q" type="search" minLength={2} maxLength={160} placeholder="Search the web" autoComplete="off" required/>
    <button type="submit">Search</button>
   </form>
   <p className="home-contribute"><Link href="/submit">Submit a sitemap <span aria-hidden="true">→</span></Link></p>
  </section>
 </main>;
}
