import {NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
export const dynamic='force-dynamic';
export async function GET(){
 const allowed=await isAdmin();
 return NextResponse.json({authenticated:allowed},{status:allowed?200:401,headers:{'Cache-Control':'no-store'}});
}
