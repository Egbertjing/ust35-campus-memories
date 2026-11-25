type ClockDriver={now:()=>number;setTimer:(fn:()=>void,delay:number)=>number;clearTimer:(id:number)=>void};
/** Tick on second boundaries; no polling while the page is hidden. */
export function createCampusClock(tick:()=>void,driver:ClockDriver={now:()=>Date.now(),setTimer:(fn,delay)=>window.setTimeout(fn,delay),clearTimer:id=>window.clearTimeout(id)},initiallyPaused=false){
 let paused=initiallyPaused,disposed=false,timer:number|null=null;
 const clear=()=>{if(timer!==null)driver.clearTimer(timer);timer=null;};
 const schedule=()=>{if(paused||disposed)return;timer=driver.setTimer(()=>{timer=null;if(paused||disposed)return;tick();schedule();},1000-((driver.now()%1000+1000)%1000)+10);};
 tick();schedule();
 return {setPaused(value:boolean){if(disposed||paused===value)return;paused=value;clear();if(!paused){tick();schedule();}},dispose(){disposed=true;clear();}};
}
