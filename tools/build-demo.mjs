import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.argv[2]||path.join(root,'.demo');mkdirSync(out,{recursive:true});
const offline=String.raw`
(()=>{
const key='tiferes-standalone-trial-v1';
const ago=d=>new Date(Date.now()-d*86400000).toISOString();
const examples=[['M. Rosenberg','Schottenstein Talmud · Berachos','Lehmanns','ordered',7,'SMS','Paid',1],['D. Cohen','The Illustrated Pirkei Avos','Lehmanns','ordered',4,'WhatsApp','Unpaid',1],['Shop stock','Koren Siddur · Ashkenaz','Friedman','dispatched',3,'None','Unpaid',6],['Y. Weiss','Mishnah Berurah · Complete set','Lehmanns','received',5,'WhatsApp','Deposit',1],['S. Klein','Niflaos Hatorah','Friedman','received',4,'SMS','Paid',1],['A. Friedman','Personalised tefillin bag','America','new',1,'Email','Deposit',1],['Shop stock','Tehillim · Pocket edition','Sifrei','ordered',9,'None','Unpaid',10],['B. Levy','Chumash with Rashi · Vayikra','','new',0,'SMS','Unpaid',1]];
function seed(){return examples.map(([customer,book,supplier,status,d,channel,payment,quantity],i)=>({id:'sample-'+i,reference:'TF-'+(1041+i),customer,book,supplier,status,channel,payment,quantity,owner:i%2?'David':'Sarah',kind:customer==='Shop stock'?'Stock':'Customer',phone:'',email:'',isbn:'',notes:'Fictional sample order. No real customer details.',location:'',received:status==='received'?quantity:0,damaged:0,createdAt:ago(d+1),orderedAt:status==='new'?null:ago(d),dispatchedAt:['dispatched','received'].includes(status)?ago(Math.max(0,d-2)):null,receivedAt:status==='received'?ago(Math.max(0,d-3)):null,version:1,history:[{at:ago(d+1),text:'Sample order created',by:i%2?'David':'Sarah'}]}));}
let records;
try{const stored=localStorage.getItem(key);records=stored?JSON.parse(stored):seed();if(!Array.isArray(records))throw Error('Invalid trial records.');localStorage.setItem(key,JSON.stringify(records));}
catch(e){document.body.innerHTML='<main><h1>Browser storage is unavailable</h1><p>Open this downloaded HTML file in a regular Chrome or Edge window with local storage enabled. The trial cannot safely save orders in this window.</p></main>';throw e;}
const fields=['customer','book','owner','quantity','kind','channel','payment','supplier','phone','email','isbn','notes','location'];
const check=o=>{for(const k of ['customer','book','owner'])if(typeof o[k]!=='string'||!o[k].trim())throw Error('Please enter '+k+'.');if(!Number.isInteger(o.quantity)||o.quantity<1||o.quantity>10000)throw Error('Check the quantity.');};
const nativeFetch=window.fetch;
window.fetch=async(url,options={})=>{
if(!String(url).startsWith('/api/'))return nativeFetch(url,options);
if(String(url).startsWith('/api/gmail/'))return new Response(JSON.stringify({error:'The standalone trial cannot connect mailboxes. Use the privately hosted server app after Google authorisation.'}),{status:503});
try{
// Refresh from storage so two tabs do not silently overwrite each other.
records=JSON.parse(localStorage.getItem(key));
if(!options.method||options.method==='GET')return new Response(JSON.stringify(url==='/api/export'?{exportedAt:new Date().toISOString(),orders:records}:records),{status:200});
const input=JSON.parse(options.body),at=new Date().toISOString();let result;
if(url==='/api/orders'){
const o=Object.fromEntries(fields.map(k=>[k,input[k]]));check(o);Object.assign(o,{id:crypto.randomUUID?crypto.randomUUID():'trial-'+Date.now()+'-'+Math.random().toString(16).slice(2),reference:'TF-'+(Math.max(1040,...records.map(x=>Number(x.reference.slice(3))))+1),status:'new',createdAt:at,orderedAt:null,dispatchedAt:null,receivedAt:null,received:0,damaged:0,version:1,history:[{at,text:'Order created in standalone trial',by:o.owner}]});records.unshift(o);result=o;
}else{
const id=String(url).split('/').at(-1),o=records.find(r=>r.id===id);if(!o)throw Error('Order not found.');if(input.version!==o.version)return new Response(JSON.stringify({error:'Another tab updated this order. Reload and try again.'}),{status:409});let text='';
switch(input.action){
case 'edit':for(const k of fields)if(k in input)o[k]=input[k];check(o);if(o.quantity<o.received+o.damaged)throw Error('Quantity cannot be lower than goods checked in.');text='Order details updated';break;
case 'order':if(o.status!=='new'||!input.supplier)throw Error('Choose a supplier for this new order.');o.supplier=input.supplier;o.status='ordered';o.orderedAt=at;text='Order placement recorded with '+o.supplier+' (no email sent)';break;
case 'dispatch':if(o.status!=='ordered')throw Error('Place the order first.');o.status='dispatched';o.dispatchedAt=at;text=o.supplier==='Friedman'?'Invoice recorded manually · dispatched':'Dispatch recorded manually';break;
case 'receive':{if(!['ordered','dispatched','partial','received'].includes(o.status))throw Error('This order cannot be checked in.');const good=Number(input.received),bad=Number(input.damaged);if(!Number.isInteger(good)||!Number.isInteger(bad)||good<o.received||bad<0||good+bad>o.quantity)throw Error('Check received and damaged quantities.');o.received=good;o.damaged=bad;o.location=String(input.location||'');o.status=good===o.quantity?'received':'partial';if(good&&!o.receivedAt)o.receivedAt=at;text='Delivery checked: '+good+' good, '+bad+' damaged, '+(o.quantity-good-bad)+' outstanding';break;}
case 'notify':if(o.status!=='received'||o.kind!=='Customer')throw Error('Receive the full customer order first.');o.status='notified';text='Sample '+o.channel+' notification recorded — no message sent';break;
case 'collect':if(!['received','notified'].includes(o.status))throw Error('Receive the full order first.');if(o.kind==='Customer'&&o.payment!=='Paid')throw Error('Mark the order paid before collection.');o.status='collected';text=o.kind==='Stock'?'Stock shelved':'Customer collected order';break;
case 'note':if(!String(input.note||'').trim())throw Error('Enter a note.');text=String(input.note).slice(0,4000);break;
default:throw Error('Unknown action.');
}
o.version++;o.history.push({at,text,by:o.owner});result=o;
}
localStorage.setItem(key,JSON.stringify(records));return new Response(JSON.stringify(result),{status:url==='/api/orders'?201:200});
}catch(e){return new Response(JSON.stringify({error:e.message}),{status:400});}
};
window.downloadTrialExport=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),orders:JSON.parse(localStorage.getItem(key))},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tiferes-trial-orders.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
document.addEventListener('click',e=>{if(e.target.closest('a[href="/api/export"]')){e.preventDefault();downloadTrialExport();}});
})();`;
let html=readFileSync(path.join(root,'index.html'),'utf8');
const css=readFileSync(path.join(root,'styles.css'),'utf8');
let app=readFileSync(path.join(root,'app.js'),'utf8');
app=app.replaceAll("location.assign('/api/export')","downloadTrialExport()").replaceAll('Saved to this workspace','Saved in this browser only');
html=html.replace('<link rel="stylesheet" href="/styles.css">','<style>'+css+'</style>').replace('<script defer src="/app.js"></script>','');
html=html.replace('Local workspace saved','Saved in this browser').replace('First version · sample workspace','Standalone trial · sample data').replace('Saved to this workspace','Saved in this browser only').replace('Try the full order journey with sample records. Gmail, Erply and message sending are not connected.','Standalone trial: sample orders save in this browser only, not across devices. No accounts are connected and no messages are sent.').replace('This version saves orders in a local shared database. Live service connections are the next implementation step.','This downloaded trial saves orders only in this browser on this computer. It does not connect to the shared database, Erply, Gmail or messaging accounts. Use sample data only. Clearing browser storage removes trial changes.');
html=html.replace('href="/" aria-label="Tiferes home"','href="#" aria-label="Tiferes home"');
html=html.replace('</body>','<script>'+offline+'\n'+app.replaceAll('</script','<\\/script')+'</script></body>');
writeFileSync(path.join(out,'Tiferes-Trial.html'),html);
writeFileSync(path.join(out,'START-HERE.txt'),'TIFERES BOOKSHOP — INTERACTIVE TRIAL\n\nDouble-click Tiferes-Trial.html and open it in Chrome or Edge. No installation, account or internet connection is needed.\n\nTry: New order -> Create order -> Place order -> Record dispatch -> Check in delivery -> Try notification.\n\nThis is a standalone trial, not the live shop system. Use fictional details only. Records save in this browser on this computer, not across devices. Do not use private/incognito mode. Clearing browser storage removes trial changes. Export saves a JSON copy; importing it is not implemented. Notifications are simulations: no messages are sent. Your original website and Firebase data are untouched.\n');
console.log('Created interactive trial in '+out);
