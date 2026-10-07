'use client';

import {useEffect,useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {vi} from 'date-fns/locale';
import {Calendar} from '@/components/ui/calendar';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

function fromIso(value:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 return match?`${match[3]}/${match[2]}/${match[1]}`:'';
}

function parseDate(value:string){
 const trimmed=value.trim();
 if(!trimmed)return '';
 let day:number,month:number,year:number;
 const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
 const digits=trimmed.replace(/\D/g,'');
 if(iso){
  year=Number(iso[1]);
  month=Number(iso[2]);
  day=Number(iso[3]);
 }else if(/^\d{8}$/.test(digits)){
  day=Number(digits.slice(0,2));
  month=Number(digits.slice(2,4));
  year=Number(digits.slice(4));
 }else{
  const match=/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  if(!match)return '';
  day=Number(match[1]);
  month=Number(match[2]);
  year=Number(match[3]);
 }
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return '';
 return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function asLocalDate(value:string){
 const parsed=parseDate(value);
 if(!parsed)return undefined;
 const [year,month,day]=parsed.split('-').map(Number);
 return new Date(year,month-1,day);
}

function toIso(date:Date){
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export default function DateInput({value,onChange,required,label,portalContainer}:{value:string;onChange:(value:string)=>void;required?:boolean;label:string;portalContainer?:HTMLElement|null}){
 const [draft,setDraft]=useState(()=>fromIso(value));
 const [error,setError]=useState('');
 const [open,setOpen]=useState(false);
 const editing=useRef(false);
 const previousValue=useRef(value);
 const input=useRef<HTMLInputElement>(null);
 const selected=asLocalDate(value);

 useEffect(()=>{
  if(previousValue.current===value)return;
  previousValue.current=value;
  if(!editing.current){setDraft(fromIso(value));setError('');}
 },[value]);

 function setDate(iso:string,display:string){
  previousValue.current=iso;
  setDraft(display);
  setError('');
  input.current?.setCustomValidity('');
  onChange(iso);
 }

 function updateDraft(next:string){
  setDraft(next);
  const iso=parseDate(next);
  const invalid=!!next.trim()&&!iso;
  setError(invalid?'Nhập ngày theo dạng ngày/tháng/năm, ví dụ 07/10/2026.':'');
  input.current?.setCustomValidity(invalid?'Ngày không hợp lệ. Hãy nhập theo dạng ngày/tháng/năm.':'');
  if(iso){
   previousValue.current=iso;
   onChange(iso);
  }else{
   previousValue.current='';
   onChange('');
  }
 }

 return <div className="date-input">
  <div className="date-input-control">
   <input ref={input} type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" aria-label={label} aria-invalid={!!error} required={required} value={draft}
    onFocus={()=>{editing.current=true;}}
    onChange={event=>updateDraft(event.target.value)}
    onBlur={()=>{
     editing.current=false;
     const iso=parseDate(draft);
     if(iso)setDate(iso,fromIso(iso));
    }}/>
   <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button className="date-picker-trigger" type="button" aria-label={`Chọn ${label.toLowerCase()}`} title="Chọn ngày trên lịch"><CalendarDays size={18}/></button></PopoverTrigger>
    <PopoverContent className="date-picker-popover" align="end" sideOffset={6} portalContainer={portalContainer}>
     <Calendar mode="single" locale={vi} selected={selected} defaultMonth={selected||new Date()} onSelect={date=>{if(date){const iso=toIso(date);setDate(iso,fromIso(iso));setOpen(false);input.current?.focus();}}}/>
    </PopoverContent>
   </Popover>
  </div>
  {error&&<small className="date-input-error" role="alert">{error}</small>}
 </div>;
}
