import * as THREE from 'three';
import {clipSubmergedTerrain} from './terrain-water-clip';
export type RegionalTerrain={xMin:number;xMax:number;zMin:number;zMax:number;rows:number;cols:number;heights:number[][]};
export function sampleRegionalHeight(data:RegionalTerrain,x:number,z:number){
 const u=THREE.MathUtils.clamp((x-data.xMin)/(data.xMax-data.xMin)*(data.cols-1),0,data.cols-1.000001);
 const v=THREE.MathUtils.clamp((z-data.zMin)/(data.zMax-data.zMin)*(data.rows-1),0,data.rows-1.000001);
 const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(data.heights[j][i],data.heights[j][i+1],a),THREE.MathUtils.lerp(data.heights[j+1][i],data.heights[j+1][i+1],a),b);
}
/** Real regional DEM outside an exact campus cutout, joined to the existing edge vertices. */
export function createCampusSurroundings(data:RegionalTerrain,campus:{root:THREE.Group;heightAt:(x:number,z:number)=>number}){
 const terrain=campus.root.getObjectByName('Terrain_Mapzen_DEM_approximate_terraces') as THREE.Mesh;
 const innerGeometry=terrain.geometry as THREE.PlaneGeometry;
 const source=innerGeometry.getAttribute('position');
 const cols=innerGeometry.parameters.widthSegments,rows=innerGeometry.parameters.heightSegments,stride=cols+1;
 const core={xMin:source.getX(0),xMax:source.getX(cols),zMin:source.getZ(0),zMax:source.getZ(rows*stride)};
 const outer={xMin:core.xMin-400,xMax:core.xMax+400,zMin:core.zMin-400,zMax:core.zMax+400};
 const xs=[...new Set([...Array.from({length:data.cols},(_,i)=>THREE.MathUtils.lerp(data.xMin,data.xMax,i/(data.cols-1))),outer.xMin,outer.xMax])].sort((a,b)=>a-b);
 const zs=[...new Set([...Array.from({length:data.rows},(_,i)=>THREE.MathUtils.lerp(data.zMin,data.zMax,i/(data.rows-1))),outer.zMin,outer.zMax])].sort((a,b)=>a-b);
 const pos:number[]=[],colors:number[]=[],indices:number[]=[],heights:number[]=[];
 const lawn=new THREE.Color('#849b7c'),forest=new THREE.Color('#3d5e45'),ridge=new THREE.Color('#61715f'),shore=new THREE.Color('#aaa990');
 const tint=(x:number,z:number,h:number)=>{
  const variation=.5+.18*Math.sin(x*.0018)*Math.cos(z*.0023)+.12*Math.sin(x*.006+z*.003);
  const c=forest.clone().lerp(ridge,THREE.MathUtils.clamp((h-250)/650,0,.6)).multiplyScalar(.9+variation*.15);
  if(h<12)c.lerp(shore,(1-THREE.MathUtils.smoothstep(h,1,12))*.45);
  return c;
 };
 for(const z of zs)for(const x of xs){const raw=sampleRegionalHeight(data,x,z),h=raw>2.5?raw:-2;heights.push(h);pos.push(x,h,z);const c=tint(x,z,h);colors.push(c.r,c.g,c.b);}
 const nx=xs.length;
 for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
  if(x>outer.xMin&&x<outer.xMax&&z>outer.zMin&&z<outer.zMax)continue;
  const a=j*nx+i,b=a+1,c=a+nx,d=c+1;indices.push(a,c,b,b,c,d);
 }
 const lower=(list:number[],value:number)=>{let lo=0,hi=list.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(list[mid]<=value)lo=mid;else hi=mid;}return Math.min(lo,list.length-2);};
 const renderedHeight=(x:number,z:number)=>{const i=lower(xs,x),j=lower(zs,z),u=THREE.MathUtils.clamp((x-xs[i])/(xs[i+1]-xs[i]),0,1),v=THREE.MathUtils.clamp((z-zs[j])/(zs[j+1]-zs[j]),0,1);const a=heights[j*nx+i],b=heights[j*nx+i+1],c=heights[(j+1)*nx+i],d=heights[(j+1)*nx+i+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);};
 const make=(p:number[],c:number[],idx:number[],name:string)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();const material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vRegionalWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vRegionalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 vRegionalWorld;\nfloat regionalHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat regionalNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(regionalHash(i),regionalHash(i+vec2(1.,0.)),f.x),mix(regionalHash(i+vec2(0.,1.)),regionalHash(i+vec2(1.,1.)),f.x),f.y);}\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float span=max(length(dFdx(vRegionalWorld.xz)),length(dFdy(vRegionalWorld.xz)));float detail=1.-smoothstep(3.,22.,span);diffuseColor.rgb*=mix(1.,.90+.13*regionalNoise(vRegionalWorld.xz*.065),detail);');
 };material.customProgramCacheKey=()=> 'regional-terrain-grain-v1';
 clipSubmergedTerrain(material);
 const m=new THREE.Mesh(g,material);m.name=name;m.receiveShadow=true;return m;};
 const group=new THREE.Group();group.name='Regional_terrain_context';group.userData.decorative=true;
 group.add(make(pos,colors,indices,'Regional_DEM_100m'));
 const boundary:number[]=[];
 for(let x=0;x<cols;x++)boundary.push(x);
 for(let z=0;z<rows;z++)boundary.push(z*stride+cols);
 for(let x=cols;x>0;x--)boundary.push(rows*stride+x);
 for(let z=rows;z>0;z--)boundary.push(z*stride);
 const seamPos:number[]=[],seamColors:number[]=[],seamIndices:number[]=[],layers=[0,.20,.5,1],cx=(core.xMin+core.xMax)/2,cz=(core.zMin+core.zMax)/2;
 for(const t of layers)for(const n of boundary){
  const ix=source.getX(n),iz=source.getZ(n),iy=source.getY(n);
  const ox=cx+(ix-cx)*(outer.xMax-outer.xMin)/(core.xMax-core.xMin),oz=cz+(iz-cz)*(outer.zMax-outer.zMin)/(core.zMax-core.zMin);
  const x=THREE.MathUtils.lerp(ix,ox,t),z=THREE.MathUtils.lerp(iz,oz,t),blend=THREE.MathUtils.smoothstep(t,0,1),y=THREE.MathUtils.lerp(iy,renderedHeight(x,z),blend);
  seamPos.push(x,y,z);const c=lawn.clone().lerp(tint(x,z,y),blend);seamColors.push(c.r,c.g,c.b);
 }
 const count=boundary.length;
 for(let layer=0;layer<layers.length-1;layer++)for(let i=0;i<count;i++){const a=layer*count+i,b=layer*count+(i+1)%count,c=a+count,d=b+count;seamIndices.push(a,b,c,b,d,c);}
 const seamMesh=make(seamPos,seamColors,seamIndices,'Campus_to_region_transition');group.add(seamMesh);seamMesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,6000);
 const heightAt=(x:number,z:number)=>{
  if(x>=core.xMin&&x<=core.xMax&&z>=core.zMin&&z<=core.zMax)return campus.heightAt(x,z);
  if(x>=outer.xMin&&x<=outer.xMax&&z>=outer.zMin&&z<=outer.zMax){ray.ray.origin.set(x,2500,z);const hit=ray.intersectObject(seamMesh,false)[0];if(hit)return hit.point.y;}
  return renderedHeight(x,z);
 };
 // Illustrative slope vegetation softens the old rectangular tree cutoff; not a surveyed land-cover layer.
 const sourceLeaves=campus.root.getObjectByName('Tree_canopies') as THREE.InstancedMesh;
 const sourceTrunks=campus.root.getObjectByName('Tree_trunks') as THREE.InstancedMesh;
 const treePoints:THREE.Vector3[]=[];let randomState=9137;
 const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 for(let i=0;i<14000&&treePoints.length<2200;i++){
  const x=THREE.MathUtils.lerp(core.xMin-1400,core.xMax+1400,random()),z=THREE.MathUtils.lerp(core.zMin-1400,core.zMax+1400,random());
  const d=Math.max(core.xMin-x,x-core.xMax,core.zMin-z,z-core.zMax);
  if(d<=0||d>500||random()>(.80-.60*THREE.MathUtils.smoothstep(d,250,1400)))continue;
  const h=heightAt(x,z);if(h<45)continue;
  const slope=Math.hypot(renderedHeight(x+20,z)-renderedHeight(x-20,z),renderedHeight(x,z+20)-renderedHeight(x,z-20))/40;
  if(slope>.9)continue;treePoints.push(new THREE.Vector3(x,h,z));
 }
 if(sourceLeaves&&sourceTrunks&&treePoints.length){
  const contextCrown=new THREE.IcosahedronGeometry(1,1);contextCrown.scale(1,.82,1);
  const leaves=new THREE.InstancedMesh(contextCrown,sourceLeaves.material,treePoints.length),trunks=new THREE.InstancedMesh(sourceTrunks.geometry,sourceTrunks.material,treePoints.length),dummy=new THREE.Object3D();
  treePoints.forEach((p,i)=>{const scale=2.7+random()*3;dummy.position.copy(p).add(new THREE.Vector3(0,scale*.76+2.4,0));dummy.rotation.set(random()*.3,random()*6,random()*.2);dummy.scale.set(scale*1.08,scale,scale*.94);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new THREE.Color().setHSL(.245+random()*.045,.20+random()*.13,.25+random()*.11));dummy.position.copy(p).add(new THREE.Vector3(0,2,0));dummy.rotation.set(0,0,0);dummy.scale.set(1,4,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});
  leaves.name='Illustrative_surrounding_slope_trees';trunks.name='Illustrative_surrounding_tree_trunks';leaves.receiveShadow=true;leaves.computeBoundingSphere();trunks.computeBoundingSphere();group.add(leaves,trunks);
 }
 return {group,core,outer,heightAt};
}
