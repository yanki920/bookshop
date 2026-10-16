import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configurationStatus,createErplyClient} from '../integrations/erply.mjs';
const env={ERPLY_CLIENT_CODE:'123456',ERPLY_USERNAME:'test@example.invalid',ERPLY_PASSWORD:'synthetic-test-password'};
test('credentials required; account code cannot redirect credentials elsewhere',()=>{
 assert.deepEqual(configurationStatus({}).missing,['ERPLY_CLIENT_CODE','ERPLY_USERNAME','ERPLY_PASSWORD']);
 assert.throws(()=>createErplyClient({env:{}}),/incomplete/);
 assert.throws(()=>createErplyClient({env:{...env,ERPLY_CLIENT_CODE:'other.example/path'}}),/digits/);
});
test('authenticate with POST, retain session server-side and expose read-only searches',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{assert.equal(url,'https://123456.erply.com/api/');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.ok(!url.includes(env.ERPLY_PASSWORD));const f=Object.fromEntries(options.body);calls.push(f);
 if(f.request==='verifyUser'){assert.equal(f.password,env.ERPLY_PASSWORD);return {ok:true,json:async()=>({status:{responseStatus:'ok'},records:[{sessionKey:'synthetic-session'}]})};}
 assert.equal(f.sessionKey,'synthetic-session');assert.ok(!('password' in f));assert.equal(f.recordsOnPage,'20');
 return {ok:true,json:async()=>({status:{responseStatus:'ok'},records:f.request==='getCustomers'?[{customerID:1,fullName:'Sample customer',email:'sample@example.invalid'}]:[{productID:2,name:'Sample book',code:'BOOK-1',code2:'123'}]})};
 };
 const client=createErplyClient({env,fetcher});assert.deepEqual(await client.authenticate(),{connected:true});
 assert.equal((await client.searchCustomers('Sample'))[0].name,'Sample customer');assert.equal((await client.searchProducts('book'))[0].code,'BOOK-1');
 assert.deepEqual(calls.map(c=>c.request),['verifyUser','getCustomers','getProducts']);assert.deepEqual(Object.keys(client),['authenticate','searchCustomers','searchProducts']);
 await assert.rejects(()=>client.searchCustomers(''),/2 and 100/);
});
test('upstream errors never echo credentials or session data',async()=>{
 const c=createErplyClient({env,fetcher:async()=>({ok:true,json:async()=>({status:{responseStatus:'error',errorCode:105,errorMessage:env.ERPLY_PASSWORD},records:[]})})});
 await assert.rejects(()=>c.authenticate(),e=>e.message.includes('105')&&!e.message.includes(env.ERPLY_PASSWORD));
 const network=createErplyClient({env,fetcher:async()=>{throw Error(env.ERPLY_PASSWORD)}});
 await assert.rejects(()=>network.authenticate(),e=>!e.message.includes(env.ERPLY_PASSWORD));
});
