import {z} from 'zod';
import {database} from '@/lib/database';
import {cookie,cookieToken,currentUser,digest,hashPassword,normalizePhone,randomToken,verifyPassword} from '@/lib/identity';
import {AccessError,checkOrigin} from '@/lib/access';
import {AuthError,authErrorResponse,authMessages,type AuthCode} from '@/lib/auth-errors';
const phoneInput=z.string({required_error:'AUTH_PHONE_REQUIRED',invalid_type_error:'AUTH_PHONE_INVALID'}).trim().min(1,'AUTH_PHONE_REQUIRED').max(30,'AUTH_PHONE_INVALID');
const passwordInput=z.string({required_error:'AUTH_PASSWORD_REQUIRED',invalid_type_error:'AUTH_PASSWORD_REQUIRED'}).min(1,'AUTH_PASSWORD_REQUIRED').max(128,'AUTH_PASSWORD_TOO_LONG');
const newPassword=passwordInput.min(10,'AUTH_PASSWORD_POLICY');
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('login'),phone:phoneInput,password:passwordInput}),
 z.object({action:z.literal('logout')}),
 z.object({action:z.literal('register'),phone:phoneInput,password:newPassword,name:z.string({required_error:'AUTH_NAME_INVALID',invalid_type_error:'AUTH_NAME_INVALID'}).trim().min(1,'AUTH_NAME_INVALID').max(100,'AUTH_NAME_INVALID'),workspaceName:z.string().trim().min(1,'AUTH_WORKSPACE_INVALID').max(100,'AUTH_WORKSPACE_INVALID').optional()}),
 z.object({action:z.literal('recover'),phone:phoneInput,password:newPassword,recoveryCode:z.string({required_error:'AUTH_RECOVERY_REQUIRED'}).trim().min(1,'AUTH_RECOVERY_REQUIRED').max(100,'AUTH_RECOVERY_INVALID')}),
 z.object({action:z.literal('password'),phone:phoneInput,password:newPassword,oldPassword:z.string({required_error:'AUTH_CURRENT_PASSWORD_INVALID'}).min(1,'AUTH_CURRENT_PASSWORD_INVALID').max(128,'AUTH_CURRENT_PASSWORD_INVALID')})
]);
async function rateLimit(key:string,max:number){const db=database(),now=Math.floor(Date.now()/1000),bucket=Math.floor(now/900),id=await digest(key+':'+bucket);const result=await db.prepare('INSERT INTO auth_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=auth_limits.attempts+1 RETURNING attempts').bind(id,(bucket+1)*900).first<{attempts:number}>();if((result?.attempts||0)>max)throw new AuthError('AUTH_RATE_LIMITED',429);}
async function newSession(id:string){const token=randomToken();await database().prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),id,new Date(Date.now()+7*86400000).toISOString()).run();return token;}
export async function POST(req:Request){try{
 checkOrigin(req);const d=input.parse(await req.json());const db=database();
 if(d.action==='logout'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(cookieToken(req))).run();return Response.json({ok:true},{headers:{'Set-Cookie':cookie('',0),'Cache-Control':'no-store'}});}
 const phone=normalizePhone(d.phone||'');await rateLimit('phone:'+phone,12);await rateLimit('ip:'+(req.headers.get('cf-connecting-ip')||'shared'),60);
 await db.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Math.floor(Date.now()/1000)-86400).run();
 if(!d.password)throw new AuthError('AUTH_PASSWORD_REQUIRED',400);
 if(d.action==='register'){
  if(!d.name)throw new AuthError('AUTH_NAME_INVALID',400);
  const exists=await db.prepare('SELECT id FROM accounts WHERE phone=?').bind(phone).first();if(exists)throw new AuthError('AUTH_PHONE_EXISTS',409);
  const id=crypto.randomUUID(),recoveryCode=randomToken(),now=new Date().toISOString();
  // Existing records stay under their previous owner key; only the same trusted platform identity can claim them.
  const legacyId=req.headers.get('oai-authenticated-user-id');
  const legacy=legacyId?await db.prepare('SELECT id FROM records WHERE owner=? LIMIT 1').bind(legacyId).first():null;
  const workspaceId=legacy?legacyId!:id;
  const statements=[db.prepare('INSERT INTO accounts (id,phone,name,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').bind(id,phone,d.name,await hashPassword(d.password),await digest(recoveryCode),now)];
  if(d.workspaceName){
   statements.push(db.prepare('INSERT INTO workspaces (id,name,owner_id,created_at) VALUES (?,?,?,?)').bind(workspaceId,d.workspaceName,id,now));
   statements.push(db.prepare('INSERT INTO memberships (id,workspace_id,user_id,phone,name,role,status,building_ids,version,created_at) VALUES (?,?,?,?,?,?,?, ?,1,?)').bind(crypto.randomUUID(),workspaceId,id,phone,d.name,'owner','active','[]',now));
  }
  await db.batch(statements);const token=await newSession(id);
  return Response.json({ok:true,recoveryCode},{headers:{'Set-Cookie':cookie(token),'Cache-Control':'no-store'}});
 }
 const account=await db.prepare('SELECT * FROM accounts WHERE phone=?').bind(phone).first<{id:string;password_hash:string;recovery_hash:string}>();
 if(d.action==='login'){
  // Run the same expensive derivation even when the phone does not exist.
  const valid=await verifyPassword(d.password,account?.password_hash||'scrypt$16384$8$5$0000000000000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000');
  if(!account||!valid)throw new AuthError('AUTH_INVALID_CREDENTIALS',401);
  const token=await newSession(account.id);return Response.json({ok:true},{headers:{'Set-Cookie':cookie(token),'Cache-Control':'no-store'}});
 }
 if(d.action==='password'){
  const user=await currentUser(req);if(!user)throw new AuthError('AUTH_SESSION_EXPIRED',401);if(!account||account.id!==user.id||!await verifyPassword(d.oldPassword||'',account.password_hash))throw new AuthError('AUTH_CURRENT_PASSWORD_INVALID',401);
 }else if(!account||!d.recoveryCode||await digest(d.recoveryCode)!==account.recovery_hash)throw new AuthError('AUTH_RECOVERY_INVALID',401);
 if(!account)throw new AuthError('AUTH_INVALID_CREDENTIALS',401);
 const recoveryCode=randomToken();const changed=await db.batch([
  db.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(await hashPassword(d.password),await digest(recoveryCode),account.id,account.recovery_hash),
  db.prepare('DELETE FROM sessions WHERE user_id=?').bind(account.id)
 ]);if(!changed[0].meta.changes)throw new AuthError('AUTH_CONFLICT',409);
 return Response.json({ok:true,recoveryCode},{headers:{'Set-Cookie':cookie('',0),'Cache-Control':'no-store'}});
 }catch(e){
 if(e instanceof AuthError)return authErrorResponse(e.code,e.status);
 if(e instanceof z.ZodError){const code=e.issues[0]?.message;return authErrorResponse(code&&code in authMessages?code as AuthCode:'AUTH_INVALID_REQUEST',400);}
 if(e instanceof SyntaxError)return authErrorResponse('AUTH_INVALID_REQUEST',400);
 if(e instanceof AccessError)return authErrorResponse('AUTH_ORIGIN_REJECTED',e.status);
 if(e instanceof Error&&e.message.startsWith('Số điện thoại không hợp lệ'))return authErrorResponse('AUTH_PHONE_INVALID',400);
 if(String(e).includes('UNIQUE'))return authErrorResponse('AUTH_CONFLICT',409);
 console.error('Authentication request failed');return authErrorResponse('AUTH_UNAVAILABLE',503);
 }}
