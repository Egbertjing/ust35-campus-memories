import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildCampus} from '../lib/campus-model';
import {createCampusSurroundings} from '../lib/campus-surroundings';
const read=(n:string)=>JSON.parse(readFileSync(`public/data/${n}.json`,'utf8'));
const campus=buildCampus(read('campus'),read('terrain'));
const context=createCampusSurroundings(read('surroundings'),campus);
for(const [root,name] of [[campus.root,'Terrain_Mapzen_DEM_approximate_terraces'],[context.group,'Regional_DEM_100m'],[context.group,'Campus_to_region_transition']] as const){
 const mesh=root.getObjectByName(name) as THREE.Mesh;const material=mesh.material as THREE.MeshStandardMaterial;
 assert.equal(material.userData.dryLandOnly,true,name);
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n#include <map_fragment>\n#include <color_fragment>',uniforms:{}} as any;
 material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 assert.ok(shader.vertexShader.includes('vDryTerrainHeight=(modelMatrix*vec4(transformed,1.)).y'));
 assert.ok(shader.fragmentShader.includes('if(vDryTerrainHeight < 0.02) discard;'));
 assert.ok(shader.fragmentShader.includes(name.startsWith('Terrain_')?'uLawnTint':'regionalNoise'),'Previous material hooks must remain intact');
 assert.ok(material.customProgramCacheKey().endsWith('-dry-terrain-v1'));
}
console.log('PASS: campus floor, regional seabed and join band discard submerged fragments; existing material effects retained.');
