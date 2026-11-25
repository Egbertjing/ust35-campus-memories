import assert from 'node:assert/strict';
import {campusSunPosition} from '../lib/campus-solar';
const noon=campusSunPosition(new Date('2026-11-24T04:00:00Z'));
const night=campusSunPosition(new Date('2026-11-23T16:00:00Z'));
assert.equal(noon.phase,'Day');assert.ok(noon.elevation>40&&noon.elevation<60);
assert.equal(night.phase,'Night');assert.ok(night.elevation<-50);
assert.equal(campusSunPosition(new Date('2026-11-23T22:50:00Z')).phase,'Sunrise');
assert.equal(campusSunPosition(new Date('2026-11-24T10:00:00Z')).phase,'Sunset');
assert.deepEqual(noon,campusSunPosition(new Date('2026-11-24T12:00:00+08:00')));
assert.ok(campusSunPosition(new Date('2026-06-21T04:00:00Z')).elevation>noon.elevation);
for(const time of ['2024-02-29T12:00:00Z','2026-12-31T23:59:00Z','2027-01-01T00:01:00Z']){
 const sun=campusSunPosition(new Date(time));assert.ok(Number.isFinite(sun.elevation)&&sun.azimuth>=0&&sun.azimuth<360);
}
console.log('PASS: HK day/night/sunrise/sunset, UTC timezone equivalence, seasonal altitude, leap-day and year boundaries',noon,night);
