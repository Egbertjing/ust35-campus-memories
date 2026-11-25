import * as THREE from 'three';
import {campusSunPosition} from './campus-solar';
import {createCampusClock} from './campus-clock';
import {applyWindowLighting} from './campus-window-lights';
import {campusSkyFragment} from './campus-atmosphere';
type LightingMode='live'|'sunrise'|'day'|'sunset'|'night';
export function createCampusLighting({scene,camera,renderer,sun,hemisphere,sea,root,invalidate}:{scene:THREE.Scene;camera:THREE.Camera;renderer:THREE.WebGLRenderer;sun:THREE.DirectionalLight;hemisphere:THREE.HemisphereLight;sea:THREE.ShaderMaterial;root:THREE.Object3D;invalidate:()=>void}){
 let mode:LightingMode='live';
 let lastShadowAt=-Infinity;
 const clockFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 const cloudEpoch=performance.now();
 const reduceCloudMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const windAngle=Math.random()*Math.PI*2,windSpeed=.0015+Math.random()*.0015;
 const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color()},horizon:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3()},warm:{value:new THREE.Color('#ffe1b0')},strength:{value:0},cloudOffset:{value:new THREE.Vector2(Math.random()*200,Math.random()*200)},cloudWind:{value:new THREE.Vector2(Math.cos(windAngle)*windSpeed,Math.sin(windAngle)*windSpeed)},cloudTime:{value:0},cloudThreshold:{value:.37+Math.random()*.075},twilight:{value:0},daylight:{value:1},cloudLight:{value:new THREE.Color()},cloudShade:{value:new THREE.Color()}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:campusSkyFragment});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(38000,32,16),skyMaterial);sky.name='Time_synced_sky';sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
 const windowMaterials=new Map<THREE.MeshStandardMaterial,{color:THREE.Color;intensity:number}>();
 root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&(/window|glazing/i.test(m.name)||o.name==='Facade_windows_approximate'))windowMaterials.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});});
 const occupancy=applyWindowLighting(root,[...windowMaterials.keys()]);
 const mix=(a:string,b:string,t:number)=>new THREE.Color(a).lerp(new THREE.Color(b),t);
 function update(forceShadow=false){
  const now=new Date(),live=campusSunPosition(now);occupancy.update(reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000,now);
  const presets={sunrise:{elevation:3,azimuth:100,phase:'Sunrise'},day:{elevation:52,azimuth:165,phase:'Day'},sunset:{elevation:3,azimuth:260,phase:'Sunset'},night:{elevation:-30,azimuth:320,phase:'Night'}};
  const position=mode==='live'?live:presets[mode];
  const daylight=THREE.MathUtils.smoothstep(position.elevation,-8,10),gold=1-THREE.MathUtils.smoothstep(position.elevation,4,20);
  const horizon=mix('#14243f','#bdd5de',daylight).lerp(new THREE.Color('#c7a5a0'),gold*daylight*.30);
  const top=mix('#040c20','#5799ca',daylight).lerp(new THREE.Color('#64739a'),gold*daylight*.55);
  skyMaterial.uniforms.top.value.copy(top);skyMaterial.uniforms.horizon.value.copy(horizon);
  skyMaterial.uniforms.daylight.value=daylight;skyMaterial.uniforms.twilight.value=gold*daylight;
  skyMaterial.uniforms.cloudLight.value.copy(mix('#25354f','#e8edf1',daylight));
  skyMaterial.uniforms.cloudShade.value.copy(mix('#0a142a','#9aafc5',daylight));
  const a=position.azimuth*Math.PI/180,e=position.elevation*Math.PI/180;
  const direction=new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e));
  skyMaterial.uniforms.sunDir.value.copy(direction);skyMaterial.uniforms.strength.value=THREE.MathUtils.smoothstep(position.elevation,-3,3);
  scene.background=horizon.clone();if(scene.fog)scene.fog.color.copy(horizon);
  sun.position.copy(sun.target.position).addScaledVector(direction,1200);sun.intensity=2.5*THREE.MathUtils.smoothstep(position.elevation,-3,10);sun.color.copy(mix('#ffb277','#fff1dd',1-gold));if(forceShadow||now.getTime()-lastShadowAt>=15000||now.getTime()<lastShadowAt){sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;lastShadowAt=now.getTime();}
  hemisphere.color.copy(mix('#7c9fcf','#e6f0fa',daylight));hemisphere.groundColor.copy(mix('#26384e','#69776a',daylight));hemisphere.intensity=.55+daylight*1.25;
  sea.uniforms.uColor.value.copy(mix('#09192c','#377f96',daylight).lerp(new THREE.Color('#9a7d83'),gold*daylight*.24));sea.uniforms.uHorizon.value.copy(horizon);sea.uniforms.uSunDir.value.copy(direction);sea.uniforms.uSunColor.value.copy(sun.color);sea.uniforms.uSunStrength.value=THREE.MathUtils.smoothstep(position.elevation,-2,8);sea.uniforms.uWaterLight.value=.08+.92*daylight;
  renderer.toneMappingExposure=1.1;
  for(const [m,original] of windowMaterials){m.emissive.copy(original.color).lerp(new THREE.Color('#ffe4b8'),1-daylight);m.emissiveIntensity=original.intensity*daylight+(1-daylight)*.34;}
  const time=clockFormat.format(now);
  window.dispatchEvent(new CustomEvent('campus-lighting-status',{detail:{mode,phase:position.phase,time}}));invalidate();
 }
 const select=(event:Event)=>{const next=(event as CustomEvent).detail;if(['live','sunrise','day','sunset','night'].includes(next)){mode=next;update(true);}};
 const visible=()=>{clock.setPaused(document.hidden);if(!document.hidden)update(true);};
 window.addEventListener('campus-lighting-select',select);document.addEventListener('visibilitychange',visible);
 const clock=createCampusClock(()=>update(),undefined,document.hidden);
 return {followCamera(){occupancy.update(reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000,new Date());sky.position.copy(camera.position);skyMaterial.uniforms.cloudTime.value=reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000;},dispose(){clock.dispose();window.removeEventListener('campus-lighting-select',select);document.removeEventListener('visibilitychange',visible);scene.remove(sky);sky.geometry.dispose();skyMaterial.dispose();}};
}
