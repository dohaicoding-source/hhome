'use client';

import {useRef,useState} from 'react';

type NumericInputProps={
 value:number;
 onChange:(value:number)=>void;
 step?:string;
 min?:number;
 max?:number;
 required?:boolean;
 currencyUnit?:string;
 label:string;
};

function formatNumber(value:number,decimals:boolean){
 if(!Number.isFinite(value))return '';
 return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:decimals?1:0}).format(value);
}

function parseNumber(value:string,decimals:boolean):number|null{
 const normalized=value.trim().replace(/\s/g,'');
 if(!normalized)return null;
 let digits=normalized.replace(/[^\d.,-]/g,'');
 if(decimals&&digits.includes('.')&&digits.includes(',')){
  const decimalSeparator=digits.lastIndexOf('.')>digits.lastIndexOf(',')?'.':',';
  const groupingSeparator=decimalSeparator==='.'?',':'.';
  digits=digits.replaceAll(groupingSeparator,'').replace(decimalSeparator,'.');
 }else if(decimals&&digits.includes(',')){
  digits=digits.replace(',','.');
 }else if(!decimals){
  digits=digits.replace(/[.,]/g,'');
 }
 const number=Number(digits);
 return Number.isFinite(number)?number:null;
}

export default function NumericInput({value,onChange,step='1',min=0,max,required,currencyUnit,label}:NumericInputProps){
 const decimals=step!=='1';
 const [draft,setDraft]=useState(()=>formatNumber(value,decimals));
 const [focused,setFocused]=useState(false);
 const input=useRef<HTMLInputElement>(null);

 function updateValidity(number:number|null,raw:string){
  if(!input.current)return;
  if(number===null){
   input.current.setCustomValidity(raw.trim()?'Vui lòng nhập số hợp lệ.':'');
   return;
  }
  if(min!==undefined&&number<min)input.current.setCustomValidity(`Giá trị phải từ ${min} trở lên.`);
  else if(max!==undefined&&number>max)input.current.setCustomValidity(`Giá trị không được vượt quá ${max}.`);
  else if(decimals&&Math.abs(number*10-Math.round(number*10))>1e-8)input.current.setCustomValidity('Chỉ nhập tối đa 1 chữ số thập phân.');
  else input.current.setCustomValidity('');
 }

 return <span className="numeric-input">
  <input ref={input} type="text" inputMode={decimals?'decimal':'numeric'} autoComplete="off" aria-label={label} required={required} value={focused?draft:formatNumber(value,decimals)}
   onFocus={()=>{setFocused(true);setDraft(Number.isFinite(value)?String(value):'');}}
   onChange={event=>{
    const next=event.target.value;
    setDraft(next);
    const number=parseNumber(next,decimals);
    updateValidity(number,next);
    onChange(number??0);
   }}
   onBlur={()=>{
    setFocused(false);
    const number=parseNumber(draft,decimals);
    updateValidity(number,draft);
   }}/>
  {currencyUnit&&<span className="numeric-unit" aria-hidden="true">{currencyUnit}</span>}
 </span>;
}
