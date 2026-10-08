import {contractTenantIds,invoiceTotal,type Row} from './rental';
export function summarize(records:Row[],from:string,to:string,building:string,asOf:string){
 const byId=new Map(records.map(r=>[r.id,r]));const rows=(kind:string)=>records.filter(r=>r.kind===kind);
 const buildingOf=(r:Row):string=>r.kind==='buildings'?r.id:r.data.buildingId||(r.kind==='contracts'?byId.get(r.data.roomId)?.data.buildingId:r.kind==='invoices'?byId.get(byId.get(r.data.contractId)?.data.roomId)?.data.buildingId:'')||'';
 const inScope=(r:Row)=>building==='all'||buildingOf(r)===building;
 const invoices=rows('invoices').filter(r=>inScope(r)&&r.data.period>=from&&r.data.period<=to);
 const expenses=rows('expenses').filter(r=>inScope(r)&&r.data.date.slice(0,7)>=from&&r.data.date.slice(0,7)<=to);
 const rooms=rows('rooms').filter(inScope),contracts=rows('contracts').filter(inScope);
 const occupied=(r:Row)=>contracts.some(c=>c.data.roomId===r.id&&c.data.active&&c.data.start<=asOf&&c.data.end>=asOf);
 const totals=(inv:Row[],exp:Row[])=>{const billed=inv.reduce((s,r)=>s+invoiceTotal(r.data),0),paid=inv.reduce((s,r)=>s+r.data.paid,0),cost=exp.reduce((s,r)=>s+r.data.amount,0);return {billed,paid,cost,balance:paid-cost,debt:inv.reduce((s,r)=>s+Math.max(0,invoiceTotal(r.data)-r.data.paid),0)};};
 const monthly=[];let cursor=from;while(cursor<=to){monthly.push({month:cursor,...totals(invoices.filter(r=>r.data.period===cursor),expenses.filter(r=>r.data.date.startsWith(cursor)))});const [y,m]=cursor.split('-').map(Number);cursor=m===12?(y+1)+'-01':y+'-'+String(m+1).padStart(2,'0');}
 const properties=rows('buildings').filter(inScope).map(b=>{const all=rooms.filter(r=>buildingOf(r)===b.id),used=all.filter(occupied).length;return {id:b.id,name:b.data.name as string,rooms:all.length,occupied:used,maintenance:all.filter(r=>!occupied(r)&&r.data.status==='Bảo trì').length,...totals(invoices.filter(r=>buildingOf(r)===b.id),expenses.filter(r=>buildingOf(r)===b.id))};});
 const describe=(c?:Row,tenantIds?:string[])=>({property:byId.get(byId.get(c?.data.roomId)?.data.buildingId)?.data.name||'—',room:byId.get(c?.data.roomId)?.data.name||'—',tenant:(tenantIds||contractTenantIds(c?.data||{})).map(id=>byId.get(id)?.data.name).filter(Boolean).join(', ')||'—'});
 const debts=invoices.filter(r=>invoiceTotal(r.data)>r.data.paid).map(r=>({id:r.id,...describe(byId.get(r.data.contractId),Array.isArray(r.data.tenantIds)?r.data.tenantIds:undefined),period:r.data.period as string,due:r.data.due as string,amount:invoiceTotal(r.data)-r.data.paid,overdue:r.data.due<asOf})).sort((a,b)=>a.due.localeCompare(b.due));
 const expiry=contracts.filter(c=>c.data.active&&c.data.start<=asOf).map(c=>({id:c.id,...describe(c),end:c.data.end as string,days:Math.ceil((Date.parse(c.data.end)-Date.parse(asOf))/86400000)})).filter(c=>c.days<=30).sort((a,b)=>a.days-b.days);
 const used=rooms.filter(occupied).length,maintenance=rooms.filter(r=>!occupied(r)&&r.data.status==='Bảo trì').length;
 return {from,to,asOf,...totals(invoices,expenses),rooms:rooms.length,occupied:used,maintenance,vacant:rooms.length-used-maintenance,monthly,properties,debts,expiry,expenseGroups:Object.entries(expenses.reduce((a,r)=>{const k=r.data.category||'Khác';a[k]=(a[k]||0)+r.data.amount;return a;},{} as Record<string,number>)).map(([name,amount])=>({name,amount}))};
}
export type OwnerReport=ReturnType<typeof summarize>;
