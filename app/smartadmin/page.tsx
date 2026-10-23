'use client';
import {useEffect,useState} from 'react';
import {AdminWorkspace} from './workspace';
import {AdminIcon} from './icons';

export default function Admin(){
 const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState('');
 const [logged,setLogged]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  try{const r=await fetch('/api/admin/submissions',{cache:'no-store'});setLogged(r.ok)}
  catch{setLogged(false)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 async function login(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Unable to sign in');
   setPassword('');await load();
  }catch(error){setMessage(String(error instanceof Error?error.message:error))}
  finally{setBusy(false)}
 }
 async function reset(){
  setBusy(true);setMessage('');
  try{
   await fetch('/api/admin/reset-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});
   setMessage('If this account exists, a password reset email has been requested. Email delivery must be configured.');
  }catch{setMessage('Could not request a password reset')}
  finally{setBusy(false)}
 }
 if(loading)return <main className="admin-login-shell"><div className="admin-login-card"><span className="admin-logo">Open<span>Search</span></span><p className="admin-muted">Checking your administrator session…</p></div></main>;
 if(logged)return <main className="admin-root"><AdminWorkspace onLogout={()=>setLogged(false)}/></main>;
 return <main className="admin-login-shell"><div className="admin-login-card">
  <a href="/" className="admin-logo" aria-label="Go to OpenSearch">Open<span>Search</span></a>
  <div className="admin-login-mark"><AdminIcon name="shield" size={24}/></div>
  <h1>Welcome back</h1><p className="admin-muted">Sign in to manage the OpenSearch index.</p>
  <form onSubmit={login} className="admin-login-form">
   <label htmlFor="identifier">Administrator email or username</label>
   <input id="identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="username" placeholder="admin@example.com" required/>
   <label htmlFor="password">Password</label>
   <input id="password" value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Enter password" required/>
   <button type="submit" disabled={busy} className="admin-primary admin-full">{busy?'Signing in…':'Sign in securely'}</button>
  </form>
  <button type="button" className="admin-quiet" onClick={reset} disabled={busy}>Forgot password?</button>
  {message&&<p role="status" className="admin-login-message">{message}</p>}
  <p className="admin-login-foot">Restricted access · Authorised administrators only</p>
 </div></main>;
}
