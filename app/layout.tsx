import './style.css';
export const metadata={title:'OpenSearch — discover more of the web',description:'An independent, community-curated website search engine'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<footer>Independent website discovery · Community submissions are reviewed before publishing</footer></body></html>}
