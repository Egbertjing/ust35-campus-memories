'use client';
import {useEffect,useState} from 'react';
import {Cloud,CloudDrizzle,CloudFog,CloudLightning,CloudMoon,CloudOff,CloudRain,CloudSun,Moon,Sun} from 'lucide-react';

type Weather={mode:string;kind:string;label:string;temperature?:number;source:'ok'|'loading'|'unavailable'|'preview';observed?:string};
const ICONS:Record<string,typeof Sun>={partly:CloudSun,cloudy:Cloud,fog:CloudFog,drizzle:CloudDrizzle,rain:CloudRain,storm:CloudLightning};

export function CampusLightingControl({ready}:{ready:boolean}){
 const [mode,setMode]=useState('live'),[status,setStatus]=useState({time:'',phase:'Live'});
 const [weather,setWeather]=useState<Weather|null>(null),[weatherMode,setWeatherMode]=useState('live');
 useEffect(()=>{const update=(e:Event)=>{const d=(e as CustomEvent).detail;setStatus({time:d.time,phase:d.phase});setMode(d.mode);if(d.weather){setWeather(d.weather);setWeatherMode(d.weather.mode);}};window.addEventListener('campus-lighting-status',update);return()=>window.removeEventListener('campus-lighting-status',update);},[]);
 const live=mode==='live';
 const night=status.phase==='Night';
 const Icon=!weather||weather.source==='unavailable'?CloudOff:weather.kind==='clear'?(night?Moon:Sun):weather.kind==='partly'&&night?CloudMoon:ICONS[weather.kind]??Cloud;
 const weatherText=!weather||weather.source==='loading'?'Loading…':weather.source==='unavailable'?'Weather unavailable':weather.label;
 const weatherTitle=!weather?'':weather.source==='preview'?`Previewing ${weather.label.toLowerCase()} weather`:weather.source==='unavailable'?'Live weather could not be loaded; showing a clear sky.':`Live weather near HKUST${weather.observed?` · observed ${weather.observed.replace('T',' ')} HKT`:''} · data: Open-Meteo.com`;
 return <div className={`campus-lighting-control${live?' is-live':''}`}>
  <span className="campus-live-clock" aria-label="Hong Kong scene time"><i aria-hidden="true"/><b>{status.time||'--:--:--'}</b><span>{live?`HKT · ${status.phase}`:'Preview'}</span></span>
  <span className={`campus-weather-badge${weather?.source==='preview'?' is-preview':''}`} title={weatherTitle} aria-live="polite"><Icon size={15} aria-hidden="true"/>{typeof weather?.temperature==='number'&&<b>{Math.round(weather.temperature)}°</b>}<span>{weatherText}</span></span>
  <select title="Choose Live to synchronize lighting with Hong Kong time" disabled={!ready} aria-label="Campus lighting" value={mode} onChange={e=>{setMode(e.target.value);window.dispatchEvent(new CustomEvent('campus-lighting-select',{detail:e.target.value}));}}><option value="live">Live</option><option value="sunrise">Sunrise</option><option value="day">Day</option><option value="sunset">Sunset</option><option value="night">Night</option></select>
  <select className="campus-weather-select" title="Choose Live weather to follow current conditions near HKUST" disabled={!ready} aria-label="Weather" value={weatherMode} onChange={e=>{setWeatherMode(e.target.value);window.dispatchEvent(new CustomEvent('campus-weather-select',{detail:e.target.value}));}}><option value="live">Live weather</option><option value="clear">Clear</option><option value="partly">Partly cloudy</option><option value="cloudy">Overcast</option><option value="fog">Fog</option><option value="drizzle">Drizzle</option><option value="rain">Rain</option><option value="storm">Thunderstorm</option></select>
 </div>;
}
