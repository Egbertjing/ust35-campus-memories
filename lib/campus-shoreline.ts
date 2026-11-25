import * as THREE from 'three';
/** A subtle waterline follows the existing mapped coastline, without changing land coordinates. */
export function createCampusShoreline(coasts: [number,number][][], time: {value:number}) {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(const coast of coasts){
    let distance=0;const start=positions.length/3;
    for(let i=0;i<coast.length;i++){
      const p=coast[i],a=coast[Math.max(0,i-1)],b=coast[Math.min(coast.length-1,i+1)];
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
      if(i)distance+=Math.hypot(p[0]-coast[i-1][0],p[1]-coast[i-1][1]);
      for(const side of [-1,1]){positions.push(p[0]+dz/length*3.5*side,0.06,p[1]-dx/length*3.5*side);uv.push((side+1)/2,distance/30);}
      if(i){const n=start+i*2;indices.push(n-2,n-1,n,n,n-1,n+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:THREE.DoubleSide,uniforms:{uTime:time},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uTime;void main(){float fade=1.-smoothstep(.10,1.,abs(vUv.x*2.-1.));float swell=.85+.15*sin(vUv.y*6.283-uTime*.28);gl_FragColor=vec4(.66,.85,.82,fade*swell*.20);}'});
  const shoreline=new THREE.Mesh(geometry,material);shoreline.name='Mapped_coast_waterline';return shoreline;
}
