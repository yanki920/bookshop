import http from 'node:http';
import DeliveryModel from './delivery-model.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {GmailStore,createGmailService} from './integrations/gmail.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.BOOKSHOP_DATA_DIR||path.join(root,'.data');
mkdirSync(data,{recursive:true});
let gmailMailboxes=String(process.env.GMAIL_MAILBOXES||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!gmailMailboxes.length){try{gmailMailboxes=JSON.parse(readFileSync(path.join(data,'gmail-mailboxes.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
const gmail=createGmailService({mailboxes:gmailMailboxes,store:new GmailStore(data)});
const db=new DatabaseSync(path.join(data,'orders.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, document TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, document TEXT NOT NULL)');
const invoiceRows=()=>db.prepare('SELECT document FROM invoices ORDER BY rowid DESC').all().map(r=>JSON.parse(r.document));
const saveInvoice=o=>db.prepare('INSERT OR REPLACE INTO invoices VALUES (?,?)').run(o.id,JSON.stringify(o));
if(!db.prepare('SELECT count(*) AS n FROM invoices').get().n)DeliveryModel.samples().forEach(saveInvoice);
const all=()=>db.prepare('SELECT document FROM orders ORDER BY rowid DESC').all().map(r=>JSON.parse(r.document));
const save=o=>db.prepare('INSERT OR REPLACE INTO orders VALUES (?,?)').run(o.id,JSON.stringify(o));
const now=()=>new Date().toISOString();
const ago=d=>new Date(Date.now()-d*86400000).toISOString();
if(!db.prepare('SELECT count(*) AS n FROM orders').get().n){
const examples=[
['M. Rosenberg','Artscroll Schottenstein Talmud · Berachos','Lehmanns','ordered',7,'SMS','Paid',1,'Sarah'],
['D. Cohen','The Illustrated Pirkei Avos','Lehmanns','ordered',4,'WhatsApp','Unpaid',1,'David'],
['Shop stock','Koren Siddur · Ashkenaz','Friedman','dispatched',3,'None','Unpaid',6,'Sarah'],
['Y. Weiss','Mishnah Berurah · Complete set','Lehmanns','received',5,'WhatsApp','Deposit',1,'David'],
['S. Klein','Niflaos Hatorah','Friedman','received',4,'SMS','Paid',1,'Sarah'],
['A. Friedman','Personalised velvet tefillin bag','America','new',1,'Email','Deposit',1,'David'],
['Shop stock','Tehillim · Pocket edition','Sifrei','ordered',9,'None','Unpaid',10,'Sarah'],
['B. Levy','Chumash with Rashi · Vayikra','','new',0,'SMS','Unpaid',1,'Sarah'],
['R. Adler','The Family Haggadah','Lehmanns','notified',6,'Email','Paid',2,'David'],
['E. Stern','Mesillas Yesharim · English','Friedman','collected',10,'SMS','Paid',1,'Sarah']
];
examples.forEach((a,i)=>{const [customer,book,supplier,status,days,channel,payment,quantity,owner]=a;
const createdAt=ago(days+1), orderedAt=status==='new'?null:ago(days);
save({id:randomUUID(),reference:`TF-${1041+i}`,customer,book,supplier,status,channel,payment,quantity,owner,phone:'',email:'',isbn:'',notes:'Sample order — replace with your own workflow.',kind:customer==='Shop stock'?'Stock':'Customer',received:['received','notified','collected'].includes(status)?quantity:0,damaged:0,location:'',createdAt,orderedAt,dispatchedAt:['dispatched','received','notified','collected'].includes(status)?ago(Math.max(0,days-2)):null,receivedAt:['received','notified','collected'].includes(status)?ago(Math.max(0,days-3)):null,version:1,history:[{at:createdAt,text:'Sample order created',by:owner}]});});
}
const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/delivery-model.js':'delivery-model.js'};
function valid(o){
for(const k of ['customer','book','owner'])if(typeof o[k]!=='string'||!o[k].trim()||o[k].length>500)throw Error(`Please enter ${k}.`);
if(!Number.isInteger(o.quantity)||o.quantity<1||o.quantity>10000)throw Error('Quantity must be between 1 and 10,000.');
if(!['Customer','Stock'].includes(o.kind)||!['SMS','WhatsApp','Email','None'].includes(o.channel)||!['Unpaid','Deposit','Paid'].includes(o.payment))throw Error('Invalid order options.');
if(!['','Lehmanns','Friedman','Sifrei','America','Other'].includes(o.supplier))throw Error('Invalid supplier.');
for(const k of ['phone','email','isbn','notes','location'])if(typeof o[k]!=='string'||o[k].length>4000)throw Error('Invalid '+k);
if(o.kind==='Customer'&&o.channel==='SMS'&&o.phone&&!/^\+?[\d ()-]{6,30}$/.test(o.phone))throw Error('Please check the phone number.');
}
const fields=['customer','book','owner','quantity','kind','channel','payment','supplier','phone','email','isbn','notes','location'];
const server=http.createServer(async(req,res)=>{
const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
try{
const url=new URL(req.url,'http://localhost');
if(url.pathname.startsWith('/api/gmail/')||url.pathname==='/oauth/gmail/callback'){
 // These administration routes stay local until employee authentication and private hosting exist.
 const peer=req.socket.remoteAddress;let host;try{host=new URL('http://'+req.headers.host).hostname;}catch{}
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)||!['localhost','127.0.0.1','[::1]'].includes(host))return send(403,{error:'Mailbox access requires authenticated private hosting. Local administration only.'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Request origin not allowed.'});
 if(req.method==='GET'&&url.pathname==='/api/gmail/status')return send(200,gmail.status());
 if(req.method==='GET'&&url.pathname==='/api/gmail/connect')return send(200,{url:gmail.authorizationUrl(url.searchParams.get('email'))});
 if(req.method==='GET'&&url.pathname==='/oauth/gmail/callback')return send(200,await gmail.completeAuthorization(Object.fromEntries(url.searchParams)));
 if(req.method==='GET'&&url.pathname==='/api/gmail/messages'){
  const email=url.searchParams.get('email'),query=url.searchParams.get('query');const result=await gmail.listMessages(email,{query,pageToken:url.searchParams.get('pageToken')});
  const messages=[];for(const m of result.messages)messages.push(await gmail.getMessage(email,m.id));
  return send(200,{...result,messages});
 }
 if(req.method==='POST'&&url.pathname==='/api/gmail/drafts'){
  let raw='';for await(const part of req){raw+=part;if(raw.length>100000)return send(413,{error:'Draft too large.'});}
  let input;try{input=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON.'});}
  return send(201,await gmail.createReplyDraft(input.email,{messageId:input.messageId,body:input.body}));
 }
 return send(405,{error:'Mailbox operation not supported.'});
}
if(url.pathname.startsWith('/api/')){
if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'Request origin not allowed.'});
if(req.method==='GET'&&url.pathname==='/api/invoices')return send(200,invoiceRows());
if(req.method==='GET'&&url.pathname==='/api/orders')return send(200,all());
if(req.method==='GET'&&url.pathname==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="bookshop-orders.json"');return send(200,{exportedAt:now(),orders:all(),invoices:invoiceRows()});}
if(req.method!=='POST')return send(405,{error:'Method not allowed.'});
let body='';for await(const part of req){body+=part;if(body.length>6000000)return send(413,{error:'Request too large.'});}
let input;try{input=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON.'});}
if(url.pathname==='/api/invoices'){
 const invoice=DeliveryModel.create(input,{id:randomUUID(),at:now()});
 if(invoiceRows().some(x=>x.supplier.toLowerCase()===invoice.supplier.toLowerCase()&&x.number.toLowerCase()===invoice.number.toLowerCase()))return send(409,{error:'This supplier invoice is already registered.'});
 saveInvoice(invoice);return send(201,invoice);
}
const invoiceMatch=url.pathname.match(/^\/api\/invoices\/([\w-]+)$/);
if(invoiceMatch){const existing=invoiceRows().find(o=>o.id===invoiceMatch[1]);if(!existing)return send(404,{error:'Invoice not found.'});const invoice=DeliveryModel.update(existing,input,now());saveInvoice(invoice);return send(200,invoice);}
if(url.pathname==='/api/orders'){
const o=Object.fromEntries(fields.map(k=>[k,input[k]]));valid(o);
const existing=all();o.id=randomUUID();o.reference=`TF-${Math.max(1040,...existing.map(x=>Number(x.reference.slice(3))))+1}`;o.status='new';o.createdAt=now();o.orderedAt=null;o.dispatchedAt=null;o.receivedAt=null;o.received=0;o.damaged=0;o.version=1;o.history=[{at:now(),text:'Order created',by:o.owner}];save(o);return send(201,o);
}
const match=url.pathname.match(/^\/api\/orders\/([\w-]+)$/);if(!match)return send(404,{error:'Not found.'});
const row=db.prepare('SELECT document FROM orders WHERE id=?').get(match[1]);if(!row)return send(404,{error:'Order not found.'});
const o=JSON.parse(row.document);
if(input.version!==o.version)return send(409,{error:'Another employee updated this order. Reload and try again.'});
let note='';
if(input.action==='edit'){for(const k of fields)if(k in input)o[k]=input[k];valid(o);if(o.quantity<o.received+o.damaged)throw Error('Quantity cannot be lower than goods already checked in.');note='Order details updated';}
else if(input.action==='order'){if(o.status!=='new')throw Error('This order is already placed.');if(!input.supplier)throw Error('Choose a supplier.');o.supplier=input.supplier;valid(o);o.status='ordered';o.orderedAt=now();note=`Order placed with ${o.supplier}`;}
else if(input.action==='dispatch'){if(o.status!=='ordered')throw Error('Only placed orders can be dispatched.');o.status='dispatched';o.dispatchedAt=now();note=o.supplier==='Friedman'?'Invoice recorded manually · dispatched':'Dispatch confirmation recorded manually';}
else if(input.action==='receive'){
if(!['ordered','dispatched','partial','received'].includes(o.status))throw Error('This order cannot be checked in.');
const received=Number(input.received),damaged=Number(input.damaged);
if(!Number.isInteger(received)||!Number.isInteger(damaged)||received<o.received||damaged<0||received+damaged>o.quantity)throw Error('Enter total good items and unresolved damaged items; their sum must not exceed quantity ordered.');
o.received=received;o.damaged=damaged;o.location=String(input.location||'').slice(0,500);o.status=received===o.quantity?'received':'partial';if(received&&!o.receivedAt)o.receivedAt=now();note=`Delivery checked: ${received} good, ${damaged} damaged, ${o.quantity-received-damaged} outstanding`;
}
else if(input.action==='notify'){if(o.status!=='received'||o.kind==='Stock')throw Error('Only complete customer orders can be notified.');o.status='notified';note=`Sample ${o.channel} notification recorded — no message sent`;}
else if(input.action==='collect'){if(!['received','notified'].includes(o.status))throw Error('Receive the full order before collection.');if(o.kind==='Customer'&&o.payment!=='Paid')throw Error('Mark the order paid before collection.');o.status='collected';note=o.kind==='Stock'?'Stock shelved':'Customer collected order';}
else if(input.action==='note'){if(!String(input.note||'').trim())throw Error('Enter a note.');note=String(input.note).slice(0,4000);}
else throw Error('Unknown action.');
o.version++;o.history.push({at:now(),text:note,by:o.owner});save(o);return send(200,o);
}
if(req.method!=='GET'||!files[url.pathname]){res.writeHead(404);return res.end('Not found');}
const name=files[url.pathname];res.writeHead(200,{'Content-Type':name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(readFileSync(path.join(root,name)));
}catch(e){send(e.status||400,{error:e.message});}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Bookshop first version running on port '+(process.env.PORT||3000)));
