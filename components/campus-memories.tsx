'use client';
import {validatePhoto,validMemoryDate} from '@/lib/memory-validation';
import {MemoryAdminEdit,MemoryAdmin} from './memory-review';
import {CampusMemoryTour} from './campus-memory-tour';
import {useEffect,useState,useRef} from 'react';
import {preparePhoto,postWithPhoto} from '@/lib/photo-upload';
type Point={x:number;y:number;z:number;name?:string};
type Memory={revision?:number;id:string;point:Point;title:string;story:string;photo:string;date:string};
type Place={point?:[number,number];id:string;name:string;englishName:string;aliases:string[]};
const command=(detail:object)=>window.dispatchEvent(new CustomEvent('campus-memory-command',{detail}));
const spotName=(p:Point)=>(p.name||'').replace(/ · Custom photo spot$/,'');
const WELCOME_KEY='ust35-welcome-v1';
export function CampusMemories({ready,places}:{ready:boolean;places:Place[]}){
 const [expanded,setExpanded]=useState(false);
 const [photoQuery,setPhotoQuery]=useState('');
 const [loaded,setLoaded]=useState(false),[discardPrompt,setDiscardPrompt]=useState(false);
 const discardDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(discardPrompt)discardDialog.current?.showModal();else discardDialog.current?.close();},[discardPrompt]);
 const photoDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(expanded)photoDialog.current?.showModal();else photoDialog.current?.close();},[expanded]);
 const [items,setItems]=useState<Memory[]>([]),[mode,setMode]=useState<'browse'|'pick'|'details'|'view'>('browse'),[open,setOpen]=useState(false);
 const [point,setPoint]=useState<Point|null>(null),[selected,setSelected]=useState<Memory|null>(null),[query,setQuery]=useState('');
 const [dragging,setDragging]=useState(false);
 // Call for photos: first-visit welcome card, and ?add=1 links (posters, QR codes) that open the add flow directly.
 const welcomeDialog=useRef<HTMLDialogElement>(null),[welcome,setWelcome]=useState(false),entryHandled=useRef(false);
 useEffect(()=>{if(welcome)welcomeDialog.current?.showModal();else welcomeDialog.current?.close();},[welcome]);
 const dismissWelcome=()=>{setWelcome(false);try{localStorage.setItem(WELCOME_KEY,'1');}catch{}};
 const [title,setTitle]=useState(''),[story,setStory]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 // Date as English Year / Month / Day menus: a native date input follows the visitor's browser language (e.g. 年/月/日).
 const [dateY,setDateY]=useState(''),[dateM,setDateM]=useState(''),[dateD,setDateD]=useState('');
 const date=dateY&&dateM&&dateD?`${dateY}-${dateM}-${dateD}`:'';
 const dateIncomplete=!!(dateY||dateM||dateD)&&!date;
 const setDate=(v:string)=>{const [y='',m='',d='']=v?v.split('-'):[];setDateY(y);setDateM(m);setDateD(d);};
 const daysIn=(y:string,m:string)=>m?new Date(Number(y)||2000,Number(m),0).getDate():31;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[hint,setHint]=useState('Choose a place for your memory. Drag the locator to adjust it; drag elsewhere to rotate the view.');
 async function refresh(){const r=await fetch('/api/memories');if(!r.ok)throw Error('Could not load photos. Please retry.');setItems(await r.json());setLoaded(true);setError('');}
 useEffect(()=>{refresh().catch(e=>setError(e.message));const updated=()=>{refresh().catch(e=>setError(e.message));setMode('browse');setSelected(null);};window.addEventListener('campus-memory-refresh',updated);return()=>window.removeEventListener('campus-memory-refresh',updated);},[]);
 useEffect(()=>{if(ready)command({action:'pins',items});},[items,ready]);
 useEffect(()=>{
  if(!ready||!loaded||entryHandled.current)return;entryHandled.current=true;
  const params=new URLSearchParams(window.location.search);
  if(params.has('add')){params.delete('add');const rest=params.toString();window.history.replaceState(null,'',window.location.pathname+(rest?'?'+rest:'')+window.location.hash);try{localStorage.setItem(WELCOME_KEY,'1');}catch{}startFresh();return;}
  try{if(!localStorage.getItem(WELCOME_KEY))setWelcome(true);}catch{}
 },[ready,loaded]);
 useEffect(()=>{command({action:'mode',enabled:mode==='pick'});return()=>{command({action:'mode',enabled:false});};},[mode,ready]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{
  const chosen=(e:Event)=>{const p=(e as CustomEvent).detail;setPoint(p);setTitle(old=>old||spotName(p));setMode('pick');setOpen(false);setError('');command({action:'focus',point:p,smooth:true,edit:true});};
  const draft=(e:Event)=>{if(document.documentElement.classList.contains('review-picking'))return;const p=(e as CustomEvent).detail;setPoint(p);setTitle(t=>t||spotName(p));setHint('Location updated. Keep adjusting, or confirm when ready.');};
  const edit=()=>{if(document.documentElement.classList.contains('review-picking'))return;setMode('pick');setOpen(false);};
  const miss=()=>setHint('No model surface here. The previous position is kept; drag back onto the campus.');
  window.addEventListener('campus-memory-point',chosen);window.addEventListener('campus-memory-draft',draft);window.addEventListener('campus-memory-edit',edit);window.addEventListener('campus-memory-miss',miss);
  return()=>{window.removeEventListener('campus-memory-point',chosen);window.removeEventListener('campus-memory-draft',draft);window.removeEventListener('campus-memory-edit',edit);window.removeEventListener('campus-memory-miss',miss);};
 },[]);
 useEffect(()=>{const show=(e:Event)=>{const item=items.find(i=>i.id===(e as CustomEvent).detail);if(item){viewMemory(item);}};window.addEventListener('campus-memory-open',show);return()=>window.removeEventListener('campus-memory-open',show);},[items]);
 function viewMemory(item:Memory){setSelected(item);setMode('view');setOpen(true);command({action:'focus',point:item.point,smooth:true});}
 function stepMemory(offset:number){if(!selected||!items.length)return;const i=items.findIndex(v=>v.id===selected.id);viewMemory(items[(i+offset+items.length)%items.length]);}
 function start(){if(point||file||story||date||title){setDiscardPrompt(true);return;}startFresh();}
 const hasDraft=!!(point||file||story.trim()||date||title.trim());
 function resume(){setDiscardPrompt(false);if(!point){startFresh();return;}command({action:'restore-draft',point});setError('');setMode('details');setOpen(true);}
 // Closing the panel never strands the add button: an unsaved draft is kept and the button offers to continue it.
 function closePanel(){command({action:'clear-draft'});if(mode==='details')setMode('browse');setOpen(false);}
 useEffect(()=>{const root=document.documentElement;root.classList.toggle('memory-panel-open',open);return()=>root.classList.remove('memory-panel-open');},[open]);
 function startFresh(){setDiscardPrompt(false);setPoint(null);setTitle('');setStory('');setDate('');setFile(null);setError('');setNotice('');setMode('pick');setOpen(false);command({action:'clear-draft'});setHint('Click a place to leave a memory. Drag the locator to fine-tune it.');}
 function pickFile(f?:File|null){if(!f)return;const invalid=validatePhoto(f);if(invalid){setError(invalid);return;}setFile(f);setError('');}
 function adjust(){if(point)command({action:'restore-draft',point});setMode('pick');setOpen(false);}
 async function save(e:React.FormEvent){e.preventDefault();if(busy||!point||!file)return;if(!validMemoryDate(date)){setError('Enter a real calendar date in YYYY-MM-DD format.');return;}setError('');setBusy(true);try{
  const invalid=validatePhoto(file);if(invalid)throw Error(invalid);
  const photo=await preparePhoto(file);
  const result=await postWithPhoto('/api/memories',{point,title:title.trim(),story,date},photo) as {id:string;revision?:number};const revision=result.revision??1;setItems(old=>[{id:result.id,revision,point,title:title.trim(),story,date,photo:`/api/photos/${result.id}?v=${revision}`},...old]);setPoint(null);setFile(null);setTitle('');setStory('');setDate('');setMode('browse');setNotice('Memory saved. Select its thumbnail on the map to view it.');command({action:'clear-draft'});
 }catch(e){setError(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}}
 const visibleMemories=items.filter(item=>(item.title+' '+item.story).toLowerCase().includes(photoQuery.trim().toLowerCase()));
 const filtered=places.filter(p=>[p.name,p.englishName,...p.aliases].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <><CampusMemoryTour items={items} ready={ready&&loaded} places={places}/>
 {(mode==='browse'||mode==='view')&&<button className="memory-add-cta" disabled={!ready} onClick={()=>{dismissWelcome();if(hasDraft)resume();else startFresh();}}><span aria-hidden="true">{hasDraft?'✎':'＋'}</span>{hasDraft?'Continue your photo':'Add your photo'}</button>}
 <dialog ref={welcomeDialog} className="memory-welcome" aria-labelledby="memory-welcome-title" onCancel={dismissWelcome}>
  <small>UST35 · HKUST 1991–2026</small>
  <h2 id="memory-welcome-title">Share your HKUST memory</h2>
  <p>Help us map 35 years of campus life. Put your photo where it was taken on the 3D campus. It takes about a minute.</p>
  <ol><li><b>1</b>Tap the spot on the campus</li><li><b>2</b>Add your photo and a few words</li><li><b>3</b>Save. It appears on the map for everyone.</li></ol>
  <button className="memory-primary" autoFocus onClick={()=>{dismissWelcome();start();}}>＋ Add your photo</button>
  <button className="memory-welcome-skip" onClick={dismissWelcome}>Explore the campus first</button>
  <small className="memory-welcome-note">JPG, PNG or WebP · photos are public once saved</small>
 </dialog><button className="memory-launch" onClick={()=>{if(open)closePanel();else setOpen(true);}} aria-expanded={open}><span className="memory-launch-mark" aria-hidden="true">35</span><strong>Campus Memories</strong><small>{items.length} {items.length===1?'photo':'photos'} · add yours</small></button>
 {mode==='pick'&&<section className="memory-hint" aria-label="Adjust photo location"><strong>① Choose a location <span>② Add your photo</span></strong><p aria-live="polite">{hint}</p>{point&&<small>Selected · {spotName(point) || "Custom campus location"}</small>}<div className="memory-pick-actions"><button className="memory-confirm" disabled={!point} onClick={()=>{setMode('details');setOpen(true);}}>Confirm location</button><button onClick={()=>{setMode(point?'details':'browse');setOpen(true);}}>Back to panel</button></div></section>}
 {open&&<aside className="memory-panel"><header><small>HKUST · 1991—2026</small><button aria-label="Close memories" onClick={closePanel}>×</button><h2>Where memories belong.</h2><p>One campus. Countless memories.</p></header>{error&&<div className="memory-feedback error" role="alert">{error}{!loaded&&<button onClick={()=>refresh().catch(e=>setError(e.message))}>Retry loading photos</button>}</div>}{notice&&<p role="status">{notice}</p>}
 {mode==='details'&&point?<form className="memory-compose" onSubmit={save} aria-busy={busy}><fieldset disabled={busy}>
 <div className="compose-top"><button className="memory-back-link" type="button" onClick={()=>{command({action:'clear-draft'});setMode('browse');}}>← All memories</button><ol className="compose-steps" aria-label="Progress"><li className="done">Location</li><li className="current" aria-current="step">Photo &amp; story</li></ol></div>
 <div className="compose-place"><span aria-hidden="true">◎</span><div><small>Location</small><strong>{spotName(point)||'Custom campus spot'}</strong></div><button type="button" onClick={adjust}>Change</button></div>
 <label className={`compose-drop${dragging?' is-dragging':''}${preview?' has-photo':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);pickFile(e.dataTransfer.files?.[0]);}}>
  {preview?<img src={preview} alt="Selected photo preview"/>:<span className="compose-drop-empty"><b aria-hidden="true">＋</b><strong>Add a photo</strong><small>Click or drop an image · JPG, PNG or WebP · up to 8 MB</small></span>}
  <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose photo" onChange={e=>{pickFile(e.target.files?.[0]);e.target.value='';}}/>
  {preview&&<span className="compose-drop-change">Change photo</span>}
 </label>
 {file&&<small className="compose-file">{file.name} · {(file.size/1048576).toFixed(1)} MB · resized to max 2048px, location data removed</small>}
 <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={80} placeholder="e.g. Graduation day at the Sundial"/></label>
 <fieldset className="compose-date"><legend>Date taken <em>optional</em></legend><div>
  <select aria-label="Year" value={dateY} onChange={e=>{const y=e.target.value;setDateY(y);if(dateD&&Number(dateD)>daysIn(y,dateM))setDateD(String(daysIn(y,dateM)).padStart(2,'0'));}}><option value="">Year</option>{Array.from({length:new Date().getFullYear()-1990},(_,i)=>String(new Date().getFullYear()-i)).map(y=><option key={y} value={y}>{y}</option>)}</select>
  <select aria-label="Month" value={dateM} onChange={e=>{const m=e.target.value;setDateM(m);if(dateD&&Number(dateD)>daysIn(dateY,m))setDateD(String(daysIn(dateY,m)).padStart(2,'0'));}}><option value="">Month</option>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>)}</select>
  <select aria-label="Day" value={dateD} onChange={e=>setDateD(e.target.value)}><option value="">Day</option>{Array.from({length:daysIn(dateY,dateM)},(_,i)=>String(i+1).padStart(2,'0')).map(d=><option key={d} value={d}>{Number(d)}</option>)}</select>
  {(dateY||dateM||dateD)&&<button type="button" className="compose-date-clear" aria-label="Clear date" onClick={()=>setDate('')}>×</button>}
 </div>{dateIncomplete&&<small className="compose-date-note">Choose the year, month and day, or clear the date.</small>}</fieldset>
 <label>Your story <em>optional</em><textarea value={story} onChange={e=>setStory(e.target.value)} maxLength={2000} placeholder="Tell the story behind this moment…"/><small className="compose-count">{story.length} / 2000</small></label>
 <div className="memory-save-bar"><small>{!file?'Add a photo to continue.':!title.trim()?'Give it a title to continue.':dateIncomplete?'Finish or clear the date to continue.':'Visible to everyone once saved.'}</small><button className="memory-primary" disabled={busy||!file||!title.trim()||dateIncomplete}>{busy?'Saving…':'Save memory'}</button></div>
</fieldset></form>:mode==='view'&&selected?<article className="memory-photo-story" key={selected.id}><button className="memory-back-link" onClick={()=>setMode('browse')}>← All memories</button><button className="memory-hero-photo" aria-label="View full-size photo" onClick={()=>setExpanded(true)}><img src={selected.photo} alt={selected.title}/><span>View full size</span></button><div className="memory-photo-nav"><button onClick={()=>stepMemory(-1)} disabled={items.length<2}>Previous</button><small>{items.findIndex(i=>i.id===selected.id)+1} / {items.length}</small><button onClick={()=>stepMemory(1)} disabled={items.length<2}>Next</button></div><h3>{selected.title}</h3>{selected.date&&<small className="memory-story-date">{selected.date}</small>}<p style={{whiteSpace:'pre-wrap'}}>{selected.story}</p><button className="memory-show-location" onClick={()=>command({action:'focus',point:selected.point,smooth:true})}>◎ Show on the map</button><button className="memory-primary memory-view-add" disabled={!ready} onClick={start}>＋ Add your photo</button><MemoryAdminEdit memory={selected}/></article>:<><button className="memory-primary" disabled={!ready} onClick={start}>＋ Add your photo</button>{point&&<button className="memory-adjust" onClick={()=>setMode('details')}>Continue your draft</button>}<details className="memory-location-picker"><summary>Or choose from a list of places</summary><input className="memory-search" aria-label="Search photo locations" placeholder="Search plazas, halls, the library…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="memory-places">{filtered.map(p=><button key={p.id} onClick={()=>{setNotice('');command({action:'place',id:p.id});}}><span>{p.name}</span><small>Choose location</small></button>)}{!filtered.length&&<p>No matching places. You can also choose a point on the map.</p>}</div></details><h3 style={{marginTop:24}}>Memories · {items.length}</h3><input className="memory-gallery-search" aria-label="Search memories" placeholder="Search photos and stories…" value={photoQuery} onChange={e=>setPhotoQuery(e.target.value)}/><div className="memory-list">{visibleMemories.map(item=><button key={item.id} onClick={()=>{viewMemory(item);}}><img src={item.photo} alt="" loading="lazy"/><span><strong>{item.title}</strong>{item.date&&<small>{item.date}</small>}</span></button>)}{loaded&&items.length>0&&!visibleMemories.length&&<p>No matching memories. Try a different search.</p>}{!loaded?<p role="status">Loading memories…</p>:!items.length&&<p>Be the first to share a campus memory.</p>}</div></>}
 <footer>Concept model · Photos stored on the server<MemoryAdmin/></footer></aside>}<dialog ref={photoDialog} className="memory-lightbox" onCancel={()=>setExpanded(false)} onClick={e=>{if(e.target===e.currentTarget)setExpanded(false);}} aria-label="Campus photo viewer">{selected&&<div><button className="lightbox-close" autoFocus aria-label="Close photo" onClick={()=>setExpanded(false)}>×</button><img src={selected.photo} alt={selected.title}/><h3>{selected.title}</h3><p>{selected.story}</p></div>}</dialog><dialog ref={discardDialog} className="memory-review-dialog" aria-label="Start a new memory" onCancel={()=>setDiscardPrompt(false)}><h2>Keep your current draft?</h2><p>Starting a new memory clears the photo, text and location you have not saved yet.</p><button onClick={resume}>Keep editing</button><button onClick={startFresh}>Discard draft and start new</button></dialog></>;
}
