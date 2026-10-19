import {ownerCookie} from './auth-helper.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const dir=mkdtempSync(path.join(tmpdir(),'bookshop-test-'));
const port=18300+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
let child,cookie;
async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),BOOKSHOP_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw Error('Server failed: '+code)})]);cookie=await ownerCookie(base);}
async function stop(){child.kill();await once(child,'exit');}
async function request(route,body){const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}:{headers:{Cookie:cookie}});return {status:r.status,data:await r.json()};}
const input={customer:'Test customer',book:'Test sefer',owner:'Test worker',quantity:2,kind:'Customer',channel:'SMS',payment:'Unpaid',supplier:'Lehmanns',phone:'',email:'',isbn:'',notes:'',location:''};
test('persisted order journey, partial delivery, concurrency and payment guards',async()=>{try{
await start();let r=await request('/api/orders',input);assert.equal(r.status,201);let o=r.data;const id=o.id;
const update=async(action,extra={})=>request('/api/orders/'+id,{version:o.version,action,...extra});
r=await update('notify');assert.equal(r.status,400);
r=await update('edit',{payment:'Deposit',depositAmount:0});assert.equal(r.status,400);r=await update('edit',{payment:'Deposit',depositAmount:25.555});assert.equal(r.status,400);r=await update('edit',{payment:'Deposit',depositAmount:25.50});assert.equal(r.status,200);o=r.data;assert.equal(o.depositAmount,25.50);
r=await update('order',{supplier:'Lehmanns'});assert.equal(r.status,200);o=r.data;assert.equal(o.status,'ordered');assert.ok(o.orderedAt);
r=await update('dispatch');o=r.data;assert.equal(o.status,'dispatched');
r=await update('receive',{received:1,damaged:0,location:'B2'});o=r.data;assert.equal(o.status,'partial');
r=await update('notify');assert.equal(r.status,400);
r=await update('receive',{received:2,damaged:1,location:'B2'});assert.equal(r.status,400);
r=await update('receive',{received:2,damaged:0,location:'B2'});o=r.data;assert.equal(o.status,'received');
r=await request('/api/orders/'+id,{version:1,action:'note',note:'stale'});assert.equal(r.status,409);
r=await update('notify');o=r.data;assert.equal(o.status,'notified');assert.match(o.history.at(-1).text,/no message sent/);
r=await update('collect');assert.equal(r.status,400);
r=await update('edit',{payment:'Paid'});o=r.data;
r=await update('collect');o=r.data;assert.equal(o.status,'collected');
await stop();await start();r=await request('/api/orders');const restored=r.data.find(x=>x.id===id);assert.equal(restored.status,'collected');assert.equal(restored.location,'B2');assert.equal(restored.payment,'Paid');assert.equal(restored.depositAmount,25.50);
r=await request('/api/orders',{...input,quantity:-1});assert.equal(r.status,400);
const hidden=await fetch(base+'/.data/orders.sqlite');assert.equal(hidden.status,404);
const cross=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(cross.status,403);
r=await request('/api/export');assert.ok(r.data.orders.some(x=>x.id===id));
let damaged=(await request('/api/orders',{...input,quantity:1})).data;
const change=async(action,extra={})=>{const result=await request('/api/orders/'+damaged.id,{action,version:damaged.version,...extra});assert.equal(result.status,200);damaged=result.data;};
await change('order',{supplier:'Friedman'});await change('receive',{received:0,damaged:1,location:''});assert.equal(damaged.status,'partial');await change('receive',{received:1,damaged:0,location:'B3'});assert.equal(damaged.status,'received');
}finally{if(child?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}});
