import * as THREE from 'three';
import {detailBuilder} from './photo-architecture';
import type {CampusData} from './campus-model';
/** Small, static scene props on mapped motor roads, not live or surveyed traffic. */
export function createCampusVehicles(data:CampusData,heightAt:(x:number,z:number)=>number,allowed:(x:number,z:number)=>boolean){
 const group=new THREE.Group();group.name='Illustrative_campus_vehicles';group.userData.decorative=true;
 const draw=detailBuilder(group);
 const bodyColors=['#d8dedc','#36556d','#a9b8bb'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.52,metalness:.16}));
 const busPaint=new THREE.MeshStandardMaterial({color:'#23626c',roughness:.5,metalness:.18});
 const glass=new THREE.MeshStandardMaterial({color:'#254052',roughness:.28,metalness:.3});
 const rubber=new THREE.MeshStandardMaterial({color:'#20282b',roughness:.92});
 const lights=new THREE.MeshStandardMaterial({color:'#f4e5be',emissive:'#f4e5be',emissiveIntensity:.16});
 const stops:THREE.Vector3[]=[];
 for(const road of data.roads){
  if(!['secondary','tertiary','residential','service','unclassified'].includes(road.tags.highway??'')||road.tags.indoor||road.tags.bridge==='yes')continue;
  for(let i=1;i<road.points.length&&stops.length<8;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(length<28)continue;
   const x=(a[0]+b[0])/2+dz/length*1.25,z=(a[1]+b[1])/2-dx/length*1.25;
   if(!allowed(x,z)||stops.some(p=>Math.hypot(x-p.x,z-p.z)<65))continue;
   const h=heightAt(x,z);if(Math.abs(heightAt(x+dx/length*4,z+dz/length*4)-heightAt(x-dx/length*4,z-dz/length*4))>.75)continue;
   const yaw=Math.atan2(dx,dz),ground=h+.48,bus=stops.length===0||stops.length===5,width=bus?2.35:1.75,vehicleLength=bus?7.2:4.1,paint=bus?busPaint:bodyColors[stops.length%3];
   const place=(lx:number,lz:number)=>[x+lx*Math.cos(yaw)+lz*Math.sin(yaw),z-lx*Math.sin(yaw)+lz*Math.cos(yaw)];
   const box=(w:number,hh:number,d:number,lx:number,yy:number,lz:number,mat:THREE.Material)=>{const p=place(lx,lz);draw.box(w,hh,d,p[0],ground+yy,p[1],mat,yaw);};
   box(width,bus?1.65:.58,vehicleLength,0,bus?1.16:.70,0,paint);
   box(width*.9,bus?.68:.55,vehicleLength*(bus?.86:.53),0,bus?1.75:1.23,0,glass);
   box(width*.94,.11,vehicleLength*(bus?.91:.58),0,bus?2.15:1.57,0,paint);
   for(const side of [-1,1])for(const end of [-1,1]){
    const p=place(side*width*.49,end*vehicleLength*.32);const wheel=new THREE.CylinderGeometry(bus?.39:.30,bus?.39:.30,.21,10);wheel.rotateZ(Math.PI/2);draw.add(wheel,rubber,p[0],ground+(bus?.39:.30),p[1],yaw);
   }
   for(const side of [-1,1])box(.28,.15,.05,side*width*.32,bus?.85:.71,vehicleLength/2+.03,lights);
   stops.push(new THREE.Vector3(x,h,z));
  }
 }
 draw.finish();group.userData.vehicleCount=stops.length;group.userData.vehicleLocations=stops.map(p=>p.toArray());return group;
}
