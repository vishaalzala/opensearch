import {NextResponse} from 'next/server';
import {isAdmin} from '../../../../lib/admin';
import {db} from '../../../../lib/db';

export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await db().from('admin_users').select('user_id,username,created_at').order('created_at',{ascending:true}).limit(100);
 if(error)return NextResponse.json({error:'Unable to load administrators'},{status:503});
 return NextResponse.json({admins:data??[]},{headers:{'Cache-Control':'no-store'}});
}
