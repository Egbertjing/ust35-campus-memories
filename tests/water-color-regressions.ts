import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOceanDepthTexture} from '../lib/campus-water';
const texture=createOceanDepthTexture({xMin:0,xMax:100,zMin:0,zMax:100,rows:2,cols:2,heights:[[5,-30],[-60,-100]]});
assert.deepEqual(Array.from(texture.image.data!),[0,128,255,255]);
assert.equal(texture.colorSpace,THREE.NoColorSpace);assert.equal(texture.generateMipmaps,false);assert.equal(texture.magFilter,THREE.LinearFilter);texture.dispose();
console.log('PASS: land/deep-water depth tint, row orientation, clamping and non-color data texture');
