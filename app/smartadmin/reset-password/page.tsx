'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
const client=createClient('https://uokbyvwpgpjdkxeyhjkq.supabase.co','sb_publishable_OwML8AzzknUvxsWa2RDnFA_QGCvjFTu',{auth:{persistSession:false,detectSessionInUrl:true}});
export default function ResetPassword(){
 const [ready,setReady]=useState(false),[password,setPassword]=useState(''),[message,setMessage]=useState('Checking recovery link...'),[busy,setBusy]=useState(false);
 useEffect(()=>{
 let active=true;
 async function init(){
 try{
 const params=new URLSearchParams(window.location.search);
 const code=params.get('code');
 if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error}
 else if(window.location.hash){const h=new URLSearchParams(window.location.hash.slice(1)),access_token=h.get('access_token'),refresh_token=h.get('refresh_token');if(access_token&&refresh_token){const {error}=await client.auth.setSession({access_token,refresh_token});if(error)throw error}}
 const {data}=await client.auth.getSession();if(active){setReady(!!data.session);setMessage(data.session?'Enter your new password.':'Invalid or expired password reset link.')}
 }catch{if(active)setMessage('Invalid or expired password reset link.')}
 }init();return()=>{active=false}
 },[]);
 async function submit(e:React.FormEvent){e.preventDefault();if(password.length<12){setMessage('Use at least 12 characters.');return}setBusy(true);const {error}=await client.auth.updateUser({password});setBusy(false);if(error)setMessage('Unable to reset password; request a fresh link.');else{setMessage('Password updated. Return to the admin login.');setReady(false);setPassword('');await client.auth.signOut()}}
 return <main><h1>Reset admin password</h1><div className="panel">{ready&&<form onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/><button disabled={busy}>Update password</button></form>}<p role="status">{message}</p><p><a href="/smartadmin">Return to administrator login</a></p></div></main>
}
