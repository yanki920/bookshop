// Server-only Erply connector. Never include this file in browser bundles.
export class ErplyError extends Error {}
export function configurationStatus(env=process.env){
 const required=['ERPLY_CLIENT_CODE','ERPLY_USERNAME','ERPLY_PASSWORD'];
 return {configured:required.every(k=>!!env[k]),missing:required.filter(k=>!env[k])};
}
export function createErplyClient({env=process.env,fetcher=globalThis.fetch}={}){
 const clientCode=env.ERPLY_CLIENT_CODE,username=env.ERPLY_USERNAME,password=env.ERPLY_PASSWORD;
 if(!configurationStatus(env).configured)throw new ErplyError('Erply credentials are incomplete. Enter them in secure environment settings.');
 if(!/^\d{1,12}$/.test(clientCode))throw new ErplyError('Erply client code must contain digits only.');
 const endpoint=`https://${clientCode}.erply.com/api/`;
 let sessionKey=null,expires=0;
 async function call(request,params={}){
  const body=new URLSearchParams({...params,request,clientCode});
  let response,data;
  try{response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,redirect:'error',signal:AbortSignal.timeout(20000)});}
  catch{throw new ErplyError('Could not reach Erply. Check network access and retry.');}
  if(!response.ok)throw new ErplyError(`Erply returned HTTP ${response.status}.`);
  try{data=await response.json();}catch{throw new ErplyError('Erply returned an unreadable response.');}
  if(data?.status?.responseStatus!=='ok'){
   const code=Number(data?.status?.errorCode);
   if(code===1054||code===1055){sessionKey=null;expires=0;}
   throw new ErplyError(`Erply rejected the request${Number.isFinite(code)?' (code '+code+')':''}. Check account access.`);
  }
  if(!Array.isArray(data.records))throw new ErplyError('Erply response did not contain records.');
  return data.records;
 }
 async function authenticate(){
  if(sessionKey&&Date.now()<expires)return {connected:true};
  const records=await call('verifyUser',{username,password,sessionLength:'3600'});
  if(typeof records[0]?.sessionKey!=='string'||!records[0].sessionKey)throw new ErplyError('Erply did not return an authenticated session.');
  sessionKey=records[0].sessionKey;expires=Date.now()+300000;
  return {connected:true};
 }
 async function lookup(request,term,page=1){
  if(typeof term!=='string'||term.trim().length<2||term.length>100)throw new ErplyError('Enter between 2 and 100 characters to search.');
  if(!Number.isInteger(page)||page<1)throw new ErplyError('Invalid page.');
  await authenticate();
  // This private connector only offers the two read operations below.
  return call(request,{sessionKey,searchName:term.trim(),recordsOnPage:'20',pageNo:String(page)});
 }
 return Object.freeze({authenticate,
  searchCustomers:async(term,page)=> (await lookup('getCustomers',term,page)).map(r=>({id:r.customerID,name:r.fullName||r.companyName||[r.firstName,r.lastName].filter(Boolean).join(' '),phone:r.mobile||r.phone||'',email:r.email||''})),
  searchProducts:async(term,page)=> (await lookup('getProducts',term,page)).map(r=>({id:r.productID,name:r.name,code:r.code||'',barcode:r.code2||''}))
 });
}
