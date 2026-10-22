'use client';
type Result = { id:string; url:string; title:string; description:string|null; tags:string[] };
const NAME='opensearch-cache';
function openDb(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=> { const req=indexedDB.open(NAME,1); req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('queries'))db.createObjectStore('queries')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error) });
}
export async function readCache(query:string): Promise<Result[]|null> {
 try {const db=await openDb();return await new Promise(resolve=>{const tx=db.transaction('queries','readonly');const req=tx.objectStore('queries').get(query.toLowerCase().trim());req.onsuccess=()=>resolve(req.result?.results ?? null);req.onerror=()=>resolve(null);tx.oncomplete=()=>db.close()})}catch{return null}
}
export async function saveCache(query:string, results:Result[]) {
 try {const db=await openDb();await new Promise<void>(resolve=>{const tx=db.transaction('queries','readwrite');tx.objectStore('queries').put({results:results.slice(0,30),savedAt:Date.now()},query.toLowerCase().trim());tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>resolve()})}catch{}
}
