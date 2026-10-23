import './style.css';
import type {Metadata} from 'next';

export const metadata:Metadata={
 title:'OpenSearch | Web search',
 description:'Search public pages from community-reviewed websites using OpenSearch.'
};

export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
