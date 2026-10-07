import {workspaceAccess,AccessError,apiError,json} from '@/lib/access';
import {summarize} from '@/lib/reports';
import {today} from '@/lib/rental';
export async function GET(req:Request){try{
 const a=await workspaceAccess(req);if(a.member.role!=='owner')throw new AccessError('Chỉ chủ nhà được xem báo cáo tổng hợp.');
 const p=new URL(req.url).searchParams,from=p.get('from')||'',to=p.get('to')||'',building=p.get('building')||'all';
 const valid=(s:string)=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(s);const months=(s:string)=>Number(s.slice(0,4))*12+Number(s.slice(5));
 if(!valid(from)||!valid(to)||from>to||months(to)-months(from)>35)throw new AccessError('Chọn khoảng thời gian hợp lệ, tối đa 36 tháng.',400);
 if(building!=='all'&&!a.all.some(r=>r.kind==='buildings'&&r.id===building))throw new AccessError('Không tìm thấy cơ sở trong không gian của bạn.',404);
 return json(summarize(a.all,from,to,building,today()));
 }catch(e){return apiError(e);}}
