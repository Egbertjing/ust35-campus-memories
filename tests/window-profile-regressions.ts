import assert from 'node:assert/strict';
import {buildingLightProfile} from '../lib/campus-window-lights';
const profiles=Array.from({length:100},(_,i)=>buildingLightProfile(`building-${i}`));
assert.deepEqual(buildingLightProfile('hall-1'),buildingLightProfile('hall-1'));
assert.ok(profiles.every(p=>p.density>=.17&&p.density<=.82&&Number.isFinite(p.seed)));
assert.ok(Math.max(...profiles.map(p=>p.density))-Math.min(...profiles.map(p=>p.density))>.5);
console.log('PASS: stable building identity, bounded light density and substantial building-to-building variation');
