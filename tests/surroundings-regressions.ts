import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildCampus} from '../lib/campus-model';
import {createCampusSurroundings,sampleRegionalHeight} from '../lib/campus-surroundings';
const read=(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const regional=read('surroundings'),campus=buildCampus(read('campus'),read('terrain'));
assert.equal(regional.metadata.gridSpacingMeters,100);
assert.ok(sampleRegionalHeight(regional,4000,0)<1,'Port Shelter must remain sea');
assert.ok(sampleRegionalHeight(regional,-14500,-8300)>600,'Tai Mo Shan context must retain high relief');
assert.ok(sampleRegionalHeight(regional,8000,-4000)>0,'Eastern island context must retain land');
const surrounding=createCampusSurroundings(regional,campus);
const source=(campus.root.getObjectByName('Terrain_Mapzen_DEM_approximate_terraces') as THREE.Mesh).geometry.getAttribute('position');
const edgeSet=new Set<string>();for(let i=0;i<source.count;i++){const x=source.getX(i),z=source.getZ(i);if(x===surrounding.core.xMin||x===surrounding.core.xMax||z===surrounding.core.zMin||z===surrounding.core.zMax)edgeSet.add([x,source.getY(i),z].join(','));}
const seam=(surrounding.group.getObjectByName('Campus_to_region_transition') as THREE.Mesh).geometry.getAttribute('position');
for(let i=0;i<edgeSet.size;i++)assert.ok(edgeSet.has([seam.getX(i),seam.getY(i),seam.getZ(i)].join(',')),'Seam must exactly match existing campus edge vertices');
const mesh=surrounding.group.getObjectByName('Regional_DEM_100m') as THREE.Mesh;const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index!;
for(let i=0;i<index.count;i+=3){const x=(p.getX(index.getX(i))+p.getX(index.getX(i+1))+p.getX(index.getX(i+2)))/3,z=(p.getZ(index.getX(i))+p.getZ(index.getX(i+1))+p.getZ(index.getX(i+2)))/3;assert.ok(!(x>surrounding.outer.xMin&&x<surrounding.outer.xMax&&z>surrounding.outer.zMin&&z<surrounding.outer.zMax),'Regional mesh must not cover campus interior');}
for(const o of surrounding.group.children){const g=(o as THREE.Mesh).geometry;assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));}
for(const [x,z] of [[-192.9,-280.8],[275,-278],[8,-278]])assert.equal(surrounding.heightAt(x,z),campus.heightAt(x,z),'Campus surface semantics must remain unchanged');
console.log('PASS: regional sea/land anchors, exact',edgeSet.size,'campus-edge joins, no interior overlap, finite geometry and unchanged campus sampling; triangles',index.count/3);
