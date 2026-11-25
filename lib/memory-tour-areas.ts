export type TourPhoto={id:string;title:string;story:string;photo:string;date:string;point:{x:number;y:number;z:number;name?:string}};
export type TourPlace={name:string;point?:[number,number]};
export type TourArea={id:string;name:string;point:{x:number;y:number;z:number};photos:TourPhoto[]};
export function groupMemoryAreas(items:TourPhoto[],places:TourPlace[]=[]):TourArea[]{
 const areas:TourArea[]=[];
 for(const item of items){
  const photo={...item,point:{...item.point}};
  let area=areas.find(a=>Math.hypot(a.point.x-photo.point.x,a.point.z-photo.point.z)<=75&&Math.abs(a.point.y-photo.point.y)<=12);
  if(!area){area={id:photo.id,name:'',point:{...photo.point},photos:[]};areas.push(area);}
  area.photos.push(photo);
  const n=area.photos.length;area.point={x:area.photos.reduce((s,p)=>s+p.point.x,0)/n,y:area.photos.reduce((s,p)=>s+p.point.y,0)/n,z:area.photos.reduce((s,p)=>s+p.point.z,0)/n};
 }
 return areas.map((a,i)=>{const nearest=places.filter(p=>p.point).map(p=>({p,d:Math.hypot(p.point![0]-a.point.x,p.point![1]-a.point.z)})).sort((x,y)=>x.d-y.d)[0];return {...a,name:nearest&&nearest.d<160?nearest.p.name:`Campus area ${i+1}`};});
}
export function tourAreaDuration(photoCount:number,requested:number){return Math.max(requested,3+Math.max(1,photoCount)*6);}
export function tourPhotoIndex(elapsed:number,areaDuration:number,photoCount:number){return Math.min(Math.max(0,photoCount-1),Math.max(0,Math.floor((elapsed-3)/Math.max(6,(areaDuration-3)/Math.max(1,photoCount)))));}
