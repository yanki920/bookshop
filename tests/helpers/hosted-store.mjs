import {SupabaseStore,HostedError} from '../../hosted/store.mjs';
export class MemoryStore extends SupabaseStore {
 constructor(){super({url:'https://testing.supabase.co',key:'test-only-key'});this.rows=new Map();this.revision=0;this.blobs=new Map();this.uploadOrigin='http://127.0.0.1';this.conflicts=0;}
 async snapshot(collections,ids={}){return {revision:this.revision,rows:[...this.rows.values()].filter(r=>collections.includes(r.collection)&&(!(r.collection in ids)||ids[r.collection].includes(r.id))).map(r=>structuredClone(r))};}
 async commit(revision,puts,deletes=[]){if(this.conflicts>0){this.conflicts--;throw new HostedError('SHOP_CONFLICT',409);}if(revision!==this.revision)throw new HostedError('SHOP_CONFLICT',409);const next=++this.revision;for(const row of puts)this.rows.set(row.collection+':'+row.id,{...structuredClone(row),revision:next});for(const row of deletes)this.rows.delete(row.collection+':'+row.id);return next;}
 async changes(after){const rows=[...this.rows.values()].filter(r=>r.revision>after),team=rows.find(r=>r.collection==='team');return {revision:this.revision,orders:rows.filter(r=>r.collection==='orders').map(r=>structuredClone(r.document)),suppliers:rows.filter(r=>r.collection==='suppliers').map(r=>structuredClone(r.document)),workersChanged:!!team,workers:team?structuredClone(team.document.workers):[]};}
 async signUpload(id){return this.uploadOrigin+'/mock-upload/'+id;}
 async statFile(id){const f=this.blobs.get(id);return f?{size:f.bytes.length,mimetype:f.type}:null;}
 async writeFile(id,bytes,type){this.blobs.set(id,{bytes,type});}
 async readFile(id){const f=this.blobs.get(id);return new Response(f.bytes,{headers:{'Content-Type':f.type}});}
}
