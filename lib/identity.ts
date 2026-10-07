import {scrypt,timingSafeEqual} from 'node:crypto';
import {database} from './database';
export type User={id:string;phone:string;name:string};
export const sessionCookie='__Host-rental_session';
export function normalizePhone(value:string){let p=value.replace(/[\s().-]/g,'');if(/^0[35789]\d{8}$/.test(p))p='+84'+p.slice(1);if(!/^\+[1-9]\d{7,14}$/.test(p))throw Error('Số điện thoại không hợp lệ. Dùng 09… hoặc mã quốc gia +84…');return p;}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function digest(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
function derive(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(err,key)=>err?reject(err):resolve(key)));}
export async function hashPassword(password:string){const salt=randomToken();return 'scrypt$16384$8$5$'+salt+'$'+(await derive(password,salt)).toString('hex');}
export async function verifyPassword(password:string,hash:string){const parts=hash.split('$');if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$16384$8$5')return false;const actual=await derive(password,parts[4]);const expected=Buffer.from(parts[5],'hex');return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export function cookieToken(req:Request){return req.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)||'';}
export async function currentUser(req:Request):Promise<User|null>{const token=cookieToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;return await database().prepare('SELECT a.id,a.phone,a.name FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),new Date().toISOString()).first<User>();}
export function cookie(value:string,maxAge=7*86400){return `${sessionCookie}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
