import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCampus} from '../lib/campus-model';
const campus=buildCampus(JSON.parse(readFileSync('public/data/campus.json','utf8')),JSON.parse(readFileSync('public/data/terrain.json','utf8')));
const props=campus.root.getObjectByName('Illustrative_campus_vehicles');assert.ok(props);assert.ok(props.userData.vehicleCount>0&&props.userData.vehicleCount<=8);assert.equal(props.userData.decorative,true);
const windows=campus.root.getObjectByName('Facade_windows_approximate') as any;
assert.equal(windows.userData.windowBuildingIds.length,windows.count);
console.log('PASS: vehicle placement count and non-pickable props; all',windows.count,'instanced windows retain building identities; vehicles:',props.userData.vehicleCount);
