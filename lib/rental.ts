export type Kind = 'buildings'|'rooms'|'tenants'|'contracts'|'invoices'|'expenses';
export type Row = {id:string; kind:Kind; data:Record<string,any>; version:number; createdAt:string};
export const titles:Record<Kind,string>={buildings:'Cơ sở',rooms:'Phòng',tenants:'Khách thuê',contracts:'Hợp đồng',invoices:'Hóa đơn',expenses:'Chi phí'};
export const contractTenantIds=(data:Record<string,any>):string[]=>Array.isArray(data.tenantIds)?data.tenantIds.filter((id:unknown):id is string=>typeof id==='string'):typeof data.tenantId==='string'?[data.tenantId]:[];
export const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n||0);
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
export function invoiceTotal(d:Record<string,any>){return d.rent+(d.electricNew-d.electricOld)*d.electricRate+(d.waterNew-d.waterOld)*d.waterRate+d.service;}
export const sample:Row[] = [
 ...['An Phú','Bình An','Thảo Điền','Tân Bình','Phú Nhuận','Bình Thạnh'].map((name,i)=>({id:'b'+i,kind:'buildings' as Kind,data:{name:'Nhà '+name,address:'Địa chỉ minh họa • TP. Hồ Chí Minh',type:i<2?'Căn hộ dịch vụ':i<4?'Chung cư mini':'Nhà trọ',note:''},version:1,createdAt:''})),
 ...Array.from({length:18},(_,i)=>({id:'r'+i,kind:'rooms' as Kind,data:{name:String(101+i%3),buildingId:'b'+Math.floor(i/3),floor:1,area:25+i%4*5,rent:3500000+i%5*500000,status:i===17?'Bảo trì':'Sẵn sàng',note:''},version:1,createdAt:''})),
 ...['Nguyễn Minh Anh','Trần Hoàng Nam','Lê Thu Hà','Phạm Quốc Bảo','Đỗ Ngọc Mai','Vũ Thanh Tùng','Ngô Phương Linh','Bùi Đức Huy','Đặng Hải Yến','Hoàng Minh Quân','Phan Thảo Vy','Lý Gia Hân'].map((name,i)=>({id:'t'+i,kind:'tenants' as Kind,data:{name,phone:'09000000'+String(i).padStart(2,'0'),email:'',note:'Khách thuê minh họa'},version:1,createdAt:''})),
 ...Array.from({length:12},(_,i)=>({id:'c'+i,kind:'contracts' as Kind,data:{roomId:'r'+i,tenantId:'t'+i,start:'2026-03-01',end:i<3?'2026-09-30':'2027-03-01',rent:3500000+i%5*500000,deposit:3500000,active:true,note:''},version:1,createdAt:''})),
 ...Array.from({length:12},(_,i)=>({id:'i'+i,kind:'invoices' as Kind,data:{contractId:'c'+i,period:'2026-09',due:'2026-09-10',rent:3500000+i%5*500000,electricOld:100,electricNew:160+i*3,electricRate:3500,waterOld:10,waterNew:14,waterRate:18000,service:150000,paid:i<8?3500000+i%5*500000+(60+i*3)*3500+72000+150000:0,note:''},version:1,createdAt:''})),
 {id:'e1',kind:'expenses',data:{buildingId:'b0',name:'Bảo trì máy bơm',amount:850000,date:'2026-09-05',category:'Sửa chữa',note:''},version:1,createdAt:''}
];
