import {contractTenantIds,type Row} from './rental';
export type Role='owner'|'staff'|'tenant';
export const roleNames:Record<Role,string>={owner:'Chủ nhà',staff:'Nhân viên quản lý',tenant:'Người thuê phòng'};
export type Membership={id:string;workspace_id:string;user_id:string|null;phone:string;name:string;role:Role;status:'active'|'pending'|'revoked';building_ids:string;tenant_id:string|null;version:number;expires_at:string|null};
export function visibleRecords(all:Row[], member:Membership):Row[]{
 if(member.role==='owner')return all;
 const scopes=new Set<string>(JSON.parse(member.building_ids));
 const rooms=all.filter(r=>r.kind==='rooms');
 const contracts=all.filter(r=>r.kind==='contracts');
 if(member.role==='tenant'){
  const owned=contracts.filter(r=>contractTenantIds(r.data).includes(member.tenant_id||''));
  const ownedIds=new Set(owned.map(r=>r.id));
  const ownedInvoices=all.filter(r=>r.kind==='invoices'&&(ownedIds.has(r.data.contractId)||Array.isArray(r.data.tenantIds)&&r.data.tenantIds.includes(member.tenant_id)));
  const contractIds=new Set([...ownedIds,...ownedInvoices.map(r=>r.data.contractId)]),roomIds=new Set(contracts.filter(r=>contractIds.has(r.id)).map(r=>r.data.roomId));
  const invoiceIds=new Set(ownedInvoices.map(r=>r.id));
  const buildingIds=new Set(rooms.filter(r=>roomIds.has(r.id)).map(r=>r.data.buildingId));
  return all.filter(r=>r.kind==='tenants'?r.id===member.tenant_id:r.kind==='contracts'?contractIds.has(r.id):r.kind==='invoices'?invoiceIds.has(r.id):r.kind==='rooms'?roomIds.has(r.id):r.kind==='buildings'?buildingIds.has(r.id):false).map(r=>{const {note,equipment,identity,vehicles,...publicData}=r.data;return {...r,data:publicData};});
 }
 const roomIds=new Set(rooms.filter(r=>scopes.has(r.data.buildingId)).map(r=>r.id));
 const allowedContracts=contracts.filter(r=>roomIds.has(r.data.roomId));
 const contractIds=new Set(allowedContracts.map(r=>r.id));
 const tenantIds=new Set(allowedContracts.flatMap(r=>contractTenantIds(r.data)));
 return all.filter(r=>r.kind==='buildings'?scopes.has(r.id):r.kind==='rooms'||r.kind==='expenses'?scopes.has(r.data.buildingId):r.kind==='contracts'?contractIds.has(r.id):r.kind==='invoices'?contractIds.has(r.data.contractId):r.kind==='tenants'?tenantIds.has(r.id)||scopes.has(r.data.buildingId):false);
}
export function canWrite(member:Membership,kind:string,action='save'){
 if(member.role==='owner')return true;
 if(member.role==='tenant'||action==='delete'||kind==='buildings')return false;
 return ['rooms','tenants','contracts','invoices','expenses'].includes(kind);
}
