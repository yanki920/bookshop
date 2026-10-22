import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const collections=['meta','orders','invoices','allocations','team','suppliers','profiles','files'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function backupShop(store,destination){
 await mkdir(destination,{mode:0o700});await mkdir(path.join(destination,'files'),{mode:0o700});
 const snapshot=await store.snapshot(collections),objects=[];
 for(const row of snapshot.rows.filter(r=>r.collection==='files'&&r.document.ready)){
  const response=await store.readFile(row.id);if(!response.ok)throw Error('Could not back up an attachment.');const bytes=Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(destination,'files',row.id),bytes,{mode:0o600,flag:'wx'});objects.push({id:row.id,type:row.document.type,sha256:digest(bytes),size:bytes.length});
 }
 const end=await store.snapshot([]);if(end.revision!==snapshot.revision)throw Error('Records changed during backup. Retry in a new empty folder when the shop is quiet.');
 const bytes=Buffer.from(JSON.stringify(snapshot.rows));await writeFile(path.join(destination,'records.json'),bytes,{mode:0o600,flag:'wx'});
 await writeFile(path.join(destination,'manifest.json'),JSON.stringify({format:1,createdAt:new Date().toISOString(),revision:snapshot.revision,recordsSha256:digest(bytes),objects}),{mode:0o600,flag:'wx'});
 return {records:snapshot.rows.length,files:objects.length};
}
export async function restoreShop(store,source){
 const manifest=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8')),bytes=await readFile(path.join(source,'records.json'));
 if(manifest.format!==1||manifest.recordsSha256!==digest(bytes))throw Error('Backup records failed verification.');
 const rows=JSON.parse(bytes);if(!Array.isArray(rows)||rows.some(r=>!collections.includes(r.collection)||typeof r.id!=='string'))throw Error('Invalid backup records.');
 const files=[];for(const object of manifest.objects){if(!/^[a-f0-9-]{36}$/.test(object.id))throw Error('Invalid attachment ID.');const data=await readFile(path.join(source,'files',object.id));if(data.length!==object.size||digest(data)!==object.sha256)throw Error('Backup attachment failed verification.');files.push({...object,data});}
 const existing=await store.snapshot([...collections,'sessions','attempts']);if(existing.rows.length)throw Error('Restore requires an empty destination database. Existing shop records were left unchanged.');
 for(const file of files)await store.writeFile(file.id,file.data,file.type);
 await store.commit(existing.revision,rows);return {records:rows.length,files:files.length};
}
