import assert from 'node:assert/strict';
import {groupMemoryAreas,tourAreaDuration,tourPhotoIndex} from '../lib/memory-tour-areas';
const photo=(id:string,x:number,y=10)=>({id,title:id,story:'',date:'',photo:'image',point:{x,y,z:0}});
const source=[photo('a',0),photo('b',20),photo('far',300),photo('upper',0,40)];
const areas=groupMemoryAreas(source,[{name:'Sundial Piazza',point:[0,0]}]);assert.equal(areas.length,3);assert.equal(areas[0].photos.length,2);assert.equal(areas[0].name,'Sundial Piazza');assert.equal(areas[0].point.x,10);
source[0].point.x=1000;assert.equal(areas[0].photos[0].point.x,0);
assert.equal(tourAreaDuration(3,15),21);assert.equal(tourPhotoIndex(3,15,2),0);assert.equal(tourPhotoIndex(9,15,2),1);assert.equal(tourPhotoIndex(15,15,2),1);assert.equal(tourPhotoIndex(0,15,1),0);
console.log('PASS: proximity areas, floor separation, stable snapshots, readable photo durations and automatic photo progression');
