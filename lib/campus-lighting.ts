import * as THREE from 'three';
import {campusSunPosition} from './campus-solar';
import {createCampusClock} from './campus-clock';
import {applyWindowLighting} from './campus-window-lights';
import {campusSkyFragment} from './campus-atmosphere';
import {WEATHER_LABELS,WEATHER_VISUALS,WEATHER_TTL_MS,cachedWeather,fetchLiveWeather,rainStrength,type WeatherKind,type WeatherMode,type WeatherReport} from './campus-weather';
// Falling rain: line streaks in a box that follows the camera; animated entirely in the shader.
const rainVertex=`attribute vec3 seed;attribute float tip;uniform float uTime;uniform float uSpeed;uniform float uLength;uniform vec2 uWind;uniform vec3 uBox;varying float vTip;
void main(){vec3 p=seed*uBox-uBox*.5;p.y=mod(seed.y*uBox.y-uTime*uSpeed,uBox.y)-uBox.y*.5;p.xz+=uWind*(p.y/uSpeed);vec3 dir=normalize(vec3(uWind.x,-uSpeed,uWind.y));p-=dir*uLength*tip;vTip=tip;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const rainFragment=`uniform vec3 uColor;uniform float uOpacity;varying float vTip;void main(){gl_FragColor=vec4(uColor,uOpacity*(1.-vTip*.75));}`;
const RAIN_DROPS=7000;
type LightingMode='live'|'sunrise'|'day'|'sunset'|'night';
export function createCampusLighting({scene,camera,renderer,sun,hemisphere,sea,root,invalidate,onAmbientFps}:{scene:THREE.Scene;camera:THREE.Camera;renderer:THREE.WebGLRenderer;sun:THREE.DirectionalLight;hemisphere:THREE.HemisphereLight;sea:THREE.ShaderMaterial;root:THREE.Object3D;invalidate:()=>void;onAmbientFps?:(fps:number)=>void}){
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
 // Line materials (campus boundary, roof outlines) are unlit, so dim them with daylight or they glow at night.
 const lineMaterials=new Map<THREE.LineBasicMaterial,{color:THREE.Color;opacity:number}>();
 root.traverse(o=>{if(!(o instanceof THREE.Line))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.LineBasicMaterial&&!lineMaterials.has(m)){lineMaterials.set(m,{color:m.color.clone(),opacity:m.opacity});m.transparent=true;}});
 const mix=(a:string,b:string,t:number)=>new THREE.Color(a).lerp(new THREE.Color(b),t);
 // ── Weather ──
 const baseThreshold=skyMaterial.uniforms.cloudThreshold.value as number;
 const fog=scene.fog instanceof THREE.Fog?scene.fog:null,fogNear=fog?.near??6000,fogFar=fog?.far??16000;
 let weatherMode:WeatherMode='live';let liveReport:WeatherReport|null=cachedWeather(WEATHER_TTL_MS*8);let liveState:'loading'|'ok'|'unavailable'=liveReport?'ok':'loading';
 let flash=0,nextFlash=performance.now()+4000;
 const rainSeeds=new Float32Array(RAIN_DROPS*2*3),rainTips=new Float32Array(RAIN_DROPS*2);
 for(let i=0;i<RAIN_DROPS;i++){const x=Math.random(),y=Math.random(),z=Math.random();rainSeeds.set([x,y,z,x,y,z],i*6);rainTips[i*2]=0;rainTips[i*2+1]=1;}
 const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RAIN_DROPS*2*3),3));rainGeometry.setAttribute('seed',new THREE.BufferAttribute(rainSeeds,3));rainGeometry.setAttribute('tip',new THREE.BufferAttribute(rainTips,1));
 const rainMaterial=new THREE.ShaderMaterial({vertexShader:rainVertex,fragmentShader:rainFragment,transparent:true,depthWrite:false,fog:false,uniforms:{uTime:{value:0},uSpeed:{value:70},uLength:{value:13},uWind:{value:new THREE.Vector2()},uBox:{value:new THREE.Vector3(240,200,240)},uColor:{value:new THREE.Color('#c8d6df')},uOpacity:{value:0}}});
 const rain=new THREE.LineSegments(rainGeometry,rainMaterial);rain.name='Weather_rain';rain.frustumCulled=false;rain.visible=false;rain.renderOrder=5;scene.add(rain);
 const activeKind=():WeatherKind=>weatherMode!=='live'?weatherMode:(liveReport?.kind??'clear');
 const weatherVisual=()=>{const kind=activeKind(),v=WEATHER_VISUALS[kind];if(weatherMode==='live'&&liveState==='unavailable'&&!liveReport)return {...WEATHER_VISUALS.clear,kind};return {...v,rain:weatherMode==='live'?rainStrength(kind,liveReport?.precipitation):v.rain,kind};};
 const ambientFps=()=>{const w=weatherVisual();return reduceCloudMotion?0:(w.rain>0||w.lightning?30:2);};
 let reportedFps=-1;const syncFps=()=>{const fps=ambientFps();if(fps!==reportedFps){reportedFps=fps;onAmbientFps?.(fps);}};
 const weatherAbort=new AbortController();
 const refreshWeather=()=>{fetchLiveWeather(weatherAbort.signal).then(r=>{liveReport=r;liveState='ok';update();}).catch(()=>{if(weatherAbort.signal.aborted)return;liveState=liveReport?'ok':'unavailable';update();});};
 const weatherTimer=window.setInterval(()=>{if(!document.hidden)refreshWeather();},WEATHER_TTL_MS);
 let baseHemisphere=hemisphere.intensity;
 function update(forceShadow=false){
  const now=new Date(),live=campusSunPosition(now);occupancy.update(reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000,now);
  const presets={sunrise:{elevation:3,azimuth:100,phase:'Sunrise'},day:{elevation:52,azimuth:165,phase:'Day'},sunset:{elevation:3,azimuth:260,phase:'Sunset'},night:{elevation:-30,azimuth:320,phase:'Night'}};
  const position=mode==='live'?live:presets[mode];
  const daylight=THREE.MathUtils.smoothstep(position.elevation,-8,10),gold=1-THREE.MathUtils.smoothstep(position.elevation,4,20);
  const horizon=mix('#14243f','#bdd5de',daylight).lerp(new THREE.Color('#c7a5a0'),gold*daylight*.30);
  const top=mix('#040c20','#5799ca',daylight).lerp(new THREE.Color('#64739a'),gold*daylight*.55);
  const w=weatherVisual(),g=w.gloom;
  top.lerp(mix('#0b1220','#7d8b97',daylight),g*.85);horizon.lerp(mix('#121a26','#a7b2ba',daylight),g*.8);
  skyMaterial.uniforms.cloudThreshold.value=THREE.MathUtils.lerp(.64,.06,w.cloud)+(baseThreshold-.41)*.3;
  skyMaterial.uniforms.top.value.copy(top);skyMaterial.uniforms.horizon.value.copy(horizon);
  skyMaterial.uniforms.daylight.value=daylight;skyMaterial.uniforms.twilight.value=gold*daylight;
  skyMaterial.uniforms.cloudLight.value.copy(mix('#25354f','#e8edf1',daylight)).lerp(mix('#1b2431','#b4bec6',daylight),g);
  skyMaterial.uniforms.cloudShade.value.copy(mix('#0a142a','#9aafc5',daylight)).lerp(mix('#070c15','#6c7a86',daylight),g);
  const a=position.azimuth*Math.PI/180,e=position.elevation*Math.PI/180;
  const direction=new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e));
  skyMaterial.uniforms.sunDir.value.copy(direction);skyMaterial.uniforms.strength.value=THREE.MathUtils.smoothstep(position.elevation,-3,3)*(1-g);
  scene.background=horizon.clone();if(scene.fog)scene.fog.color.copy(horizon);if(fog){fog.near=fogNear*Math.pow(90/fogNear,w.fog);fog.far=fogFar*Math.pow(1700/fogFar,w.fog);}
  sun.position.copy(sun.target.position).addScaledVector(direction,1200);sun.intensity=2.5*THREE.MathUtils.smoothstep(position.elevation,-3,10)*(1-.88*g);sun.color.copy(mix('#ffb277','#fff1dd',1-gold));if(forceShadow||now.getTime()-lastShadowAt>=15000||now.getTime()<lastShadowAt){sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;lastShadowAt=now.getTime();}
  hemisphere.color.copy(mix('#7c9fcf','#e6f0fa',daylight)).lerp(mix('#55667a','#b9c3cb',daylight),g);hemisphere.groundColor.copy(mix('#26384e','#69776a',daylight));hemisphere.intensity=(.55+daylight*1.25)*(1-.32*g);baseHemisphere=hemisphere.intensity;
  sea.uniforms.uColor.value.copy(mix('#09192c','#377f96',daylight).lerp(new THREE.Color('#9a7d83'),gold*daylight*.24)).lerp(mix('#0a1520','#4d646e',daylight),g*.7);sea.uniforms.uHorizon.value.copy(horizon);sea.uniforms.uSunDir.value.copy(direction);sea.uniforms.uSunColor.value.copy(sun.color);sea.uniforms.uSunStrength.value=THREE.MathUtils.smoothstep(position.elevation,-2,8)*(1-g);sea.uniforms.uWaterLight.value=.08+.92*daylight;
  renderer.toneMappingExposure=1.1;
  for(const [m,original] of lineMaterials){m.color.copy(original.color).multiplyScalar(.22+.78*daylight);m.opacity=original.opacity*(.35+.65*daylight);}
  for(const [m,original] of windowMaterials){m.emissive.copy(original.color).lerp(new THREE.Color('#ffe4b8'),1-daylight);m.emissiveIntensity=original.intensity*daylight+(1-daylight)*.34;}
  rain.visible=w.rain>0;rainMaterial.uniforms.uOpacity.value=(.3+.4*w.rain)*(.6+.4*daylight);rainMaterial.uniforms.uColor.value.copy(mix('#7d90a3','#cfdbe3',daylight));
  rainGeometry.setDrawRange(0,Math.round(RAIN_DROPS*Math.max(.15,w.rain))*2);
  const windDir=((liveReport?.windDirection??200)+180)*Math.PI/180,windSpeed=Math.min(40,weatherMode==='live'?(liveReport?.windSpeed??12):w.kind==='storm'?30:12)/3.6;
  rainMaterial.uniforms.uWind.value.set(Math.sin(windDir)*windSpeed*1.6,-Math.cos(windDir)*windSpeed*1.6);
  syncFps();
  const time=clockFormat.format(now);
  const weather={mode:weatherMode,kind:w.kind,label:WEATHER_LABELS[w.kind],temperature:weatherMode==='live'?liveReport?.temperature:undefined,source:weatherMode!=='live'?'preview':liveState,observed:liveReport?.observed};
  window.dispatchEvent(new CustomEvent('campus-lighting-status',{detail:{mode,phase:position.phase,time,weather}}));invalidate();
 }
 const selectWeather=(event:Event)=>{const next=(event as CustomEvent).detail;if(next==='live'||next in WEATHER_VISUALS){weatherMode=next;update(true);}};
 const select=(event:Event)=>{const next=(event as CustomEvent).detail;if(['live','sunrise','day','sunset','night'].includes(next)){mode=next;update(true);}};
 const visible=()=>{clock.setPaused(document.hidden);if(!document.hidden)update(true);};
 window.addEventListener('campus-lighting-select',select);window.addEventListener('campus-weather-select',selectWeather);document.addEventListener('visibilitychange',visible);
 const clock=createCampusClock(()=>update(),undefined,document.hidden);
 refreshWeather();
 return {ambientFps,followCamera(){const w=weatherVisual(),t=performance.now();if(rain.visible){rain.position.copy(camera.position);rainMaterial.uniforms.uTime.value=reduceCloudMotion?0:t/1000;}
  // Lightning: brief, soft and infrequent (never with reduced motion).
  if(w.lightning&&!reduceCloudMotion&&!document.hidden){if(t>nextFlash){flash=1;nextFlash=t+6000+Math.random()*10000;}}
  if(flash>0){flash=Math.max(0,flash-.08);hemisphere.intensity=baseHemisphere+flash*1.6;if(flash===0)hemisphere.intensity=baseHemisphere;}
 occupancy.update(reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000,new Date());sky.position.copy(camera.position);skyMaterial.uniforms.cloudTime.value=reduceCloudMotion?0:(performance.now()-cloudEpoch)/1000;},dispose(){clock.dispose();weatherAbort.abort();window.clearInterval(weatherTimer);window.removeEventListener('campus-weather-select',selectWeather);scene.remove(rain);rainGeometry.dispose();rainMaterial.dispose();window.removeEventListener('campus-lighting-select',select);document.removeEventListener('visibilitychange',visible);scene.remove(sky);sky.geometry.dispose();skyMaterial.dispose();}};
}
