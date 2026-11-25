'use client';
import {useEffect,useRef,useState,useMemo} from 'react';
import {groupMemoryAreas,tourAreaDuration,tourPhotoIndex,type TourPhoto,type TourPlace,type TourArea} from '@/lib/memory-tour-areas';
const send=(detail:object)=>window.dispatchEvent(new CustomEvent('campus-memory-command',{detail}));
export function CampusMemoryTour({items,ready,places=[]}:{items:TourPhoto[];ready:boolean;places?:TourPlace[]}){
 const [active,setActive]=useState(false),[paused,setPaused]=useState(false),[index,setIndex]=useState(0),[elapsed,setElapsed]=useState(0),[finished,setFinished]=useState(false),[duration,setDuration]=useState(15);
 const [areas,setAreas]=useState<TourArea[]>([]),[run,setRun]=useState(0);
 const remaining=useRef(15),area=areas[index],seconds=tourAreaDuration(area?.photos.length??1,duration);
 const photo=area?.photos[tourPhotoIndex(elapsed,seconds,area.photos.length)];
 useEffect(()=>{document.documentElement.classList.toggle('memory-touring',active);send({action:'touring',enabled:active});return()=>{document.documentElement.classList.remove('memory-touring');send({action:'touring',enabled:false});};},[active]);
 useEffect(()=>{if(!active||!area)return;setElapsed(0);remaining.current=seconds;send({action:'focus',point:area.point,smooth:true,tour:true});},[active,index,area?.id,seconds,run]);
 useEffect(()=>{
  if(!active||paused||finished||!area)return;
  const started=Date.now(),budget=remaining.current;
  const timer=setInterval(()=>{const left=Math.max(0,budget-(Date.now()-started)/1000);remaining.current=left;setElapsed(seconds-left);if(left<=0){clearInterval(timer);if(index+1<areas.length)setIndex(i=>i+1);else{setFinished(true);send({action:'pause-motion'});}}},100);
  return()=>{clearInterval(timer);remaining.current=Math.max(0,budget-(Date.now()-started)/1000);};
 },[active,paused,finished,index,areas.length,seconds,area?.id,run]);
 function togglePause(){if(!paused)send({action:'pause-motion'});else if(area&&elapsed<3)setRun(v=>v+1);setPaused(!paused);}
 useEffect(()=>{
  if(!active)return;
  const hidden=()=>{if(document.hidden){setPaused(true);send({action:'pause-motion'});}};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setActive(false);if(e.code==='Space'&&!(e.target instanceof Element&&e.target.closest('button,input,textarea,select,[contenteditable=true]'))){e.preventDefault();togglePause();}};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',key);
  return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',key);};
 },[active,area,paused,elapsed<3]);
 function start(){setAreas(groupMemoryAreas(items,places));setRun(v=>v+1);setIndex(0);setPaused(false);setFinished(false);setElapsed(0);setActive(true);}
 function move(n:number){setFinished(false);setPaused(false);setRun(v=>v+1);setIndex(n);}
 const count=useMemo(()=>groupMemoryAreas(items,places).length,[items,places]);
 return <>{!active&&<button className="memory-tour-launch" disabled={!ready||!items.length} onClick={start}><span aria-hidden="true">▶</span><strong>Memory Tour</strong><small>{count} {count===1?'area':'areas'} · auto-play</small></button>}
 {active&&area&&photo&&<section className="memory-tour" aria-label="UST35 guided memory tour"><header><div><small>HKUST · 35 YEARS OF MEMORIES</small><h2>{area.name}</h2><p className="tour-area-status">Area {index+1} of {areas.length} · {area.photos.length} {area.photos.length===1?'memory':'memories'}</p></div><button onClick={()=>setActive(false)} aria-label="Exit tour">Exit tour ×</button></header>
 {elapsed<3&&!finished?<div className="tour-arrival" role="status">{paused?'Paused on the way to':'Flying to'} {area.name}…</div>:<article key={photo.id} className="memory-tour-story"><img src={photo.photo} alt={photo.title}/><div><small>{finished?'Tour complete':paused?'Paused':'Playing automatically'} · Photo {area.photos.indexOf(photo)+1} / {area.photos.length}</small><h3>{photo.title}</h3><p>{photo.story||'A moment to remember.'}</p>{photo.date&&<time>{photo.date}</time>}</div></article>}
 <footer><div className="tour-track"><span style={{width:`${Math.min(100,elapsed/seconds*100)}%`}}/></div><div className="tour-controls"><button disabled={index===0} onClick={()=>move(index-1)}>Previous area</button>{finished?<button className="tour-play" onClick={start}>Play again</button>:<button className="tour-play" onClick={togglePause}>{paused?'Resume':'Pause'}</button>}<button disabled={index===areas.length-1} onClick={()=>move(index+1)}>Next area</button><label>Per area<select aria-label="Minimum time per area" value={duration} onChange={e=>{setDuration(Number(e.target.value));setPaused(false);setFinished(false);setRun(v=>v+1);}}><option value={15}>15 sec</option><option value={25}>25 sec</option><option value={40}>40 sec</option></select></label></div><small className="tour-auto-note">Photos and areas advance automatically.</small></footer></section>}</>;
}
