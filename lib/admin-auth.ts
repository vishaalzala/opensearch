import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
const url = process.env.SUPABASE_URL || 'https://uokbyvwpgpjdkxeyhjkq.supabase.co';
export function publicClient() {
 const key = process.env.SUPABASE_PUBLISHABLE_KEY;
 if (!key) throw Error('SUPABASE_PUBLISHABLE_KEY missing');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function adminUser(userId:string) {
 const {data,error}=await db().from('admin_users').select('user_id,username').eq('user_id',userId).maybeSingle();
 return !error && data ? data : null;
}
export async function resolveAdmin(identifier:string) {
 const value=identifier.trim().toLowerCase();
 if(value.includes('@')) return value;
 const {data}=await db().from('admin_users').select('user_id').ilike('username',value).maybeSingle();
 if(!data) return null;
 const {data:auth,error}=await db().auth.admin.getUserById(data.user_id);
 return error ? null : auth.user?.email?.toLowerCase() || null;
}
export async function authorizedAdmin() {
 const token=(await cookies()).get('os_admin_session')?.value;
 if(!token)return false;
 const {data,error}=await publicClient().auth.getUser(token);
 return !error && !!data.user?.email_confirmed_at && !!(await adminUser(data.user.id));
}
function signature(s:string){const secret=process.env.SESSION_SECRET;if(!secret || secret.length<32)throw Error('SESSION_SECRET not configured');return createHmac('sha256',secret).update(s).digest('hex')}
export function createPendingLogin(email:string){const data=Buffer.from(JSON.stringify({email,expiry:Date.now()+5*60_000})).toString('base64url');return data+'.'+signature(data)}
export function readPendingLogin(raw:string|undefined){
 if(!raw)return null;
 const [data,sig]=raw.split('.');
 if(!data||!sig||!/^[a-f0-9]{64}$/.test(sig))return null;
 const a=Buffer.from(sig,'hex'),b=Buffer.from(signature(data),'hex');
 if(!timingSafeEqual(a,b))return null;
 try{const obj=JSON.parse(Buffer.from(data,'base64url').toString());return typeof obj.email==='string'&&Number(obj.expiry)>Date.now()?obj.email:null}catch{return null}
}
