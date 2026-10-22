import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'.netlify-shop/public');rmSync(out,{recursive:true,force:true});mkdirSync(path.join(out,'vendor'),{recursive:true});
let html=readFileSync(path.join(root,'index.html'),'utf8').replace('<script defer src="/delivery-model.js">','<script defer src="/hosted-bootstrap.js"></script><script defer src="/vendor/pdf.browser.js"></script><script defer src="/vendor/pdf.worker.browser.js"></script><script defer src="/delivery-model.js">');
html=html.replace('This version saves orders in a local shared database. Live service connections are the next implementation step.','This shop saves shared records in Supabase. Gmail, Erply and message sending are not connected.').replace('Gmail · 3 mailboxes','Gmail · 4 mailboxes');
writeFileSync(path.join(out,'index.html'),html);copyFileSync(path.join(root,'hosted/bootstrap.js'),path.join(out,'hosted-bootstrap.js'));
for(const file of ['styles.css','app.js','delivery-model.js','delivery-chain.js','team-model.js','team-ui.js','auth-ui.js','custom-orders.js','supplier-excel.js','custom-ui.js','invoice-import.js','invoice-upload.js','shop-catalog.js','catalog-ui.js'])copyFileSync(path.join(root,file),path.join(out,file));
for(const file of ['pdf.browser.js','pdf.worker.browser.js','pdfjs-LICENSE'])copyFileSync(path.join(root,'vendor',file),path.join(out,'vendor',file));
const printStyleHashes=['','@page{size:60mm 30mm;margin:0}'].map(css=>"'sha256-"+createHash('sha256').update(css).digest('base64')+"'").join(' ');
writeFileSync(path.join(out,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; style-src 'self' ${printStyleHashes}; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
/api/*
  Cache-Control: no-store
`);
console.log('Created Netlify shop assets in .netlify-shop/public. No secrets or local data are published.');
