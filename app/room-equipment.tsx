'use client';
import {useState} from 'react';
import {Plus,Package,Trash2} from 'lucide-react';
import NumericInput from './numeric-input';

export type Equipment={id:string;name:string;quantity:number;unit:string;condition:string;note:string};
const presets=['Giường + Tủ','Đợt trang trí','Điều hòa + Điều khiển','Bình nóng lạnh','Kệ bếp nấu ăn, Tủ bếp','Trang thiết bị nhà vệ sinh','Đèn chiếu sáng trong phòng','Quạt trần','Tủ lạnh','Bàn ăn','Bếp từ - Hồng ngoại','Rèm','Nệm','Sơn tường, Sàn nhà','Cửa ra vào, cửa sổ, cửa ban công, cửa nhà vệ sinh','Khóa, Chìa khóa phòng, cổng','Quạt thông gió'];
const conditions=['Bình thường','Mới','Cần sửa chữa','Hư hỏng','Thiếu / thất lạc'];
export default function RoomEquipment({value,onChange,disabled=false}:{value:Equipment[];onChange:(items:Equipment[])=>void;disabled?:boolean}){
 const [custom,setCustom]=useState(''),[error,setError]=useState('');
 const [drafts,setDrafts]=useState<Record<string,Equipment>>({});
 function add(name:string){
  const trimmed=name.trim();
  if(!trimmed){setError('Vui lòng nhập tên thiết bị.');return;}
  if(value.some(item=>item.name.toLocaleLowerCase('vi')===trimmed.toLocaleLowerCase('vi'))){setError('Thiết bị này đã có trong danh sách.');return;}
  if(value.length>=100){setError('Mỗi phòng có tối đa 100 loại thiết bị.');return;}
  onChange([...value,drafts[trimmed]||{id:crypto.randomUUID(),name:trimmed,quantity:trimmed==='Rèm'?2:1,unit:'bộ',condition:'Bình thường',note:''}]);setCustom('');setError('');
 }
 function remove(item:Equipment){setDrafts({...drafts,[item.name]:item});onChange(value.filter(v=>v.id!==item.id));}
 function update(id:string,patch:Partial<Equipment>){onChange(value.map(v=>v.id===id?{...v,...patch}:v));}
 return <fieldset className="equipment-section" disabled={disabled}>
  <legend><Package size={19}/>Trang thiết bị trong phòng</legend>
  <p className="equipment-help">Chọn các mục có trong phòng, rồi nhập số lượng và tình trạng thực tế. Chỉ các mục được chọn mới được lưu.</p>
  <div className="equipment-presets">{presets.map(name=><label key={name}><input type="checkbox" checked={value.some(v=>v.name===name)} onChange={e=>{if(e.target.checked)add(name);else{const item=value.find(v=>v.name===name);if(item)remove(item);}}}/><span>{name}</span></label>)}</div>
  <div className="equipment-custom"><label>Thiết bị khác<input value={custom} maxLength={120} onChange={e=>{setCustom(e.target.value);setError('');}} placeholder="Ví dụ: Máy giặt" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(custom);}}}/></label><button type="button" className="secondary" onClick={()=>add(custom)} disabled={disabled||value.length>=100}><Plus size={16}/>Thêm</button></div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="equipment-heading"><b>Đã chọn {value.length} loại thiết bị</b><span>Số lượng tính theo đơn vị của từng mục</span></div>
  {!value.length?<p className="equipment-empty">Chưa ghi nhận thiết bị cho phòng này.</p>:<div className="equipment-items">{value.map((item,index)=><article className="equipment-item" key={item.id}>
   <div className="equipment-title"><b><span>{String(index+1).padStart(2,'0')}</span>{item.name}</b><button type="button" className="icon-button" aria-label={'Bỏ '+item.name} onClick={()=>remove(item)}><Trash2 size={16}/></button></div>
   <div className="equipment-fields"><label>Số lượng<NumericInput label={'Số lượng '+item.name} required min={1} max={9999} value={Number.isNaN(item.quantity)?0:item.quantity} onChange={quantity=>update(item.id,{quantity})}/></label><label>Đơn vị<input aria-label={'Đơn vị '+item.name} required maxLength={20} value={item.unit} placeholder="bộ, cái, chiếc…" onChange={e=>update(item.id,{unit:e.target.value})}/></label><label className="equipment-condition">Tình trạng<select aria-label={'Tình trạng '+item.name} value={item.condition} onChange={e=>update(item.id,{condition:e.target.value})}>{conditions.map(c=><option key={c}>{c}</option>)}</select></label><label className="equipment-note">Ghi chú<input aria-label={'Ghi chú '+item.name} maxLength={500} value={item.note} placeholder="Hãng, mã thiết bị, vị trí hoặc chi tiết hư hỏng…" onChange={e=>update(item.id,{note:e.target.value})}/></label></div>
  </article>)}</div>}
 </fieldset>;
}
