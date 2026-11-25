'use client';
import {useEffect,useState} from 'react';
export function CampusLightingControl({ready}:{ready:boolean}){
 const [mode,setMode]=useState('live'),[status,setStatus]=useState({time:'',phase:'Live'});
 useEffect(()=>{const update=(e:Event)=>{const d=(e as CustomEvent).detail;setStatus({time:d.time,phase:d.phase});setMode(d.mode);};window.addEventListener('campus-lighting-status',update);return()=>window.removeEventListener('campus-lighting-status',update);},[]);
 const live=mode==='live';
 return <div className={`campus-lighting-control${live?' is-live':''}`}>
  <span className="campus-live-clock" aria-label="Hong Kong scene time"><i aria-hidden="true"/><b>{status.time||'--:--:--'}</b><span>{live?`HKT · ${status.phase}`:'Preview'}</span></span>
  <select title="Choose Live to synchronize lighting with Hong Kong time" disabled={!ready} aria-label="Campus lighting" value={mode} onChange={e=>{setMode(e.target.value);window.dispatchEvent(new CustomEvent('campus-lighting-select',{detail:e.target.value}));}}><option value="live">Live</option><option value="sunrise">Sunrise</option><option value="day">Day</option><option value="sunset">Sunset</option><option value="night">Night</option></select>
 </div>;
}
