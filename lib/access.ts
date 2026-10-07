import {database} from './database';
import {currentUser} from './identity';
import {Membership,visibleRecords} from './permissions';
import type {Row} from './rental';
export class AccessError extends Error{constructor(message:string,public status=403){super(message);}}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function apiError(e:unknown){if(e instanceof AccessError)return json({error:e.message},e.status);console.error('Request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'},503);}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)throw new AccessError('Yêu cầu không hợp lệ. Hãy tải lại trang.');}
export async function workspaceAccess(req:Request){
 const user=await currentUser(req);if(!user)throw new AccessError('Vui lòng đăng nhập để tiếp tục.',401);
 const workspace=req.headers.get('x-workspace-id');if(!workspace)throw new AccessError('Hãy chọn không gian quản lý.',400);
 const db=database();const member=await db.prepare('SELECT m.*,w.owner_id,w.name AS workspace_name FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=? AND m.user_id=? AND m.status=?').bind(workspace,user.id,'active').first<Membership&{owner_id:string;workspace_name:string}>();
 if(!member||member.role==='owner'&&member.owner_id!==user.id)throw new AccessError('Bạn không có quyền truy cập không gian này hoặc quyền đã bị thu hồi.');
 const {results}=await db.prepare('SELECT id,kind,data,version,created_at AS createdAt FROM records WHERE owner=? ORDER BY created_at,id').bind(workspace).all<any>();
 const all:Row[]=results.map(r=>({...r,data:JSON.parse(r.data)}));
 return {db,user,member,workspace,all,visible:visibleRecords(all,member)};
}
// Include this guard in each write, so a concurrent revocation or scope change wins.
export const membershipGuard='EXISTS (SELECT 1 FROM memberships WHERE id=? AND user_id=? AND status=\'active\' AND version=?)';
