import * as THREE from 'three';
export function buildingLightProfile(id:string){
 let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 return {seed:seed%65521,density:.17+(seed%1000)/999*.65};
}
/** Stable room occupancy with building-specific density; six percent of cells change slowly. */
export function applyWindowLighting(root:THREE.Object3D,materials:THREE.MeshStandardMaterial[]){
 const set=new Set(materials),time={value:0},nightSeed={value:0};
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  if(!(Array.isArray(object.material)?object.material:[object.material]).some(m=>set.has(m as THREE.MeshStandardMaterial)))return;
  let parent:THREE.Object3D|null=object;while(parent&&!parent.userData.osmId)parent=parent.parent;
  const id=String(parent?.userData.osmId||object.userData.osmId||object.parent?.name||object.name||'campus');
  if(object instanceof THREE.InstancedMesh){
   const ids=object.userData.windowBuildingIds as string[]|undefined;
   const values=new Float32Array(object.count*3);
   for(let i=0;i<object.count;i++){const profile=buildingLightProfile(ids?.[i]??id);values.set([profile.density,profile.seed,i],i*3);}
   object.geometry.setAttribute('aNightWindow',new THREE.InstancedBufferAttribute(values,3));
  }else{
   const profile=buildingLightProfile(id),count=object.geometry.getAttribute('position').count,values=new Float32Array(count*3);
   for(let i=0;i<count;i++)values.set([profile.density,profile.seed,-1],i*3);
   object.geometry.setAttribute('aNightWindow',new THREE.BufferAttribute(values,3));
  }
 });
 for(const material of materials){
  const before=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
   before.call(material,shader,renderer);shader.uniforms.uWindowTime=time;shader.uniforms.uNightSeed=nightSeed;
   shader.vertexShader='attribute vec3 aNightWindow; varying vec3 vNightWindow; varying vec3 vWindowWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vNightWindow=aNightWindow;
    vec4 windowWorld=vec4(transformed,1.);
    #ifdef USE_INSTANCING
      windowWorld=instanceMatrix*windowWorld;
    #endif
    vWindowWorld=(modelMatrix*windowWorld).xyz;`);
   shader.fragmentShader='varying vec3 vNightWindow; varying vec3 vWindowWorld; uniform float uWindowTime; uniform float uNightSeed;\nfloat windowHash(float n){return fract(sin(n*1.173+4.71)*43758.5453);}\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float roomId=vNightWindow.z;
    if(roomId<0.){vec3 cell=floor(vWindowWorld/vec3(2.8,3.4,2.8));roomId=cell.x*17.13+cell.y*97.47+cell.z*41.71;}
    float key=roomId+vNightWindow.y*.31+uNightSeed*.17;
    float occupancy=step(windowHash(key),vNightWindow.x);
    float occasional=step(.94,windowHash(key+731.));
    float slowChange=smoothstep(-.12,.12,sin(uWindowTime/65.+windowHash(key+31.)*6.283));
    occupancy=mix(occupancy,slowChange,occasional);
    float roof= smoothstep(.55,.82,abs(normalize(cross(dFdx(vWindowWorld),dFdy(vWindowWorld))).y));
    occupancy=mix(occupancy,vNightWindow.x*.45,roof);
    vec3 warmth=mix(vec3(1.,.64,.32),vec3(.87,.94,1.),windowHash(key+83.)*.60);
    warmth=mix(warmth,vec3(1.,.82,.55),roof);
    totalEmissiveRadiance*=occupancy*warmth*mix(.65+.35*windowHash(key+29.),.85,roof);`);
  };
  material.customProgramCacheKey=()=> 'ust35-window-occupancy-v1';material.needsUpdate=true;
 }
 return {update(seconds:number,date:Date){time.value=seconds;nightSeed.value=Math.floor((date.getTime()-4*3600000)/86400000)%4096;}};
}
