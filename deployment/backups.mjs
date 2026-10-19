import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readdir,readFile,writeFile,chmod,copyFile,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
export async function backupData(data,destination,{keep=14}={}){
 await mkdir(destination,{recursive:true,mode:0o700});
 const name='snapshot-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),pending=path.join(destination,'.'+name),target=path.join(destination,name);
 await mkdir(pending,{mode:0o700});const entries=[];
 try{for(const name of ['orders.sqlite','gmail.sqlite','gmail-token.key','gmail-mailboxes.json']){let bytes;const source=path.join(data,name),output=path.join(pending,name);try{if(name.endsWith('.sqlite')){const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,output);}finally{db.close();}}else await copyFile(source,output);bytes=await readFile(output);}catch(err){if(err.code==='ENOENT'||err.code==='ERR_SQLITE_ERROR'&&/unable to open database/.test(err.message)){if(name==='orders.sqlite')throw err;continue;}throw err;}await chmod(output,0o600);entries.push({name,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await writeFile(path.join(pending,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files:entries},null,2),{mode:0o600});const {rename}=await import('node:fs/promises');await rename(pending,target);
 const snapshots=(await readdir(destination)).filter(n=>n.startsWith('snapshot-')).sort().reverse();for(const old of snapshots.slice(keep))await rm(path.join(destination,old),{recursive:true,force:true});return target;
 }catch(err){await rm(pending,{recursive:true,force:true});throw err;}
}
export function startBackups(data,destination){let busy=false;const run=async()=>{if(busy)return;busy=true;try{await backupData(data,destination);console.log('Database backup completed');}catch(err){console.error('Database backup failed:',err.message);}finally{busy=false;}};void run();const timer=setInterval(run,6*60*60*1000);timer.unref();return ()=>clearInterval(timer);}
