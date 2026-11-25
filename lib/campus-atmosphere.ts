/** Lightweight procedural atmosphere and water: visual approximation, not weather data. */
export const campusSkyFragment = `
varying vec3 vDir;
uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 warm;
uniform vec3 cloudLight; uniform vec3 cloudShade;
uniform float strength; uniform float twilight; uniform float daylight;
uniform vec2 cloudOffset; uniform vec2 cloudWind; uniform float cloudTime; uniform float cloudThreshold;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.52;for(int i=0;i<4;i++){f+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(9.7,4.3);a*=.49;}return f;}
void main(){
 vec3 d=normalize(vDir);
 float h=pow(max(0.,d.y),.48);
 vec3 c=mix(horizon,top,h);
 float facing=max(0.,dot(d,sunDir));
 float horizonBand=exp(-max(d.y,0.)*9.);
 // Warm scattering is directional; the entire horizon no longer turns orange.
 c=mix(c,vec3(.72,.22,.065),clamp(pow(facing,5.)*horizonBand*twilight*1.45,0.,.8));
 vec2 p=d.xz/max(.12,d.y+.10)*1.35;
 p+=cloudOffset+cloudWind*cloudTime;
 p+=.20*vec2(sin(p.y*.6),cos(p.x*.7));
 float density=fbm(p+vec2(4.1,7.8));
 float cover=smoothstep(cloudThreshold,cloudThreshold+.24,density)*smoothstep(.003,.065,d.y);
 float sculpt=clamp(.55+(fbm(p+sunDir.xz*.22)-density)*3.2,0.,1.);
 vec3 cloud=mix(cloudShade,cloudLight,sculpt);
 cloud+=warm*twilight*pow(facing,5.)*.15;
 c=mix(c,cloud,cover*.88);
 // Approximate the apparent solar disk, with a soft scattering halo.
 float disk=smoothstep(.999982,.999991,facing);
 float halo=pow(facing,96.)*.07;
 vec3 sunTint=mix(warm,vec3(1.,.35,.09),twilight);
 c+=sunTint*(disk*1.8+halo)*strength*(1.-cover*.93);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const campusWaterFragment = `
varying vec3 vWorld;
uniform float uTime; uniform vec3 uColor; uniform vec3 uHorizon;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunStrength; uniform float uWaterLight;
uniform sampler2D uDepthMap; uniform vec4 uDepthBounds;
float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),mix(waterHash(i+vec2(0.,1.)),waterHash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
 vec2 p=vWorld.xz;
 float span=max(length(dFdx(p)),length(dFdy(p)));
 float detail=1.-smoothstep(.7,4.,span);
 vec2 drift=vec2(uTime*.025,uTime*.011);
 float nx=waterNoise(p*.48+drift)-.5;
 float nz=waterNoise(p*.48+drift+vec2(19.7,7.1))-.5;
 float a=dot(p,vec2(.035,.027))+uTime*.13;
 float b=dot(p,vec2(-.052,.041))+uTime*.18;
 vec3 n=normalize(vec3(.010*cos(a)+.006*cos(b)+nx*.065*detail,1.,.008*cos(a)-.005*cos(b)+nz*.065*detail));
 vec3 v=normalize(cameraPosition-vWorld);
 float facing=clamp(dot(n,v),0.,1.);
 float fresnel=.02+.98*pow(1.-facing,5.);
 vec2 uv=(p-uDepthBounds.xy)/uDepthBounds.zw;
 float depth=60.;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))depth=texture2D(uDepthMap,uv).r*60.;
 vec3 shallow=mix(uColor,vec3(.065,.24,.22)*uWaterLight,.42);
 vec3 deep=uColor*.78;
 vec3 body=mix(shallow,deep,smoothstep(2.,28.,depth));
 vec3 reflected=reflect(-v,n);
 float cloud=waterNoise(reflected.xz/max(.15,reflected.y)*.8+vec2(uTime*.0006));
 vec3 sky=mix(uHorizon,vec3(.78,.84,.86),cloud*.09*uWaterLight);
 vec3 c=mix(body,sky,.05+fresnel*.86);
 c+=vec3((nx+nz)*.0025*detail*uWaterLight);
 float alignment=max(0.,dot(reflect(-uSunDir,n),v));
 float glint=pow(alignment,70.)*.18+pow(alignment,280.)*.10*detail;
 c+=uSunColor*glint*uSunStrength;
 float haze=smoothstep(2000.,14000.,length(p-cameraPosition.xz));
 c=mix(c,uHorizon,haze*.78);
 gl_FragColor=vec4(max(c,vec3(0.)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
