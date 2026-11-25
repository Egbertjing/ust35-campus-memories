import * as THREE from 'three';
import type {RegionalTerrain} from './campus-surroundings';
/** Coarse DEM-derived depth tint only, not navigational bathymetry. */
export function createOceanDepthTexture(data:RegionalTerrain){
 const pixels=new Uint8Array(data.cols*data.rows);
 for(let y=0;y<data.rows;y++)for(let x=0;x<data.cols;x++)pixels[y*data.cols+x]=Math.round(THREE.MathUtils.clamp(-data.heights[y][x]/60,0,1)*255);
 const texture=new THREE.DataTexture(pixels,data.cols,data.rows,THREE.RedFormat,THREE.UnsignedByteType);
 texture.colorSpace=THREE.NoColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
