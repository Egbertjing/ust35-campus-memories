'use client';
import {validatePhoto,validMemoryDate} from '@/lib/memory-validation';
import {asset} from '@/lib/base-path';
import {CampusMemoryTour} from './campus-memory-tour';
import {useEffect,useState,useRef} from 'react';
type Point={x:number;y:number;z:number;name?:string};
type Memory={revision?:number;id:string;point:Point;title:string;story:string;photo:string;date:string};
type Place={point?:[number,number];id:string;name:string;englishName:string;aliases:string[]};
const command=(detail:object)=>window.dispatchEvent(new CustomEvent('campus-memory-command',{detail}));
// This static copy cannot accept uploads; "Add your photo" opens the upload site's add flow.
const UPLOAD_URL=(import.meta.env.VITE_UPLOAD_URL as string|undefined)??'http://49.235.77.195:8089/';
const ADD_PHOTO_URL=UPLOAD_URL+'?add=1';
const WELCOME_KEY='ust35-welcome-v1';
export function CampusMemories({ready,places}:{ready:boolean;places:Place[]}){
 const [expanded,setExpanded]=useState(false);
 const welcomeDialog=useRef<HTMLDialogElement>(null),[welcome,setWelcome]=useState(false);
 useEffect(()=>{if(welcome)welcomeDialog.current?.showModal();else welcomeDialog.current?.close();},[welcome]);
 useEffect(()=>{if(!ready)return;try{if(!localStorage.getItem(WELCOME_KEY))setWelcome(true);}catch{}},[ready]);
 const dismissWelcome=()=>{setWelcome(false);try{localStorage.setItem(WELCOME_KEY,'1');}catch{}};
 const [photoQuery,setPhotoQuery]=useState('');
 const [loaded,setLoaded]=useState(false),[discardPrompt,setDiscardPrompt]=useState(false);
 const discardDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(discardPrompt)discardDialog.current?.showModal();else discardDialog.current?.close();},[discardPrompt]);
 const photoDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(expanded)photoDialog.current?.showModal();else photoDialog.current?.close();},[expanded]);
 const [items,setItems]=useState<Memory[]>([]),[mode,setMode]=useState<'browse'|'pick'|'details'|'view'>('browse'),[open,setOpen]=useState(false);
 const [point,setPoint]=useState<Point|null>(null),[selected,setSelected]=useState<Memory|null>(null),[query,setQuery]=useState('');
 const [title,setTitle]=useState(''),[story,setStory]=useState(''),[date,setDate]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[hint,setHint]=useState('Choose a place for your memory. Drag the locator to adjust it; drag elsewhere to rotate the view.');
 async function refresh(){const r=await fetch(asset('/data/memories.json'),{cache:'no-cache'});if(!r.ok)throw Error('Could not load photos. Please retry.');const list=await r.json() as Memory[];setItems(list.map(m=>({...m,photo:/^(data:|https?:)/.test(m.photo)?m.photo:asset(m.photo)})));setLoaded(true);setError('');}
 useEffect(()=>{refresh().catch(e=>setError(e.message));const updated=()=>{refresh().catch(e=>setError(e.message));setMode('browse');setSelected(null);};window.addEventListener('campus-memory-refresh',updated);return()=>window.removeEventListener('campus-memory-refresh',updated);},[]);
 useEffect(()=>{if(ready)command({action:'pins',items});},[items,ready]);
 useEffect(()=>{command({action:'mode',enabled:mode==='pick'});return()=>{command({action:'mode',enabled:false});};},[mode,ready]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{
  const chosen=(e:Event)=>{const p=(e as CustomEvent).detail;setPoint(p);setTitle(old=>old||p.name||'');setMode('pick');setOpen(false);setError('');command({action:'focus',point:p,smooth:true,edit:true});};
  const draft=(e:Event)=>{if(document.documentElement.classList.contains('review-picking'))return;const p=(e as CustomEvent).detail;setPoint(p);setTitle(t=>t||p.name||'');setHint('Location updated. Keep adjusting, or confirm when ready.');};
  const edit=()=>{if(document.documentElement.classList.contains('review-picking'))return;setMode('pick');setOpen(false);};
  const miss=()=>setHint('No model surface here. The previous position is kept; drag back onto the campus.');
  window.addEventListener('campus-memory-point',chosen);window.addEventListener('campus-memory-draft',draft);window.addEventListener('campus-memory-edit',edit);window.addEventListener('campus-memory-miss',miss);
  return()=>{window.removeEventListener('campus-memory-point',chosen);window.removeEventListener('campus-memory-draft',draft);window.removeEventListener('campus-memory-edit',edit);window.removeEventListener('campus-memory-miss',miss);};
 },[]);
 useEffect(()=>{const show=(e:Event)=>{const item=items.find(i=>i.id===(e as CustomEvent).detail);if(item){viewMemory(item);}};window.addEventListener('campus-memory-open',show);return()=>window.removeEventListener('campus-memory-open',show);},[items]);
 function viewMemory(item:Memory){setSelected(item);setMode('view');setOpen(true);command({action:'focus',point:item.point,smooth:true});}
 function stepMemory(offset:number){if(!selected||!items.length)return;const i=items.findIndex(v=>v.id===selected.id);viewMemory(items[(i+offset+items.length)%items.length]);}
 function start(){if(point||file||story||date||title){setDiscardPrompt(true);return;}startFresh();}
 function startFresh(){setDiscardPrompt(false);setPoint(null);setTitle('');setStory('');setDate('');setFile(null);setError('');setNotice('');setMode('pick');setOpen(false);command({action:'clear-draft'});setHint('Click a place to leave a memory. Drag the locator to fine-tune it.');}
 function adjust(){if(point)command({action:'restore-draft',point});setMode('pick');setOpen(false);}
 async function save(e:React.FormEvent){e.preventDefault();if(busy||!point||!file)return;if(!validMemoryDate(date)){setError('Enter a real calendar date in YYYY-MM-DD format.');return;}setError('');setBusy(true);try{
  const invalid=validatePhoto(file);if(invalid)throw Error(invalid);
  const photo=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result as string);r.onerror=()=>reject(Error('Could not read the image'));r.readAsDataURL(file);});
  const r=await fetch('/api/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({point,title:title.trim(),story,date,photo})});if(!r.ok){const failure=await r.json().catch(()=>null) as {error?:string}|null;throw Error(failure?.error||'Upload failed. Your draft is kept; please retry.');}
  const result=await r.json() as {id:string};setItems(old=>[{id:result.id,point,title,story,date,photo},...old]);setPoint(null);setFile(null);setTitle('');setStory('');setDate('');setMode('browse');setNotice('Memory saved. Select its thumbnail on the map to view it.');command({action:'clear-draft'});
 }catch(e){setError(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}}
 const visibleMemories=items.filter(item=>(item.title+' '+item.story).toLowerCase().includes(photoQuery.trim().toLowerCase()));
 const filtered=places.filter(p=>[p.name,p.englishName,...p.aliases].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <><CampusMemoryTour items={items} ready={ready&&loaded} places={places}/>
 {(mode==='browse'||mode==='view')&&<a className="memory-add-cta" href={ADD_PHOTO_URL} onClick={dismissWelcome}><span aria-hidden="true">＋</span>Add your photo</a>}
 <dialog ref={welcomeDialog} className="memory-welcome" aria-labelledby="memory-welcome-title" onCancel={dismissWelcome}>
  <small>UST35 · HKUST 1991–2026</small>
  <h2 id="memory-welcome-title">Share your HKUST memory</h2>
  <p>Help us map 35 years of campus life. Put your photo where it was taken on the 3D campus. It takes about a minute.</p>
  <ol><li><b>1</b>Tap the spot on the campus</li><li><b>2</b>Add your photo and a few words</li><li><b>3</b>Save. It appears on the map for everyone.</li></ol>
  <a className="memory-primary memory-welcome-go" href={ADD_PHOTO_URL} onClick={dismissWelcome} autoFocus>＋ Add your photo</a>
  <button className="memory-welcome-skip" onClick={dismissWelcome}>Explore the campus first</button>
  <small className="memory-welcome-note">Opens the UST35 upload site · JPG, PNG or WebP · photos are public once saved</small>
 </dialog><button className="memory-launch" onClick={()=>{if(open)command({action:'clear-draft'});setOpen(!open);}} aria-expanded={open}><span className="memory-launch-mark" aria-hidden="true">35</span><strong>Campus Memories</strong><small>{items.length} {items.length===1?'photo':'photos'} · browse</small></button>
 {mode==='pick'&&<section className="memory-hint" aria-label="Adjust photo location"><strong>① Choose a location <span>② Add your photo</span></strong><p aria-live="polite">{hint}</p>{point&&<small>Selected · {point.name || "Custom campus location"}</small>}<div className="memory-pick-actions"><button className="memory-confirm" disabled={!point} onClick={()=>{setMode('details');setOpen(true);}}>Confirm location</button><button onClick={()=>{setMode(point?'details':'browse');setOpen(true);}}>Back to panel</button></div></section>}
 {open&&<aside className="memory-panel"><header><small>HKUST · 1991—2026</small><button aria-label="Close memories" onClick={()=>{command({action:'clear-draft'});setOpen(false);}}>×</button><h2>Where memories belong.</h2><p>One campus. Countless memories.</p></header>{error&&<div className="memory-feedback error" role="alert">{error}{!loaded&&<button onClick={()=>refresh().catch(e=>setError(e.message))}>Retry loading photos</button>}</div>}{notice&&<p role="status">{notice}</p>}
 {mode==='details'&&point?<form onSubmit={save} aria-busy={busy}><fieldset disabled={busy}><button className="memory-back-link" type="button" onClick={()=>{command({action:'clear-draft'});setMode('browse');}}>All memories (keep draft)</button><div className="memory-step">① Location selected  ② Add a photo</div><h3>{point.name||'Custom photo spot'}</h3><button className="memory-adjust" type="button" onClick={adjust}>Adjust location (keep your draft)</button><label>Photo spot name<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={80} placeholder="Give this photo spot a name"/></label><label>Date taken<input type="text" placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Your story<textarea value={story} onChange={e=>setStory(e.target.value)} maxLength={2000} placeholder="Tell the story behind this moment…"/></label><label className="memory-upload">Choose photo · JPG / PNG / WebP, up to 8 MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f){const invalid=validatePhoto(f);if(invalid){setFile(null);e.target.value='';setError(invalid);return;}setFile(f);setError('');}}}/></label>{preview&&<img className="memory-preview" src={preview} alt="Photo preview"/>}{file&&<small>{file.name}</small>}<div className="memory-save-bar"><small>{file?'Your photo stays private until you save.':'Choose a photo to continue.'}</small><button className="memory-primary" disabled={busy||!file||!title.trim()}>{busy?'Saving…':'Save this memory'}</button></div></fieldset></form>:mode==='view'&&selected?<article className="memory-photo-story" key={selected.id}><button className="memory-back-link" onClick={()=>setMode('browse')}>← All memories</button><button className="memory-hero-photo" aria-label="View full-size photo" onClick={()=>setExpanded(true)}><img src={selected.photo} alt={selected.title}/><span>View full size</span></button><div className="memory-photo-nav"><button onClick={()=>stepMemory(-1)} disabled={items.length<2}>Previous</button><small>{items.findIndex(i=>i.id===selected.id)+1} / {items.length}</small><button onClick={()=>stepMemory(1)} disabled={items.length<2}>Next</button></div><h3>{selected.title}</h3>{selected.date&&<small className="memory-story-date">{selected.date}</small>}<p style={{whiteSpace:'pre-wrap'}}>{selected.story}</p><button className="memory-show-location" onClick={()=>command({action:'focus',point:selected.point,smooth:true})}>◎ Show on the map</button></article>:<><h3 style={{marginTop:4}}>Memories · {items.length}</h3><input className="memory-gallery-search" aria-label="Search memories" placeholder="Search photos and stories…" value={photoQuery} onChange={e=>setPhotoQuery(e.target.value)}/><div className="memory-list">{visibleMemories.map(item=><button key={item.id} onClick={()=>{viewMemory(item);}}><img src={item.photo} alt="" loading="lazy"/><span><strong>{item.title}</strong>{item.date&&<small>{item.date}</small>}</span></button>)}{loaded&&items.length>0&&!visibleMemories.length&&<p>No matching memories. Try a different search.</p>}{!loaded?<p role="status">Loading memories…</p>:!items.length&&<p>Be the first to share a campus memory.</p>}</div></>}
 <footer>Concept model · Read-only showcase</footer></aside>}<dialog ref={photoDialog} className="memory-lightbox" onCancel={()=>setExpanded(false)} onClick={e=>{if(e.target===e.currentTarget)setExpanded(false);}} aria-label="Campus photo viewer">{selected&&<div><button className="lightbox-close" autoFocus aria-label="Close photo" onClick={()=>setExpanded(false)}>×</button><img src={selected.photo} alt={selected.title}/><h3>{selected.title}</h3><p>{selected.story}</p></div>}</dialog><dialog ref={discardDialog} className="memory-review-dialog" aria-label="Start a new memory" onCancel={()=>setDiscardPrompt(false)}><h2>Keep your current draft?</h2><p>Starting a new memory clears the photo, text and location you have not saved yet.</p><button onClick={()=>setDiscardPrompt(false)}>Keep editing</button><button onClick={startFresh}>Discard draft and start new</button></dialog></>;
}
