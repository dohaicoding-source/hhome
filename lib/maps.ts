const googleHosts=new Set(['google.com','www.google.com','maps.google.com','google.com.vn','www.google.com.vn','maps.google.com.vn']);
export function mapsURL(raw:string){
 let u:URL;try{u=new URL(raw);}catch{throw Error('Vui lòng dán đường dẫn Google Maps đầy đủ, bắt đầu bằng https://.');}
 const short=u.hostname==='maps.app.goo.gl'||u.hostname==='goo.gl'&&u.pathname.startsWith('/maps/');
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(short||googleHosts.has(u.hostname)&&(u.pathname==='/maps'||u.pathname.startsWith('/maps/')||u.hostname.startsWith('maps.google.')&&u.pathname==='/')))throw Error('Chỉ chấp nhận liên kết vị trí từ Google Maps.');
 return {url:u,short};
}
export function embedFromMaps(raw:string):string|null{
 const {url:u,short}=mapsURL(raw);if(short)return null;
 if(u.pathname==='/maps/embed'&&u.searchParams.get('pb'))return 'https://www.google.com/maps/embed?pb='+encodeURIComponent(u.searchParams.get('pb')!);
 let decoded:string;try{decoded=decodeURIComponent(u.pathname+u.search);}catch{throw Error('Liên kết Google Maps không hợp lệ.');}
 // !3d/!4d is the place marker; @latitude,longitude is only the camera centre.
 const point=decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
 let query='';
 if(point&&Math.abs(Number(point[1]))<=90&&Math.abs(Number(point[2]))<=180)query=point[1]+','+point[2];
 else query=u.searchParams.get('query')||u.searchParams.get('q')||'';
 if(!query){const place=u.pathname.match(/\/maps\/place\/([^/]+)/);if(place)query=decodeURIComponent(place[1]).replaceAll('+',' ');}
 if(!query||query.length>500||u.pathname.includes('/dir/'))return null;
 return 'https://www.google.com/maps?q='+encodeURIComponent(query)+'&z=16&output=embed';
}
export async function resolveMaps(raw:string){
 let current=raw;
 for(let i=0;i<5;i++){
  const checked=mapsURL(current),embed=embedFromMaps(current);if(embed)return embed;
  if(!checked.short)break;
  const r=await fetch(checked.url,{redirect:'manual',signal:AbortSignal.timeout(5000)});
  const location=r.headers.get('location');await r.body?.cancel();
  if(r.status<300||r.status>=400||!location)break;
  current=new URL(location,checked.url).href;
 }
 throw Error('Chưa xác định được vị trí từ liên kết này. Hãy mở liên kết trong Google Maps rồi sao chép đường dẫn đầy đủ trên thanh địa chỉ, hoặc dùng liên kết Nhúng bản đồ.');
}
