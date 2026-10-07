'use client';
import {useState} from 'react';
import {ExternalLink,MapPin} from 'lucide-react';
import {mapsURL} from '@/lib/maps';
export default function BuildingMap({name,url,embed}:{name:string;url?:string;embed?:string}){
 const [failed,setFailed]=useState(false);
 if(!url)return null;
 try{mapsURL(url);if(embed)mapsURL(embed);}catch{return null;}
 return <section className="building-map" aria-label={'Vị trí '+name}>
 {embed&&!failed?<iframe title={'Bản đồ '+name} src={embed} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} allowFullScreen/>:<div className="map-unavailable"><MapPin size={20}/><span>Chưa tải được bản đồ. Bạn có thể mở vị trí trên Google Maps.</span></div>}
 <a href={url} target="_blank" rel="noopener noreferrer"><MapPin size={14}/>Mở Google Maps<ExternalLink size={13}/></a>
 </section>;
}
