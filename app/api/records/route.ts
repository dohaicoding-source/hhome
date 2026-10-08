import { workspaceAccess, checkOrigin, apiError, AccessError, membershipGuard } from '@/lib/access';
import {mapsURL,resolveMaps} from '@/lib/maps';
import {storage} from '@/lib/storage';
import { canWrite } from '@/lib/permissions';
import { z } from 'zod';
import { invoiceTotal } from '@/lib/rental';
const label=z.string().trim().min(1,'Vui lòng điền thông tin bắt buộc.').max(200);
const note=z.string().max(2000).default(''); const amount=z.number().int().min(0).max(100000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Ngày không hợp lệ');
const equipmentSchema=z.array(z.object({
 id:z.string().min(1,'Mã thiết bị không được để trống.').max(100),
 name:z.string().trim().min(1,'Vui lòng nhập tên thiết bị.').max(120,'Tên thiết bị tối đa 120 ký tự.'),
 quantity:z.number({invalid_type_error:'Số lượng thiết bị phải là số nguyên từ 1 đến 9999.'}).int('Số lượng thiết bị phải là số nguyên.').min(1,'Số lượng thiết bị phải từ 1 trở lên.').max(9999,'Số lượng thiết bị tối đa 9999.'),
 unit:z.string().trim().min(1,'Vui lòng nhập đơn vị thiết bị.').max(20,'Đơn vị tối đa 20 ký tự.'),
 condition:z.enum(['Bình thường','Mới','Cần sửa chữa','Hư hỏng','Thiếu / thất lạc'],{errorMap:()=>({message:'Tình trạng thiết bị không hợp lệ.'})}),
 note:z.string().max(500,'Ghi chú thiết bị tối đa 500 ký tự.').default('')
})).max(100,'Mỗi phòng có tối đa 100 loại thiết bị.').refine(items=>new Set(items.map(i=>i.id)).size===items.length,'Mã thiết bị bị trùng.').refine(items=>new Set(items.map(i=>i.name.toLocaleLowerCase('vi'))).size===items.length,'Tên thiết bị bị trùng.');
const identitySchema=z.object({number:z.string().trim().regex(/^(?:[0-9]{12})?$/,'Số CCCD phải gồm đúng 12 chữ số.').default(''),issueDate:z.union([z.literal(''),date]).default(''),issuePlace:z.string().trim().max(200,'Nơi cấp tối đa 200 ký tự.').default(''),permanentAddress:z.string().trim().max(500,'Địa chỉ thường trú tối đa 500 ký tự.').default('')});
const vehiclesSchema=z.array(z.object({id:z.string().min(1).max(100),plate:z.string().trim().min(1,'Vui lòng nhập biển số xe.').max(20,'Biển số tối đa 20 ký tự.'),model:z.string().trim().max(100).default(''),color:z.string().trim().max(50).default(''),note:z.string().max(300,'Ghi chú xe tối đa 300 ký tự.').default('')})).max(10,'Mỗi khách thuê tối đa 10 xe.').refine(items=>new Set(items.map(v=>v.id)).size===items.length,'Mã xe bị trùng.').refine(items=>new Set(items.map(v=>v.plate.toUpperCase().replace(/[ .-]/g,''))).size===items.length,'Biển số xe bị trùng trong hồ sơ.');
const schemas={
 buildings:z.object({name:label,address:label,type:z.enum(['Căn hộ dịch vụ','Chung cư mini','Nhà trọ']),note,mapsUrl:z.string().trim().max(4096,'Liên kết bản đồ quá dài.').optional()}),
 rooms:z.object({name:label,buildingId:label,floor:z.number().int().min(0).max(200),area:z.number().min(1).max(10000),rent:amount,status:z.enum(['Sẵn sàng','Bảo trì']),note,equipment:equipmentSchema.optional()}),
 tenants:z.object({buildingId:z.string().optional(),name:label,phone:z.string().trim().regex(/^[+\d ()-]{8,20}$/,'Số điện thoại không hợp lệ'),email:z.union([z.literal(''),z.string().email()]),note,identity:identitySchema.optional(),vehicles:vehiclesSchema.optional()}),
 contracts:z.object({roomId:label,tenantId:label,start:date,end:date,rent:amount,deposit:amount,active:z.boolean(),note}).refine(d=>d.end>=d.start,'Ngày kết thúc phải sau ngày bắt đầu'),
 invoices:z.object({contractId:label,period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),due:date,rent:amount,electricOld:amount,electricNew:amount,electricRate:amount,waterOld:amount,waterNew:amount,waterRate:amount,service:amount,paid:amount,note}).refine(d=>d.electricNew>=d.electricOld&&d.waterNew>=d.waterOld,'Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ').refine(d=>d.paid<=invoiceTotal(d),'Số đã thu không được vượt tổng hóa đơn'),
 expenses:z.object({buildingId:label,name:label,amount:amount,date,category:z.enum(['Sửa chữa','Điện nước','Vận hành','Khác']),note})
};
function fail(message:string,status=400){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(req:Request){try{const access=await workspaceAccess(req);return Response.json({records:access.visible},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:Request){
 try{
 checkOrigin(req);const access=await workspaceAccess(req);const {db,member,all,visible}=access;const uid=access.workspace;
 const guardValues=[member.id,access.user.id,member.version];
 const body=z.object({kind:z.string(),id:z.string().optional(),version:z.number().int().optional(),action:z.enum(['delete']).optional(),data:z.unknown().optional()}).parse(await req.json());const kind=body.kind as keyof typeof schemas;if(!schemas[kind])return fail('Loại dữ liệu không hợp lệ.');
 if(!canWrite(member,kind,body.action))return fail('Vai trò của bạn không được thực hiện thao tác này.',403);
 let old:any=null;
 if(body.id){old=await db.prepare('SELECT * FROM records WHERE id=? AND owner=? AND kind=?').bind(body.id,uid,kind).first<any>();if(!old||!visible.some(r=>r.id===body.id))return fail('Không tìm thấy dữ liệu trong phạm vi được giao.',404);if(old.version!==body.version)return fail('Dữ liệu đã thay đổi. Hãy tải lại trước khi sửa.',409);}
 if(body.action==='delete'){
 if(!old)return fail('Không tìm thấy dữ liệu.',404);
 const attachments=kind==='tenants'?(await db.prepare('SELECT object_key FROM tenant_images WHERE owner=? AND tenant_id=?').bind(uid,body.id).all<{object_key:string}>()).results:kind==='contracts'?(await db.prepare('SELECT object_key FROM contract_images WHERE owner=? AND contract_id=?').bind(uid,body.id).all<{object_key:string}>()).results:[];
 const result=await db.prepare('DELETE FROM records WHERE id=? AND owner=? AND version=? AND '+membershipGuard).bind(body.id,uid,body.version,...guardValues).run();if(!result.meta.changes)return fail('Dữ liệu đã thay đổi. Vui lòng tải lại.',409);if(attachments.length){try{await storage().delete(attachments.map(i=>i.object_key));}catch{console.error('Unable to remove unlinked contract images');}}return Response.json({ok:true});
 }
 const parsed=schemas[kind].safeParse(body.data);if(!parsed.success)return fail(parsed.error.issues[0].message);const d=parsed.data as any;
 if(kind==='tenants'){const previous=old?JSON.parse(old.data):{};if(d.identity===undefined)d.identity=previous.identity||{number:'',issueDate:'',issuePlace:'',permanentAddress:''};if(d.vehicles===undefined)d.vehicles=previous.vehicles||[];}
 if(kind==='buildings'){
 const previous=old?JSON.parse(old.data):{};
 if(d.mapsUrl===undefined){d.mapsUrl=previous.mapsUrl||'';d.mapsEmbedUrl=previous.mapsEmbedUrl||'';}
 else if(!d.mapsUrl)d.mapsEmbedUrl='';
 else {try{mapsURL(d.mapsUrl);d.mapsEmbedUrl=d.mapsUrl===previous.mapsUrl&&previous.mapsEmbedUrl?previous.mapsEmbedUrl:await resolveMaps(d.mapsUrl);}catch(e){return fail(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Không kết nối được Google Maps. Hãy thử lại hoặc dùng liên kết đầy đủ.');}}
 }
 // Older clients omit equipment; preserve saved inventory unless explicitly replaced.
 if(kind==='rooms'&&d.equipment===undefined)d.equipment=old?JSON.parse(old.data).equipment||[]:[];

 if(member.role==='staff'){
  const scopes=new Set<string>(JSON.parse(member.building_ids));const has=(id:string,k:string)=>visible.some(r=>r.id===id&&r.kind===k);
  if((kind==='rooms'||kind==='expenses')&&!scopes.has(d.buildingId))return fail('Cơ sở nằm ngoài phạm vi được giao.',403);
  if(kind==='contracts'&&(!has(d.roomId,'rooms')||!has(d.tenantId,'tenants')))return fail('Phòng hoặc khách thuê nằm ngoài phạm vi được giao.',403);
  if(kind==='invoices'&&!has(d.contractId,'contracts'))return fail('Hợp đồng nằm ngoài phạm vi được giao.',403);
  if(kind==='tenants'){
   if(!old&&!scopes.has(d.buildingId))return fail('Hãy chọn cơ sở được giao cho khách thuê mới.',403);
   if(d.buildingId&&!scopes.has(d.buildingId))return fail('Cơ sở nằm ngoài phạm vi được giao.',403);
   const related=all.filter(r=>r.kind==='contracts'&&r.data.tenantId===body.id);
   if(related.some(c=>!has(c.id,'contracts')))return fail('Khách thuê có hợp đồng ở cơ sở khác. Hãy nhờ chủ nhà cập nhật.',403);
  }
 }
 let parentId:string|null=null,tenantId:string|null=null,slot:string|null=null;
 async function related(id:string,k:string){const row=await db.prepare('SELECT data FROM records WHERE id=? AND owner=? AND kind=?').bind(id,uid,k).first<any>();if(!row)throw Error('RELATED');return JSON.parse(row.data);}
 if(kind==='tenants'&&d.buildingId){await related(d.buildingId,'buildings');parentId=d.buildingId;}
 if(kind==='rooms'){await related(d.buildingId,'buildings');parentId=d.buildingId;slot=d.buildingId+':'+d.name.toLowerCase();}
 if(kind==='contracts'){const room=await related(d.roomId,'rooms');await related(d.tenantId,'tenants');if(d.active&&room.status==='Bảo trì')return fail('Phòng đang bảo trì. Hãy chuyển sang sẵn sàng trước khi cho thuê.');parentId=d.roomId;tenantId=d.tenantId;slot=d.active?d.roomId+':'+d.tenantId:null;if(slot&&all.some(r=>r.kind==='contracts'&&r.id!==body.id&&r.data.roomId===d.roomId&&r.data.tenantId===d.tenantId&&r.data.active))return fail('Khách thuê này đã có hợp đồng đang hiệu lực cho phòng này.',409);}
 if(kind==='invoices'){await related(d.contractId,'contracts');parentId=d.contractId;slot=d.contractId+':'+d.period;}
 if(kind==='expenses'){await related(d.buildingId,'buildings');parentId=d.buildingId;}
 const savedId=body.id||crypto.randomUUID();
 if(old){const prev=JSON.parse(old.data);if(kind==='contracts'&&(prev.roomId!==d.roomId||prev.tenantId!==d.tenantId))return fail('Không thể đổi phòng/khách của hợp đồng đã tạo. Hãy kết thúc và tạo hợp đồng mới.');
 const result=await db.prepare('UPDATE records SET data=?,slot=?,parent_id=?,tenant_id=?,version=version+1 WHERE id=? AND owner=? AND version=? AND '+membershipGuard).bind(JSON.stringify(d),slot,parentId,tenantId,body.id,uid,body.version,...guardValues).run();if(!result.meta.changes)return fail('Dữ liệu đã thay đổi. Vui lòng tải lại.',409);
 }else{const result=await db.prepare('INSERT INTO records (id,owner,kind,data,slot,parent_id,tenant_id,version,created_at) SELECT ?,?,?,?,?,?,?,1,? WHERE '+membershipGuard).bind(savedId,uid,kind,JSON.stringify(d),slot,parentId,tenantId,new Date().toISOString(),...guardValues).run();if(!result.meta.changes)return fail('Quyền truy cập đã thay đổi. Hãy tải lại trang.',403);}
 return Response.json({ok:true,id:savedId,version:old?old.version+1:1});
 }catch(e){if(e instanceof AccessError)return apiError(e);if(e instanceof z.ZodError)return fail('Dữ liệu gửi lên không hợp lệ.');console.error(e);const msg=String(e);if(msg.includes('UNIQUE'))return fail('Dữ liệu trùng: tên phòng, khách thuê đã có hợp đồng hiệu lực hoặc hóa đơn cùng kỳ đã tồn tại.',409);if(msg.includes('FOREIGN KEY'))return fail('Không thể xóa vì dữ liệu đang được sử dụng. Hãy xử lý các mục liên quan trước.',409);if(msg.includes('RELATED'))return fail('Dữ liệu liên quan không tồn tại. Hãy tải lại trang.');return fail('Không lưu được dữ liệu. Nội dung bạn nhập vẫn được giữ lại; hãy thử lại.',503);}
}
