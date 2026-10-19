import {createHash,timingSafeEqual} from 'node:crypto';
export function createShopGate(password){
 if(!password)return ()=>true;
 if(password.length<12)throw Error('BOOKSHOP_ACCESS_PASSWORD must have at least 12 characters.');
 const expected=createHash('sha256').update('shop:'+password).digest();
 return (req,res)=>{let supplied='';try{const header=req.headers.authorization||'';if(header.startsWith('Basic '))supplied=Buffer.from(header.slice(6),'base64').toString('utf8');}catch{}
 const actual=createHash('sha256').update(supplied).digest();if(timingSafeEqual(actual,expected))return true;
 res.writeHead(401,{'WWW-Authenticate':'Basic realm="Tiferes shop (username: shop)", charset="UTF-8"','Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'});res.end('Sign in with username shop and your shop access password.');return false;};
}
