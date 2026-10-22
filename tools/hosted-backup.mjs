import path from 'node:path';
import {SupabaseStore} from '../hosted/store.mjs';
import {backupShop,restoreShop} from '../hosted/backup.mjs';
const [action,directory]=process.argv.slice(2);
if(!['backup','restore'].includes(action)||!directory)throw Error('Usage: node tools/hosted-backup.mjs backup|restore /private/folder');
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY securely first.');
const store=new SupabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
try{const result=await(action==='backup'?backupShop:restoreShop)(store,path.resolve(directory));console.log(action+' verified: '+result.records+' records, '+result.files+' attachments.');}catch(err){console.error(err.message);process.exitCode=1;}
