import * as THREE from 'three';
/** The ocean is opaque: discard submerged terrain before it can compete for depth. */
export function clipSubmergedTerrain(material:THREE.MeshStandardMaterial){
 const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying float vDryTerrainHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vDryTerrainHeight=(modelMatrix*vec4(transformed,1.)).y;');
  shader.fragmentShader='varying float vDryTerrainHeight;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(vDryTerrainHeight < 0.02) discard;');
 };
 material.customProgramCacheKey=()=>cacheKey.call(material)+'-dry-terrain-v1';
 material.userData.dryLandOnly=true;
}
