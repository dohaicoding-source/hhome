import fs from 'node:fs';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');for(const file of ['0000_rental.sql','0001_accounts_roles.sql','0002_contract_images.sql','0003_tenant_images.sql'])sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
function prepare(query){return {bind(...values){return {async all(){return {results:sql.prepare(query).all(...values)}},async first(){return sql.prepare(query).get(...values)||null},async run(){return {meta:sql.prepare(query).run(...values)}}}}}}
globalThis.accountTestDB={prepare,async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const blobs=new Map();globalThis.imageTestStorage={async put(key,data){blobs.set(key,new Uint8Array(data));},async get(key){return blobs.has(key)?{body:blobs.get(key)}:null;},async delete(key){for(const k of Array.isArray(key)?key:[key])blobs.delete(k);}};
const paths={'lib/reports.ts':'reports-core','app/api/reports/route.ts':'reports','app/api/tenant-images/route.ts':'tenantImages','lib/maps.ts':'maps','app/api/contract-images/route.ts':'images','lib/auth-errors.ts':'auth-errors','lib/rental.ts':'rental','lib/permissions.ts':'permissions','lib/identity.ts':'identity','lib/access.ts':'access','app/api/auth/route.ts':'auth','app/api/session/route.ts':'session','app/api/team/route.ts':'team','app/api/join/route.ts':'join','app/api/records/route.ts':'records','app/api/workspaces/route.ts':'workspaces'};
fs.mkdirSync('work/qa-modules',{recursive:true});
for(const [path,name] of Object.entries(paths)){let src=fs.readFileSync(path,'utf8').replaceAll("'@/lib/reports'","'./reports-core.mjs'").replace(/import \{\s*storage\s*\} from ['"]@\/lib\/storage['"];?/g,'const storage=()=>globalThis.imageTestStorage;').replace(/import \{\s*database\s*\} from ['"](?:@\/lib\/|\.\/)database['"];?/g,'const database=()=>globalThis.accountTestDB;').replace(/(['"])(?:@\/lib\/|\.\/)(identity|access|permissions|rental|auth-errors|maps)\1/g,"'./$2.mjs'");fs.writeFileSync('work/qa-modules/'+name+'.mjs',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
const handlers={};for(const key of ['auth','session','team','join','records','workspaces','images','tenantImages','reports'])handlers[key]=await import('../work/qa-modules/'+key+'.mjs');
let checks=0;function ok(condition,msg){assert.ok(condition,msg);checks++;}
async function request(path,body,{cookie='',workspace='',origin='https://rental.test',headers={}}={}){const req=new Request('https://rental.test/api/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-Workspace-Id':workspace,'cf-connecting-ip':'127.0.0.1',...headers},body:body?JSON.stringify(body):undefined});const response=await handlers[path][body?'POST':'GET'](req);return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
async function register(phone,owner=true){const r=await request('auth',{action:'register',phone,password:'StrongPass!123',name:'Test '+phone,workspaceName:owner?'Space '+phone:undefined});ok(r.status===200,'registration succeeds: '+JSON.stringify(r.data));const s=await request('session',null,{cookie:r.cookie});return {cookie:r.cookie,workspace:s.data.memberships[0]?.workspace_id,user:s.data.user,recovery:r.data.recoveryCode};}
const a=await register('0900000001'),b=await register('0900000002'),staff=await register('0900000003',false),tenant=await register('0900000004',false);
ok(a.workspace!==b.workspace,'owners have separate spaces');ok((await request('records',null)).status===401,'anonymous blocked');ok((await request('records',null,{...b,workspace:a.workspace})).status===403,'other owner blocked');
async function create(kind,data,ctx=a){const r=await request('records',{kind,data},ctx);ok(r.status===200,'create '+kind+': '+JSON.stringify(r.data));return (await request('records',null,ctx)).data.records.filter(r=>r.kind===kind).at(-1);}
const house=await create('buildings',{name:'House A',address:'A',type:'Chung cư mini',note:'private'}),house2=await create('buildings',{name:'House B',address:'B',type:'Nhà trọ',note:''});
const room=await create('rooms',{name:'101',buildingId:house.id,floor:1,area:25,rent:4000000,status:'Sẵn sàng',note:'private'}),room2=await create('rooms',{name:'201',buildingId:house2.id,floor:2,area:30,rent:5000000,status:'Sẵn sàng',note:''});
const person=await create('tenants',{name:'Tenant A',phone:'0900000004',email:'',buildingId:house.id,note:'internal only'}),other=await create('tenants',{name:'Tenant B',phone:'0900000005',email:'',buildingId:house2.id,note:''});
const contract=await create('contracts',{roomId:room.id,tenantId:person.id,start:'2026-09-01',end:'2027-09-01',rent:4000000,deposit:4000000,active:true,note:'internal'});
const c2=await create('contracts',{roomId:room2.id,tenantId:other.id,start:'2026-09-01',end:'2027-09-01',rent:5000000,deposit:5000000,active:true,note:''});
const invoice=await create('invoices',{contractId:contract.id,period:'2026-09',due:'2026-09-20',rent:4000000,electricOld:100,electricNew:150,electricRate:3500,waterOld:10,waterNew:14,waterRate:20000,service:150000,paid:0,note:'internal'});
const inviteStaff=await request('team',{action:'invite',name:'Staff',phone:staff.user.phone,role:'staff',buildingIds:[house.id]},a);ok(inviteStaff.status===200,'owner invites staff');
ok((await request('join',{token:inviteStaff.data.token},tenant)).status===400,'wrong phone cannot accept invite');
ok((await request('join',{token:inviteStaff.data.token},staff)).status===200,'staff accepts');staff.workspace=a.workspace;
ok((await request('join',{token:inviteStaff.data.token},staff)).status===400,'invite is single use');
let view=(await request('records',null,staff)).data.records;ok(view.some(r=>r.id===room.id)&&!view.some(r=>r.id===room2.id)&&!view.some(r=>r.id===other.id),'staff sees assigned building only');
ok((await request('records',{kind:'rooms',id:room2.id,version:1,data:room2.data},staff)).status===404,'staff cannot edit other building');
ok((await request('records',{kind:'rooms',id:room.id,version:1,data:{...room.data,buildingId:house2.id}},staff)).status===403,'staff cannot move room outside scope');
ok((await request('records',{kind:'buildings',data:house.data},staff)).status===403,'staff cannot create building');
ok((await request('records',{kind:'invoices',id:invoice.id,version:1,data:{...invoice.data,paid:4405000}},staff)).status===200,'staff records payment');
ok((await request('records',{action:'delete',kind:'invoices',id:invoice.id,version:2},staff)).status===403,'staff cannot delete');
ok((await request('team',null,staff)).status===403,'staff cannot read role admin');
const inviteTenant=await request('team',{action:'invite',name:'Tenant A',phone:tenant.user.phone,role:'tenant',tenantId:person.id},a);ok(inviteTenant.status===200,'invite tenant');ok((await request('join',{token:inviteTenant.data.token},tenant)).status===200,'tenant accepts');tenant.workspace=a.workspace;
view=(await request('records',null,tenant)).data.records;ok(view.length===5&&!view.some(r=>r.id===other.id)&&view.every(r=>!('note' in r.data)),'tenant only own records, no internal notes');
ok((await request('records',{kind:'invoices',id:invoice.id,version:2,data:{...invoice.data,paid:0}},tenant)).status===403,'tenant cannot edit payments');
ok((await request('team',{action:'invite',name:'Escalate',phone:'0900000099',role:'staff',buildingIds:[house.id]},tenant)).status===403,'tenant cannot invite');
ok((await request('team',{action:'invite',name:'Escalate',phone:'0900000099',role:'owner'},a)).status===400,'cannot create owner via invitations');
// Inventory persists per room and follows existing workspace/building permissions.
const equipment=[{id:'eq-1',name:'Điều hòa + Điều khiển',quantity:1,unit:'bộ',condition:'Cần sửa chữa',note:'Internal repair note'},{id:'eq-2',name:'Rèm',quantity:2,unit:'bộ',condition:'Bình thường',note:''}];
let inventorySave=await request('records',{kind:'rooms',id:room.id,version:1,data:{...room.data,equipment}},a);
ok(inventorySave.status===200,'owner saves room inventory');
let storedRoom=(await request('records',null,a)).data.records.find(r=>r.id===room.id);
ok(JSON.stringify(storedRoom.data.equipment)===JSON.stringify(equipment),'room inventory round trip');
ok((await request('records',{kind:'rooms',id:room.id,version:2,data:{...room.data,equipment}},b)).status===404,'other owner cannot edit inventory');
ok((await request('records',{kind:'rooms',id:room2.id,version:1,data:{...room2.data,equipment}},staff)).status===404,'staff cannot edit inventory outside assigned building');
ok((await request('records',{kind:'rooms',id:room.id,version:2,data:{...room.data,equipment:undefined}},staff)).status===200,'legacy edit in assigned building accepted');
storedRoom=(await request('records',null,a)).data.records.find(r=>r.id===room.id);
ok(storedRoom.data.equipment.length===2,'omitting equipment preserves inventory');
ok((await request('records',{kind:'rooms',id:room.id,version:3,data:{...room.data,equipment}},tenant)).status===403,'tenant cannot edit room inventory');
const tenantRoom=(await request('records',null,tenant)).data.records.find(r=>r.id===room.id);
ok(!('equipment' in tenantRoom.data),'internal inventory notes not exposed to tenant');
for(const bad of [[{...equipment[0],quantity:0}],[{...equipment[0],quantity:1.5}],[{...equipment[0],name:' '}],[{...equipment[0],unit:' '}],[{...equipment[0],condition:'Invalid'}],[equipment[0],equipment[0]],Array.from({length:101},(_,i)=>({...equipment[0],id:String(i),name:'Device '+i}))]){
 ok((await request('records',{kind:'rooms',id:room.id,version:3,data:{...room.data,equipment:bad}},a)).status===400,'invalid inventory rejected');
}
ok((await request('records',{kind:'rooms',id:room.id,version:3,data:{...room.data,equipment:[]}},staff)).status===200,'staff can explicitly clear inventory');
ok((await request('records',null,a)).data.records.find(r=>r.id===room.id).data.equipment.length===0,'inventory removal saved');
// Private contract image storage and permissions.
const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
async function imageReq(method,ctx=a,{contractId=contract.id,imageId='',bytes=png,uploadId=crypto.randomUUID(),origin='https://rental.test'}={}){
 const headers={Origin:origin,Cookie:ctx.cookie||'','X-Workspace-Id':ctx.workspace||''};let body;
 if(method==='POST'){body=new FormData();body.append('file',new File([bytes],'contract.png',{type:'image/png'}));body.append('uploadId',uploadId);}
 if(method==='DELETE'){body=JSON.stringify({contractId,imageId});headers['Content-Type']='application/json';}
 const res=await handlers.images[method](new Request('https://rental.test/api/contract-images?contractId='+contractId+'&imageId='+imageId,{method,headers,body}));
 return {status:res.status,data:res.headers.get('content-type')?.includes('application/json')?await res.json():new Uint8Array(await res.arrayBuffer()),headers:res.headers};
}
const uploadId=crypto.randomUUID();let im=await imageReq('POST',a,{uploadId});ok(im.status===200,'owner uploads contract image');const imageId=im.data.image.id;
ok((await imageReq('POST',a,{uploadId})).data.image.id===imageId&&blobs.size===1,'retry upload idempotent');
ok((await imageReq('GET')).data.images.length===1,'image metadata lists');
let imageBytes=await imageReq('GET',a,{imageId});ok(imageBytes.status===200&&imageBytes.data[0]===137&&imageBytes.headers.get('cache-control').includes('no-store'),'authorized private image read');
ok((await imageReq('GET',b,{imageId})).status===404,'other owner cannot read image');
ok((await imageReq('POST',b)).status===404,'other owner cannot upload');
ok((await imageReq('GET',{}, {imageId})).status===401,'anonymous cannot read image');
ok((await imageReq('GET',tenant,{imageId})).status===403,'tenant denied internal contract scans');
ok((await imageReq('GET',staff,{imageId})).status===200,'assigned staff reads image');
ok((await imageReq('POST',staff,{contractId:c2.id})).status===404,'staff outside building cannot upload');
ok((await imageReq('POST',a,{bytes:new TextEncoder().encode('<svg>bad</svg>')})).status===400,'nonimage content rejected');
ok((await imageReq('POST',a,{bytes:new Uint8Array(10*1024*1024+1)})).status===400,'oversize image rejected');
ok((await imageReq('POST',a,{origin:'https://evil.test'})).status===403,'cross origin upload rejected');
ok((await imageReq('DELETE',b,{imageId})).status===404,'other owner cannot delete');
ok((await imageReq('DELETE',staff,{imageId})).status===200&&blobs.size===0,'assigned staff deletes image');
ok((await imageReq('GET',a,{imageId})).status===404,'deleted image inaccessible');
for(let i=0;i<20;i++)ok((await imageReq('POST')).status===200,'upload within limit');
ok((await imageReq('POST')).status===409&&blobs.size===20,'limit enforced with orphan cleanup');
// Building location is derived on the server and persists across legacy edits.
let mapSave=await request('records',{kind:'buildings',id:house.id,version:1,data:{...house.data,mapsUrl:'https://www.google.com/maps?q=10.77,106.69',mapsEmbedUrl:'https://evil.test'}},a);
ok(mapSave.status===200,'save building maps URL');
let mapped=(await request('records',null,a)).data.records.find(r=>r.id===house.id);
ok(mapped.data.mapsEmbedUrl==='https://www.google.com/maps?q=10.77%2C106.69&z=16&output=embed','server derives trusted embed URL');
ok((await request('records',{kind:'buildings',id:house.id,version:2,data:{...house.data,mapsUrl:undefined}},a)).status===200,'legacy building edit');
 mapped=(await request('records',null,a)).data.records.find(r=>r.id===house.id);ok(!!mapped.data.mapsUrl,'legacy edit preserves map');
ok((await request('records',{kind:'buildings',id:house.id,version:3,data:{...house.data,mapsUrl:'https://evil.test/maps'}},a)).status===400,'untrusted map blocked');
ok((await request('records',{kind:'buildings',id:house.id,version:3,data:{...house.data,mapsUrl:''}},a)).status===200,'clear map');
ok(!(await request('records',null,a)).data.records.find(r=>r.id===house.id).data.mapsEmbedUrl,'embed cleared');
const mapModule=await import('../work/qa-modules/maps.mjs');
ok(mapModule.embedFromMaps('https://www.google.com/maps/place/Home/@1,2,16z/data=!3d10.77!4d106.69').includes('10.77%2C106.69'),'marker takes priority over camera');
for(const bad of ['javascript:alert(1)','https://www.google.com.evil.test/maps?q=x','https://evil.test@www.google.com/maps?q=x','https://www.google.com/url?q=x','https://www.google.com:444/maps?q=x']){let rejected=false;try{mapModule.mapsURL(bad);}catch{rejected=true;}ok(rejected,'reject unsafe URL');}
const realFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://www.google.com/maps?q=10.77,106.69'}});};
ok((await mapModule.resolveMaps('https://maps.app.goo.gl/test')).includes('10.77%2C106.69')&&calls===1,'short link resolves');
globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/secret'}});let rejectedRedirect=false;try{await mapModule.resolveMaps('https://maps.app.goo.gl/test');}catch{rejectedRedirect=true;}ok(rejectedRedirect,'unsafe redirect blocked');globalThis.fetch=realFetch;

const identity={number:'001234567890',issueDate:'2024-01-01',issuePlace:'Test place',permanentAddress:'Test address'};
const vehicles=[{id:'bike1',plate:'59-A1 123.45',model:'Honda',color:'Black',note:''}];
let personVersion=1;
const savePerson=data=>request('records',{kind:'tenants',id:person.id,version:personVersion,data:{...person.data,...data}},a);
ok((await savePerson({identity,vehicles})).status===200,'save identity and vehicles');personVersion++;
let storedPerson=(await request('records',null,a)).data.records.find(r=>r.id===person.id);
ok(storedPerson.data.identity.number==='001234567890'&&storedPerson.data.vehicles[0].plate===vehicles[0].plate,'identity and vehicle roundtrip');
for(const data of [{identity:{...identity,number:'123'}},{identity:{...identity,issueDate:'2024-02-31'}},{vehicles:[vehicles[0],{...vehicles[0],id:'bike2',plate:'59A112345'}]}])ok((await savePerson(data)).status===400,'invalid tenant details rejected');
ok((await savePerson({identity:undefined,vehicles:undefined})).status===200,'legacy tenant edit');personVersion++;
storedPerson=(await request('records',null,a)).data.records.find(r=>r.id===person.id);
ok(storedPerson.data.identity.number===identity.number&&storedPerson.data.vehicles.length===1,'legacy edit retains details');
const tenantPerson=(await request('records',null,tenant)).data.records.find(r=>r.id===person.id);
ok(!('identity' in tenantPerson.data)&&!('vehicles' in tenantPerson.data),'tenant details withheld from portal');
async function tenantImageReq(method,ctx=a,{tenantId=person.id,imageId='',bytes=png,uploadId=crypto.randomUUID()}={}){
 const headers={Origin:'https://rental.test',Cookie:ctx.cookie||'','X-Workspace-Id':ctx.workspace||''};let body;
 if(method==='POST'){body=new FormData();body.append('file',new File([bytes],'cccd-test.png',{type:'image/png'}));body.append('uploadId',uploadId);}
 if(method==='DELETE'){body=JSON.stringify({tenantId,imageId});headers['Content-Type']='application/json';}
 const res=await handlers.tenantImages[method](new Request('https://rental.test/api/tenant-images?tenantId='+tenantId+'&imageId='+imageId,{method,headers,body}));
 return {status:res.status,data:res.headers.get('content-type')?.includes('application/json')?await res.json():new Uint8Array(await res.arrayBuffer())};
}
const tid=crypto.randomUUID();const ti=await tenantImageReq('POST',a,{uploadId:tid});ok(ti.status===200,'upload CCCD image');
ok((await tenantImageReq('POST',a,{uploadId:tid})).data.image.id===tid,'CCCD retry idempotent');
ok((await tenantImageReq('GET')).data.images.length===1,'CCCD image lists');
ok((await tenantImageReq('GET',staff,{imageId:tid})).data[0]===137,'assigned staff reads CCCD bytes');
for(const [ctx,status] of [[{},401],[b,404],[tenant,403]])ok((await tenantImageReq('GET',ctx,{imageId:tid})).status===status,'CCCD private access enforced');
ok((await tenantImageReq('POST',staff,{tenantId:other.id})).status===404,'CCCD outside staff scope denied');
ok((await tenantImageReq('POST',a,{tenantId:contract.id})).status===404,'wrong record kind denied');
ok((await tenantImageReq('POST',a,{bytes:new Uint8Array([1,2,3])})).status===400,'invalid CCCD file denied');
ok((await tenantImageReq('POST',a,{bytes:new Uint8Array(10*1024*1024+1)})).status===400,'oversized CCCD file denied');
for(let i=1;i<10;i++)ok((await tenantImageReq('POST')).status===200,'CCCD within image limit');
ok((await tenantImageReq('POST')).status===409,'CCCD max 10 enforced');
ok((await tenantImageReq('DELETE',staff,{imageId:tid})).status===200,'assigned staff deletes CCCD image');
ok((await tenantImageReq('GET',a,{imageId:tid})).status===404,'deleted CCCD unavailable');
ok((await savePerson({identity:{number:'',issueDate:'',issuePlace:'',permanentAddress:''},vehicles:[]})).status===200,'explicitly clear tenant details');personVersion++;

// Reports remain restricted even when called directly.
async function reportReq(ctx,query='from=2026-09&to=2026-09&building=all'){const res=await handlers.reports.GET(new Request('https://rental.test/api/reports?'+query,{headers:{Cookie:ctx.cookie||'','X-Workspace-Id':ctx.workspace||''}}));return {status:res.status,data:await res.json()};}
for(const [ctx,status] of [[{},401],[staff,403],[tenant,403],[{...b,workspace:a.workspace},403]])ok((await reportReq(ctx)).status===status,'report authorization enforced');
const ownerReport=await reportReq(a);ok(ownerReport.status===200&&ownerReport.data.rooms===2&&ownerReport.data.monthly.length===1,'owner gets workspace report');
ok((await reportReq(b)).data.rooms===0,'reports isolated between owners');
ok((await reportReq(a,'from=2026-10&to=2026-09')).status===400,'inverted range rejected');
ok((await reportReq(a,'from=2020-01&to=2026-09')).status===400,'oversized range rejected');
ok((await reportReq(a,'from=2026-09&to=2026-09&building=missing')).status===404,'unknown building rejected');
ok((await reportReq(a,'from=2026-09&to=2026-09&building='+house.id)).data.rooms===1,'report building filter');
const {summarize}=await import('../work/qa-modules/reports-core.mjs');
const fixture=[house,room,person,contract,{...invoice,data:{...invoice.data,paid:1000000}},{id:'report-expense',kind:'expenses',data:{buildingId:house.id,amount:200000,date:'2026-09-04',category:'Vận hành'}}];
const summary=summarize(fixture,'2026-08','2026-09','all','2026-09-17');
ok(summary.billed===4405000&&summary.paid===1000000&&summary.debt===3405000&&summary.cost===200000&&summary.balance===800000,'report financial totals');
ok(summary.monthly[0].billed===0&&summary.monthly[1].paid===1000000,'zero month and invoice period grouping');
ok(summary.occupied===1&&summary.debts[0].overdue===false,'occupancy and due date accurate');
const future=summarize(fixture,'2026-09','2026-09','all','2026-08-01');ok(future.occupied===0,'future contracts do not occupy rooms');
const ended=summarize(fixture,'2026-09','2026-09','all','2027-10-01');ok(ended.occupied===0&&ended.expiry.length===1,'expired active contracts flagged separately');
let members=(await request('team',null,a)).data.members;ok(members.every(m=>!('token_hash' in m)),'token hashes not exposed');const sm=members.find(m=>m.user_id===staff.user.id);
ok((await request('team',{action:'revoke',id:sm.id,version:sm.version},a)).status===200,'revoke staff');ok((await request('records',null,staff)).status===403,'revocation effective immediately');
ok((await request('records',{kind:'tenants',data:person.data},{...a,origin:'https://evil.test'})).status===403,'cross-origin write rejected');
ok((await request('auth',{action:'login',phone:a.user.phone,password:'WrongPass!123'})).status===401,'wrong password rejected');
const recovered=await request('auth',{action:'recover',phone:a.user.phone,password:'NewStrongPass123',recoveryCode:a.recovery});ok(recovered.status===200,'password recovery succeeds');ok((await request('session',null,a)).data.user===null,'recovery invalidates sessions');
ok((await request('auth',{action:'recover',phone:a.user.phone,password:'OtherPassword123',recoveryCode:a.recovery})).status===401,'recovery code cannot be reused');
const signed=await request('auth',{action:'login',phone:a.user.phone,password:'NewStrongPass123'});ok(signed.status===200,'new password login');ok((await request('auth',{action:'logout'},{cookie:signed.cookie})).status===200,'logout');ok((await request('session',null,{cookie:signed.cookie})).data.user===null,'logged-out session invalid');
ok(sql.prepare('SELECT password_hash FROM accounts LIMIT 1').get().password_hash.startsWith('scrypt$'),'passwords hashed');
// Regression: the former browser payload included empty registration-only fields.
sql.exec('DELETE FROM auth_limits');
const freshLogin=await request('auth',{action:'login',phone:b.user.phone,password:'StrongPass!123',name:'',workspaceName:'',recoveryCode:'',oldPassword:''});
ok(freshLogin.status===200&&!!freshLogin.cookie,'fresh login ignores empty unrelated fields');
ok((await request('session',null,{cookie:freshLogin.cookie})).data.user.id===b.user.id,'fresh login creates usable session');
for(const [body,code,status] of [
 [{action:'login',password:'anything'},'AUTH_PHONE_REQUIRED',400],
 [{action:'login',phone:'   ',password:'anything'},'AUTH_PHONE_REQUIRED',400],
 [{action:'login',phone:'123',password:'anything'},'AUTH_PHONE_INVALID',400],
 [{action:'login',phone:b.user.phone,password:''},'AUTH_PASSWORD_REQUIRED',400],
 [{action:'login',phone:b.user.phone,password:'bad'},'AUTH_INVALID_CREDENTIALS',401],
 [{action:'login',phone:'0909999999',password:'bad'},'AUTH_INVALID_CREDENTIALS',401],
 [{action:'login',phone:b.user.phone,password:'x'.repeat(129)},'AUTH_PASSWORD_TOO_LONG',400],
 [{action:'register',phone:b.user.phone,password:'StrongPass!123',name:''},'AUTH_NAME_INVALID',400],
 [{action:'register',phone:b.user.phone,password:'short',name:'Test'},'AUTH_PASSWORD_POLICY',400],
 [{action:'register',phone:b.user.phone,password:'StrongPass!123',name:'Test',workspaceName:''},'AUTH_WORKSPACE_INVALID',400],
 [{action:'register',phone:b.user.phone,password:'StrongPass!123',name:'Test'},'AUTH_PHONE_EXISTS',409],
 [{action:'recover',phone:b.user.phone,password:'StrongPass!123',recoveryCode:''},'AUTH_RECOVERY_REQUIRED',400],
 [{action:'recover',phone:b.user.phone,password:'StrongPass!123',recoveryCode:'bad'},'AUTH_RECOVERY_INVALID',401],
 [{action:'password',phone:b.user.phone,password:'StrongPass!123',oldPassword:'bad'},'AUTH_SESSION_EXPIRED',401],
 [{action:'other'},'AUTH_INVALID_REQUEST',400]
]){const r=await request('auth',body);ok(r.status===status&&r.data.code===code&&typeof r.data.error==='string'&&!r.data.error.includes('String must'),code+': '+JSON.stringify(r));}
const badOrigin=await request('auth',{action:'login',phone:b.user.phone,password:'StrongPass!123'},{origin:'https://evil.test'});ok(badOrigin.data.code==='AUTH_ORIGIN_REJECTED','origin code');
const malformed=await handlers.auth.POST(new Request('https://rental.test/api/auth',{method:'POST',headers:{Origin:'https://rental.test'},body:'{'}));ok(malformed.status===400&&(await malformed.json()).code==='AUTH_INVALID_REQUEST','malformed JSON code');
sql.exec('DELETE FROM auth_limits');
for(let i=0;i<13;i++){const r=await request('auth',{action:'login',phone:'0909999998',password:'wrong'});if(i===12)ok(r.status===429&&r.data.code==='AUTH_RATE_LIMITED','rate limit code');}
console.log('PASS '+checks+' checks: registration/login/recovery/logout, workspace isolation, role scope, invitations, revocation, write validation, cookie sessions and hashed passwords.');




