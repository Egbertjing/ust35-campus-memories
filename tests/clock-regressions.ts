import assert from 'node:assert/strict';
import {createCampusClock} from '../lib/campus-clock';
let now=1250,id=0,ticks:number[]=[];const jobs=new Map<number,{at:number;fn:()=>void}>();
const clock=createCampusClock(()=>ticks.push(now),{now:()=>now,setTimer:(fn,delay)=>{jobs.set(++id,{at:now+delay,fn});return id;},clearTimer:n=>{jobs.delete(n);}});
function advance(to:number){for(;;){const next=[...jobs.entries()].filter(([,v])=>v.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=to;}
assert.deepEqual(ticks,[1250]);advance(4000);assert.deepEqual(ticks,[1250,2010,3010]);
clock.setPaused(true);assert.equal(jobs.size,0);advance(7000);assert.equal(ticks.length,3);
clock.setPaused(false);assert.equal(ticks.at(-1),7000);advance(8100);assert.equal(ticks.at(-1),8010);
clock.dispose();assert.equal(jobs.size,0);advance(20000);assert.equal(ticks.length,5);
console.log('PASS: second-aligned updates, no hidden-page polling, immediate foreground refresh and disposal');
