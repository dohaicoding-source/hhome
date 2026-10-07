import {z} from 'zod';
import {workspaceAccess,checkOrigin,apiError,AccessError,json,membershipGuard} from '@/lib/access';
import {digest,normalizePhone,randomToken} from '@/lib/identity';
import type {Membership} from '@/lib/permissions';
const schema=z.object({action:z.enum(['invite','update','renew','revoke']),id:z.string().optional(),version:z.number().int().optional(),name:z.string().trim().min(1).max(100).optional(),phone:z.string().max(30).optional(),role:z.enum(['staff','tenant']).optional(),buildingIds:z.array(z.string()).max(1000).default([]),tenantId:z.string().optional()});
export async function GET(req:Request){try{const a=await workspaceAccess(req);if(a.member.role!=='owner')throw new AccessError('Chỉ chủ nhà được xem danh sách phân quyền.');const {results}=await a.db.prepare('SELECT id,workspace_id,user_id,phone,name,role,status,building_ids,tenant_id,version,expires_at FROM memberships WHERE workspace_id=? ORDER BY created_at').bind(a.workspace).all();return json({members:results});}catch(e){return apiError(e);}}
export async function POST(req:Request){try{
 checkOrigin(req);const a=await workspaceAccess(req);if(a.member.role!=='owner')throw new AccessError('Chỉ chủ nhà được cấp hoặc thu hồi quyền.');
 const d=schema.parse(await req.json());const guard=[a.member.id,a.user.id,a.member.version];
 let old=d.id?await a.db.prepare('SELECT * FROM memberships WHERE id=? AND workspace_id=?').bind(d.id,a.workspace).first<Membership>():null;
 if(d.action!=='invite'&&(!old||old.version!==d.version))throw new AccessError('Thành viên đã thay đổi. Hãy tải lại danh sách.',409);
 if(old?.role==='owner')throw new AccessError('Không thể thay đổi quyền của chủ nhà.');
 if(d.action==='revoke'){
 const r=await a.db.prepare("UPDATE memberships SET status='revoked',token_hash=NULL,version=version+1 WHERE id=? AND workspace_id=? AND version=? AND "+membershipGuard).bind(d.id,a.workspace,d.version,...guard).run();if(!r.meta.changes)throw new AccessError('Quyền đã thay đổi. Hãy tải lại.',409);return json({ok:true});
 }
 const token=randomToken(),expires=new Date(Date.now()+7*86400000).toISOString();
 if(d.action==='renew'){
 if(old?.status!=='pending')throw new AccessError('Chỉ tạo lại lời mời chưa được chấp nhận.',400);
 const r=await a.db.prepare('UPDATE memberships SET token_hash=?,expires_at=?,version=version+1 WHERE id=? AND version=? AND '+membershipGuard).bind(await digest(token),expires,d.id,d.version,...guard).run();if(!r.meta.changes)throw new AccessError('Lời mời đã thay đổi.',409);return json({ok:true,token});
 }
 if(!d.name||!d.role||!d.phone)throw new AccessError('Vui lòng điền đủ thông tin.',400);
 const phone=normalizePhone(d.phone);const scopes=[...new Set(d.buildingIds)];
 if(d.role==='staff'&&(!scopes.length||scopes.some(id=>!a.all.some(r=>r.id===id&&r.kind==='buildings'))))throw new AccessError('Hãy chọn ít nhất một cơ sở thuộc không gian này.',400);
 if(d.role==='tenant'&&!a.all.some(r=>r.id===d.tenantId&&r.kind==='tenants'))throw new AccessError('Hãy chọn đúng hồ sơ người thuê trong không gian này.',400);
 if(d.action==='update'){
 if(old!.phone!==phone||old!.role!==d.role)throw new AccessError('Không thể đổi số điện thoại hoặc vai trò của lời mời cũ. Hãy thu hồi và mời lại.',400);
 if(old!.status==='revoked')throw new AccessError('Thành viên đã bị thu hồi quyền.',409);
 const r=await a.db.prepare('UPDATE memberships SET name=?,building_ids=?,tenant_id=?,version=version+1 WHERE id=? AND version=? AND '+membershipGuard).bind(d.name,JSON.stringify(d.role==='staff'?scopes:[]),d.role==='tenant'?d.tenantId!:null,d.id,d.version,...guard).run();if(!r.meta.changes)throw new AccessError('Phân quyền đã thay đổi. Hãy tải lại.',409);return json({ok:true});
 }
 old=await a.db.prepare('SELECT * FROM memberships WHERE workspace_id=? AND phone=?').bind(a.workspace,phone).first<Membership>();
 if(old&&old.status!=='revoked')throw new AccessError('Số điện thoại đã có quyền hoặc có lời mời đang chờ.',409);
 const values=[phone,d.name,d.role,JSON.stringify(d.role==='staff'?scopes:[]),d.role==='tenant'?d.tenantId!:null,await digest(token),expires];
 const r=old?await a.db.prepare("UPDATE memberships SET phone=?,name=?,role=?,building_ids=?,tenant_id=?,token_hash=?,expires_at=?,user_id=NULL,status='pending',version=version+1 WHERE id=? AND version=? AND "+membershipGuard).bind(...values,old.id,old.version,...guard).run():await a.db.prepare("INSERT INTO memberships (phone,name,role,building_ids,tenant_id,token_hash,expires_at,id,workspace_id,status,version,created_at) SELECT ?,?,?,?,?,?,?,?,?,'pending',1,? WHERE "+membershipGuard).bind(...values,crypto.randomUUID(),a.workspace,new Date().toISOString(),...guard).run();
 if(!r.meta.changes)throw new AccessError('Quyền đã thay đổi. Hãy tải lại.',409);return json({ok:true,token});
 }catch(e){if(e instanceof z.ZodError)return json({error:'Thông tin phân quyền không hợp lệ.'},400);if(String(e).includes('UNIQUE'))return json({error:'Thành viên hoặc lời mời đã tồn tại.'},409);if(e instanceof Error&&e.message.startsWith('Số điện thoại'))return json({error:e.message},400);return apiError(e);}}
