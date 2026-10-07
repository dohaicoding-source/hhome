import {workspaceAccess,checkOrigin,AccessError,apiError,json,membershipGuard} from '@/lib/access';
import {storage} from '@/lib/storage';

type Attachment={id:string;tenant_id:string;owner:string;object_key:string;name:string;mime:string;size:number;created_at:string};
async function access(req:Request,tenantId:string){
 const a=await workspaceAccess(req);
 if(a.member.role==='tenant')throw new AccessError('Chỉ chủ nhà và nhân viên được giao mới được quản lý ảnh CCCD.');
 if(!a.visible.some(r=>r.kind==='tenants'&&r.id===tenantId))throw new AccessError('Không tìm thấy khách thuê trong phạm vi được giao.',404);
 return a;
}
function imageType(b:Uint8Array){
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function GET(req:Request){try{
 const url=new URL(req.url),tenantId=url.searchParams.get('tenantId')||'',imageId=url.searchParams.get('imageId');
 const a=await access(req,tenantId);
 if(!imageId){const {results}=await a.db.prepare('SELECT id,name,mime,size,created_at FROM tenant_images WHERE owner=? AND tenant_id=? ORDER BY created_at,id').bind(a.workspace,tenantId).all();return json({images:results});}
 const row=await a.db.prepare('SELECT * FROM tenant_images WHERE id=? AND owner=? AND tenant_id=?').bind(imageId,a.workspace,tenantId).first<Attachment>();
 if(!row)throw new AccessError('Ảnh không còn tồn tại.',404);
 const object=await storage().get(row.object_key);if(!object)throw new AccessError('Không tải được ảnh. Vui lòng thử lại sau.',503);
 return new Response(object.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(row.name),'Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch(e){return apiError(e);}}
export async function POST(req:Request){try{
 checkOrigin(req);
 const tenantId=new URL(req.url).searchParams.get('tenantId')||'';
 const a=await access(req,tenantId);
 if(Number(req.headers.get('content-length')||0)>11*1024*1024)throw new AccessError('Mỗi ảnh tối đa 10 MB.',413);
 const data=await req.formData(),file=data.get('file');
 const uploadId=data.get('uploadId');
 if(typeof uploadId!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(uploadId))throw new AccessError('Mã tải ảnh không hợp lệ. Hãy chọn lại ảnh.',400);
 const existing=await a.db.prepare('SELECT id,name,mime,size,created_at FROM tenant_images WHERE id=? AND owner=? AND tenant_id=?').bind(uploadId,a.workspace,tenantId).first();
 if(existing)return json({image:existing});
 if(!(file instanceof File)||!file.size||file.size>10*1024*1024)throw new AccessError('Chọn ảnh có dung lượng từ 1 byte đến 10 MB.',400);
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=imageType(bytes);
 if(!mime)throw new AccessError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP. Hãy chuyển ảnh HEIC sang JPG trước khi tải lên.',400);
 const id=uploadId,key=a.workspace+'/'+tenantId+'/'+crypto.randomUUID(),name=file.name.slice(0,180)||'anh-cccd',now=new Date().toISOString();
 const bucket=storage();await bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{
  const result=await a.db.prepare('INSERT INTO tenant_images (id,owner,tenant_id,object_key,name,mime,size,created_at) SELECT ?,?,?,?,?,?,?,? WHERE '+membershipGuard+' AND EXISTS (SELECT 1 FROM records WHERE id=? AND owner=? AND kind=\'tenants\') AND (SELECT COUNT(*) FROM tenant_images WHERE owner=? AND tenant_id=?)<10').bind(id,a.workspace,tenantId,key,name,mime,file.size,now,a.member.id,a.user.id,a.member.version,tenantId,a.workspace,a.workspace,tenantId).run();
  if(!result.meta.changes)throw new AccessError('Hồ sơ khách thuê đã thay đổi quyền truy cập hoặc đã đủ 10 ảnh. Hãy tải lại.',409);
 }catch(e){try{await bucket.delete(key);}catch{console.error('Unable to clean unlinked tenant image');}throw e;}
 return json({image:{id,name,mime,size:file.size,created_at:now}});
 }catch(e){return apiError(e);}}
export async function DELETE(req:Request){try{
 checkOrigin(req);const d=await req.json() as {tenantId:string;imageId:string};
 if(typeof d.tenantId!=='string'||typeof d.imageId!=='string')throw new AccessError('Yêu cầu không hợp lệ.',400);
 const a=await access(req,d.tenantId);
 const row=await a.db.prepare('SELECT * FROM tenant_images WHERE id=? AND owner=? AND tenant_id=?').bind(d.imageId,a.workspace,d.tenantId).first<Attachment>();
 if(!row)throw new AccessError('Ảnh không còn tồn tại.',404);
 const result=await a.db.prepare('DELETE FROM tenant_images WHERE id=? AND owner=? AND '+membershipGuard).bind(row.id,a.workspace,a.member.id,a.user.id,a.member.version).run();
 if(!result.meta.changes)throw new AccessError('Quyền truy cập đã thay đổi. Hãy tải lại.',409);
 try{await storage().delete(row.object_key);}catch{console.error('Unable to remove unlinked tenant image');}
 return json({ok:true});
 }catch(e){if(e instanceof SyntaxError)return json({error:'Yêu cầu không hợp lệ.'},400);return apiError(e);}}
