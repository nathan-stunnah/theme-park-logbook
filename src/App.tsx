import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

type Kind = 'Coaster' | 'Flat Ride' | 'Dark Ride' | 'Water Ride' | 'Scare Maze' | 'Scare Zone' | 'Other'
type Park = { id:string; name:string; location:string }
type Attraction = { id:string; parkId:string; name:string; kind:Kind; detail?:string; length:number; speed:number; inversions:number }
type RideLog = { id:string; attractionId:string; name:string; kind:Kind; time:string; length:number; speed:number; inversions:number }
type Visit = { id:string; parkId:string; parkName:string; checkedInAt:string; checkedOutAt?:string; rides:RideLog[] }
type Store = { parks:Park[]; attractions:Attraction[]; visits:Visit[] }
const KEY='park-logbook-fresh-v1'
const kinds:Kind[]=['Coaster','Flat Ride','Dark Ride','Water Ride','Scare Maze','Scare Zone','Other']
const icons:Record<Kind,string>={Coaster:'🎢','Flat Ride':'🎠','Dark Ride':'👻','Water Ride':'🌊','Scare Maze':'🎃','Scare Zone':'🧟',Other:'✨'}
const uid=()=>crypto.randomUUID()
const ALTON_SEED_KEY='park-logbook-alton-screenshots-seeded-v1'
const ALTON_ADDITIONS_KEY='park-logbook-alton-more-screenshots-seeded-v1'
const ALTON_ATTRACTIONS: {name:string;kind:Kind;detail?:string}[]=[
 {name:"Andy's Adventure Dinosaur Dig",kind:'Other',detail:'Show / Live'},
 {name:'Battle Galleons',kind:'Water Ride'},
 {name:"Bing Live: Bing's Day Out at CBeebies Land",kind:'Other',detail:'Show / Live'},
 {name:"Bluey Live: Say G'day to Bluey & Bingo",kind:'Other',detail:'Show'},
 {name:'Bluey the Ride: Here Come the Grannies!',kind:'Coaster'},
 {name:'Bugbie Go Round',kind:'Flat Ride'},
 {name:'Congo River Rapids',kind:'Water Ride'},
 {name:'Cuckoo Cars Driving School',kind:'Flat Ride'},
 {name:'Curse at Alton Manor, The',kind:'Dark Ride'},
 {name:'Furchester Hotel Live, The',kind:'Other',detail:'Show'},
 {name:'Galactica',kind:'Coaster'},
 {name:'Gangsta Granny: The Ride',kind:'Dark Ride'},
 {name:'Get Set Go TreeTop Adventure',kind:'Flat Ride'},
 {name:'Go Jetters Vroomster Zoom Ride',kind:'Flat Ride'},
 {name:'Heave Ho',kind:'Flat Ride'},
 {name:'Hex - The Legend of the Towers',kind:'Dark Ride'},
 {name:'Hey Duggee Live',kind:'Other',detail:'Show'},
 {name:'In the Night Garden Magical Boat Ride',kind:'Water Ride'},
 {name:'JoJo & Gran Gran At Home',kind:'Other',detail:'Walkthrough'},
 {name:'Nemesis: Sub-Terra',kind:'Other'},
]
// Additional attractions visible in the next three Alton Towers screenshots.
// Their names and types are editable in the normal attraction editor.
const ALTON_ADDITIONS: typeof ALTON_ATTRACTIONS=[
 {name:"Marauder's Mayhem",kind:'Flat Ride'},
 {name:'Nemesis Reborn',kind:'Coaster'},
 {name:'Oblivion',kind:'Coaster'},
 {name:'Octonauts Rollercoaster Adventure',kind:'Coaster'},
 {name:'Peter Rabbit Hippity Hop',kind:'Flat Ride'},
 {name:"Raj's Bouncy Bottom Burp",kind:'Flat Ride'},
 {name:'Royal Carousel',kind:'Flat Ride'},
 {name:'Runaway Mine Train',kind:'Coaster'},
 {name:'Sharkbait Reef',kind:'Other',detail:'Explore / Walkthrough'},
 {name:'Sky Ride',kind:'Other',detail:'Transport Ride / Skyride'},
 {name:'Smiler, The',kind:'Coaster'},
 {name:'Spinball Whizzer',kind:'Coaster'},
 {name:'Teletubbies Big Band Show',kind:'Other',detail:'Show'},
 {name:'TH13TEEN',kind:'Coaster'},
 {name:'Towers, The',kind:'Other',detail:'Explore / Walkthrough'},
 {name:'Toxicator',kind:'Flat Ride'},
 {name:'Wicker Man',kind:'Coaster'},
 {name:"Battle Galleons Seadog Starkey's Sailing School",kind:'Other',detail:'Alternative Experience'},
]
const normaliseName=(value:string)=>value
 .trim()
 .replace(/^(.+),\s*The$/i,'The $1')
 .toLocaleLowerCase('en-GB')
 .replace(/[^a-z0-9]/g,'')
function seedAltonTowers(data:Store, incoming:typeof ALTON_ATTRACTIONS=ALTON_ATTRACTIONS):Store{
 const existing=data.parks.find(p=>normaliseName(p.name)==='altontowers')
 const parkId=existing?.id ?? uid()
 const parks=existing ? data.parks : [...data.parks,{id:parkId,name:'Alton Towers',location:'Staffordshire, England'}]
 const known=new Set(data.attractions.filter(a=>a.parkId===parkId).map(a=>normaliseName(a.name)))
 const additions=incoming.filter(a=>!known.has(normaliseName(a.name))).map(a=>({
  id:uid(),parkId,name:a.name,kind:a.kind,detail:a.detail,length:0,speed:0,inversions:0
 }))
 return {...data,parks,attractions:[...data.attractions,...additions]}
}
function initialStore():Store{
 let data:Store={parks:[],attractions:[],visits:[]}
 try{
  const parsed=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<Store>
  data={
   parks:Array.isArray(parsed.parks)?parsed.parks:[],
   attractions:Array.isArray(parsed.attractions)?parsed.attractions:[],
   visits:Array.isArray(parsed.visits)?parsed.visits:[],
  }
  const firstNeeded=localStorage.getItem(ALTON_SEED_KEY)!=='1'
  const additionsNeeded=localStorage.getItem(ALTON_ADDITIONS_KEY)!=='1'
  if(!firstNeeded&&!additionsNeeded)return data
  let seeded=data
  if(firstNeeded)seeded=seedAltonTowers(seeded)
  if(additionsNeeded)seeded=seedAltonTowers(seeded,ALTON_ADDITIONS)
  // Store markers separately: returning users receive only the new attractions,
  // keeping any custom edits or deletions from the previous seed.
  localStorage.setItem(KEY,JSON.stringify(seeded))
  if(firstNeeded)localStorage.setItem(ALTON_SEED_KEY,'1')
  if(additionsNeeded)localStorage.setItem(ALTON_ADDITIONS_KEY,'1')
  return seeded
 }catch{return seedAltonTowers(seedAltonTowers(data),ALTON_ADDITIONS)}
}
const clock=(s:string)=>new Date(s).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
const day=(s:string)=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
type Page='Home'|'Visits'|'Parks'|'Attractions'
export default function App(){
 const contentRef=useRef<HTMLElement>(null)
 const [data,setData]=useState<Store>(initialStore)
 const [page,setPage]=useState<Page>('Home'),[year,setYear]=useState(String(new Date().getFullYear())),[statView,setStatView]=useState<'year'|'all'>('year')
 const [parkName,setParkName]=useState(''),[location,setLocation]=useState(''),[rideName,setRideName]=useState(''),[parkId,setParkId]=useState(''),[kind,setKind]=useState<Kind>('Coaster'),[detail,setDetail]=useState('')
 const [length,setLength]=useState(''),[speed,setSpeed]=useState(''),[inversions,setInversions]=useState(''),[visitPark,setVisitPark]=useState(''),[search,setSearch]=useState(''),[toast,setToast]=useState('')
 const [parkForm,setParkForm]=useState(false),[rideForm,setRideForm]=useState(false),[expanded,setExpanded]=useState<string[]>([]),[editingParkId,setEditingParkId]=useState<string|null>(null),[editingRideId,setEditingRideId]=useState<string|null>(null)
 const active=data.visits.find(v=>!v.checkedOutAt)
 function scrollToContentTop(){contentRef.current?.scrollTo({top:0,behavior:'auto'})}
 // Forms are inserted above the list. Reset the scrollable content pane after
 // React commits the update, including when entering from a different tab.
 useLayoutEffect(()=>{
  if((page==='Attractions'&&rideForm)||(page==='Parks'&&parkForm)){
   scrollToContentTop()
  }
 },[page,rideForm,parkForm,editingParkId,editingRideId])
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(data))},[data])
 useEffect(()=>{if(!toast)return;const t=window.setTimeout(()=>setToast(''),2300);return()=>window.clearTimeout(t)},[toast])
 const allLogs=data.visits.flatMap(v=>v.rides)
 const stats=(logs:RideLog[])=>{const coasters=logs.filter(r=>r.kind==='Coaster');const counts=new Map<string,number>();logs.forEach(r=>counts.set(r.name,(counts.get(r.name)||0)+1));const most=[...counts].sort((a,b)=>b[1]-a[1])[0];return {length:coasters.reduce((s,r)=>s+r.length,0),speed:Math.max(0,...coasters.map(r=>r.speed)),inversions:coasters.reduce((s,r)=>s+r.inversions,0),most:most?.[0]||'—',times:most?.[1]||0}}
 const years=[...new Set([String(new Date().getFullYear()),...data.visits.map(v=>String(new Date(v.checkedInAt).getFullYear()))])].sort((a,b)=>+b-+a)
 function resetParkForm(){setParkName('');setLocation('');setParkForm(false);setEditingParkId(null)}
 function beginParkForm(){scrollToContentTop();setEditingParkId(null);setParkName('');setLocation('');setParkForm(true)}
 function editPark(p:Park){scrollToContentTop();setEditingParkId(p.id);setParkName(p.name);setLocation(p.location);setParkForm(true);setPage('Parks')}
 function addPark(e:FormEvent){
  e.preventDefault();const name=parkName.trim();if(!name)return
  const locationValue=location.trim()
  if(data.parks.some(p=>p.id!==editingParkId&&normaliseName(p.name)===normaliseName(name))){setToast('A park with that name already exists');return}
  if(editingParkId){
   setData(d=>({...d,parks:d.parks.map(p=>p.id===editingParkId?{...p,name,location:locationValue}:p),visits:d.visits.map(v=>v.parkId===editingParkId?{...v,parkName:name}:v)}))
   setToast('Park updated')
  }else{
   setData(d=>({...d,parks:[...d.parks,{id:uid(),name,location:locationValue}]}))
   setToast('Park added')
  }
  resetParkForm()
 }
 function resetRideForm(){setRideName('');setDetail('');setLength('');setSpeed('');setInversions('');setKind('Coaster');setRideForm(false);setEditingRideId(null)}
 function beginRideForm(forPark=''){scrollToContentTop();resetRideForm();if(forPark)setParkId(forPark);setRideForm(true)}
 function editRide(a:Attraction){
  scrollToContentTop()
  setEditingRideId(a.id);setRideName(a.name);setParkId(a.parkId);setKind(a.kind);setDetail(a.detail||'')
  setLength(a.length?String(a.length):'');setSpeed(a.speed?String(a.speed):'');setInversions(a.inversions?String(a.inversions):'')
  setRideForm(true);setPage('Attractions')
 }
 function addRide(e:FormEvent){
  e.preventDefault();const name=rideName.trim();if(!name||!parkId)return
  if(data.attractions.some(a=>a.id!==editingRideId&&a.parkId===parkId&&normaliseName(a.name)===normaliseName(name))){setToast('Attraction already exists at this park');return}
  const changes={parkId,name,kind,detail:kind==='Other'?detail.trim():undefined,
   length:kind==='Coaster'?Math.max(0,Number(length)||0):0,
   speed:kind==='Coaster'?Math.max(0,Number(speed)||0):0,
   inversions:kind==='Coaster'?Math.max(0,Number(inversions)||0):0}
  if(editingRideId){
   setData(d=>({...d,attractions:d.attractions.map(a=>a.id===editingRideId?{...a,...changes}:a)}))
   setToast('Attraction updated')
  }else{
   setData(d=>({...d,attractions:[...d.attractions,{id:uid(),...changes}]}))
   setToast('Attraction added')
  }
  resetRideForm()
 }
 function checkIn(e:FormEvent){e.preventDefault();const p=data.parks.find(x=>x.id===visitPark);if(!p)return;const now=new Date().toISOString();setData(d=>({...d,visits:[{id:uid(),parkId:p.id,parkName:p.name,checkedInAt:now,rides:[]},...d.visits]}));setToast('Checked in — have a brilliant day!')}
 function logRide(a:Attraction){if(!active)return;const r={id:uid(),attractionId:a.id,name:a.name,kind:a.kind,time:new Date().toISOString(),length:a.length,speed:a.speed,inversions:a.inversions};setData(d=>({...d,visits:d.visits.map(v=>v.id===active.id?{...v,rides:[...v.rides,r]}:v)}));setToast('Ride logged at '+clock(r.time))}
 function checkOut(){if(!active)return;setData(d=>({...d,visits:d.visits.map(v=>v.id===active.id?{...v,checkedOutAt:new Date().toISOString()}:v)}));setToast('Visit saved!')}
 const nav:Array<{label:Page;icon:string}>=[{label:'Home',icon:'⌂'},{label:'Visits',icon:'🎟️'},{label:'Parks',icon:'🎡'},{label:'Attractions',icon:'🎢'}]
 const yearLogs=allLogs.filter(r=>{const v=data.visits.find(v=>v.rides.some(x=>x.id===r.id));return v&&String(new Date(v.checkedInAt).getFullYear())===year})
 const chosenStats=stats(yearLogs)
 return <div className="app-shell">
  <header className="topbar"><span className="brand-icon">🎢</span><div className="brand"><small>YOUR PERSONAL</small><strong>PARK LOGBOOK</strong></div><span className="saved"><i/> Saved on this device</span></header>
  <main className="content" ref={contentRef}>
  {page==='Home'&&<><section className="hero"><span className="eyebrow">YOUR ADVENTURE, YOUR STORY</span><h1>Every ride.<br/><em>Every memory.</em></h1><p>Your theme park history, one ride at a time.</p><button className="hero-button" onClick={()=>setPage('Visits')}>{active?'Continue your visit':'Log a park visit'} <b>→</b></button><span className="hero-art">🎡</span></section>
   <section className="year-picker"><div><span className="eyebrow">YOUR STATS</span><h2>Ride statistics</h2></div><select value={year} onChange={e=>{setYear(e.target.value);setStatView('year')}} aria-label="Statistics year">{years.map(y=><option key={y}>{y}</option>)}</select></section>
   <div className="stats-switch" role="group" aria-label="Statistics period"><button className={statView==='year'?'active':''} onClick={()=>setStatView('year')}>{year}</button><button className={statView==='all'?'active':''} onClick={()=>setStatView('all')}>All time</button></div><Stats stats={statView==='year'?chosenStats:stats(allLogs)} title={statView==='year'?year+' HIGHLIGHTS':'ALL-TIME ADVENTURE'}/>
   <div className="quick-actions"><button onClick={()=>{setPage('Parks');beginParkForm()}}><span>＋</span><div><strong>Add a park</strong><small>Build your park list</small></div><b>→</b></button><button onClick={()=>{setPage('Attractions');beginRideForm()}}><span>🎠</span><div><strong>Add an attraction</strong><small>Coasters, rides and scares</small></div><b>→</b></button></div></>}
  {page==='Parks'&&<><Heading title="Parks" eyebrow="YOUR DESTINATIONS" subtitle="All the places where your adventures happen." action={parkForm?'Cancel':'+ Add park'} onAction={()=>parkForm?resetParkForm():beginParkForm()}/>{parkForm&&<form id="park-form" className="form-card" onSubmit={addPark}><Field label="Park name"><input required value={parkName} onChange={e=>setParkName(e.target.value)} placeholder="e.g. Alton Towers"/></Field><Field label="Location"><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Town, region or country"/></Field><button className="primary">{editingParkId?'Save changes':'Save park'}</button></form>}{!data.parks.length&&<Empty icon="🎡" title="Your park list starts here" text="Add your first park, then build its attraction list." action="Add your first park" onClick={()=>setParkForm(true)}/>}{data.parks.map(p=>{const rides=data.attractions.filter(a=>a.parkId===p.id),open=expanded.includes(p.id);return <section className="park-card" key={p.id}><button className="park-toggle" onClick={()=>setExpanded(s=>open?s.filter(x=>x!==p.id):[...s,p.id])}><span className="tile-icon">🎡</span><span className="park-info"><strong>{p.name}</strong><small>{p.location||'Location not added'} · {rides.length} attractions</small></span><b>{open?'−':'＋'}</b></button><button className="edit-card-button" type="button" onClick={()=>editPark(p)} aria-label={'Edit park '+p.name}>Edit</button>{open&&<div className="park-details">{rides.length?rides.map(a=><div className="simple-row" key={a.id}><span>{icons[a.kind]}</span><div><strong>{a.name}</strong><small>{a.kind==='Other'&&a.detail?a.detail:a.kind}</small></div><button className="edit-row-button" type="button" onClick={()=>editRide(a)}>Edit</button></div>):<p className="muted">No attractions yet.</p>}<button className="text-button" onClick={()=>{setPage('Attractions');beginRideForm(p.id)}}>＋ Add attraction to this park</button></div>}</section>})}</>}
  {page==='Attractions'&&<><Heading title="Attractions" eyebrow="YOUR RIDE COLLECTION" subtitle="Every coaster, ride and scare experience." action={rideForm?'Cancel':'+ Add attraction'} onAction={()=>rideForm?resetRideForm():beginRideForm()}/>{rideForm&&<form id="ride-form" className="form-card" onSubmit={addRide}><Field label="Attraction name"><input required value={rideName} onChange={e=>setRideName(e.target.value)} placeholder="e.g. The Smiler"/></Field><Field label="Park"><select required value={parkId} onChange={e=>setParkId(e.target.value)}><option value="">Choose a park</option>{data.parks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Attraction type"><select value={kind} onChange={e=>setKind(e.target.value as Kind)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></Field>{kind==='Other'&&<Field label="Specific type (optional)"><input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="e.g. Show, Walkthrough"/></Field>}{kind==='Coaster'&&<div className="coaster-fields"><span className="eyebrow">COASTER DETAILS</span><Field label="Track length (feet)"><input type="number" min="0" value={length} onChange={e=>setLength(e.target.value)} placeholder="e.g. 3837"/></Field><div className="two-fields"><Field label="Top speed (mph)"><input type="number" min="0" value={speed} onChange={e=>setSpeed(e.target.value)} placeholder="e.g. 53"/></Field><Field label="Inversions"><input type="number" min="0" value={inversions} onChange={e=>setInversions(e.target.value)} placeholder="e.g. 14"/></Field></div></div>}<button className="primary" disabled={!data.parks.length}>{editingRideId?'Save changes':'Save attraction'}</button>{!data.parks.length&&<p className="muted">Add a park first.</p>}</form>}<div className="search-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search attractions…"/><select value={parkId} onChange={e=>setParkId(e.target.value)}><option value="">All parks</option>{data.parks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{data.attractions.filter(a=>(!parkId||a.parkId===parkId)&&a.name.toLowerCase().includes(search.toLowerCase())).map(a=><section className="attraction-card" key={a.id}><span className="tile-icon">{icons[a.kind]}</span><div className="ride-info"><strong>{a.name}</strong><small>{data.parks.find(p=>p.id===a.parkId)?.name} · {a.kind==='Other'&&a.detail?a.detail:a.kind}</small>{a.kind==='Coaster'&&<small>{a.length.toLocaleString()} ft · {a.speed} mph · {a.inversions} inversions</small>}</div><button className="edit-card-button" type="button" onClick={()=>editRide(a)} aria-label={'Edit attraction '+a.name}>Edit</button></section>)}{!data.attractions.length&&<Empty icon="🎢" title="No attractions yet" text="Add an attraction and it will appear here." action="Add attraction" onClick={()=>beginRideForm()}/>}</>}
  {page==='Visits'&&<><Heading title="Visits" eyebrow="YOUR PARK DAYS" subtitle="Check in, log each ride, check out when you're done." />{active?<section className="active-visit"><span className="live-label"><i/> VISIT IN PROGRESS</span><h2>{active.parkName}</h2><p>Checked in at {clock(active.checkedInAt)} · {active.rides.length} rides logged</p><hr/><h3>Log an attraction</h3><input className="visit-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a ride…"/>{data.attractions.filter(a=>a.parkId===active.parkId&&a.name.toLowerCase().includes(search.toLowerCase())).map(a=><button className="log-row" key={a.id} onClick={()=>logRide(a)}><span>{icons[a.kind]}</span><div><strong>{a.name}</strong><small>{a.kind}</small></div><b>＋</b></button>)}<hr/><h3>Today's ride log <span className="count">{active.rides.length}</span></h3>{[...active.rides].reverse().map(r=><div className="simple-row" key={r.id}><span>{icons[r.kind]}</span><div><strong>{r.name}</strong><small>{clock(r.time)}</small></div></div>)}<button className="checkout" onClick={checkOut}>Check out and save visit</button></section>:<><section className="checkin-card"><span>🎟️</span><h2>Ready for a park day?</h2><p>Check in to start logging rides. Every ride gets its own timestamp.</p><form onSubmit={checkIn}><Field label="Choose a park"><select required value={visitPark} onChange={e=>setVisitPark(e.target.value)}><option value="">Select a park</option>{data.parks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><button className="primary" disabled={!data.parks.length}>Check in to park</button></form>{!data.parks.length&&<p className="muted">Add a park before checking in.</p>}</section><h3 className="history-title">Visit history</h3>{data.visits.map(v=><section className="history-card" key={v.id}><span className="tile-icon">🎡</span><div className="history-info"><strong>{v.parkName}</strong><small>{day(v.checkedInAt)} · {v.rides.length} rides</small><small>{clock(v.checkedInAt)}{v.checkedOutAt?' – '+clock(v.checkedOutAt):''}</small></div><span className="status">Saved</span>{v.rides.length>0&&<div className="history-rides">{v.rides.map(r=><span key={r.id}>{icons[r.kind]} {r.name}<b>{clock(r.time)}</b></span>)}</div>}</section>)}</>}</>}
  </main><nav className="bottom-nav">{nav.map(n=><button key={n.label} className={page===n.label?'nav-item selected':'nav-item'} onClick={()=>{scrollToContentTop();setPage(n.label);setSearch('')}}><span>{n.icon}</span><small>{n.label}</small></button>)}</nav>{toast&&<div className="toast" role="status">✓ {toast}</div>}
 </div>
}
function Stats({stats,title}:{stats:{length:number;speed:number;inversions:number;most:string;times:number};title:string}){return <section className="stats-block"><span className="eyebrow">{title}</span><div className="stats-grid"><article className="stat"><span>🛤️</span><strong>{Math.round(stats.length).toLocaleString()} ft</strong><small>Track travelled</small></article><article className="stat"><span>⚡</span><strong>{stats.speed} mph</strong><small>Top speed</small></article><article className="stat"><span>🌀</span><strong>{stats.inversions}</strong><small>Inversions experienced</small></article><article className="stat"><span>🏆</span><strong className="most">{stats.most}</strong><small>Most ridden{stats.times?' · '+stats.times+' times':''}</small></article></div></section>}
function Heading({title,eyebrow,subtitle,action,onAction}:{title:string;eyebrow:string;subtitle:string;action?:string;onAction?:()=>void}){return <section className="page-heading"><span className="eyebrow">{eyebrow}</span><div className="heading-row"><h1>{title}</h1>{action&&<button className="small-action" onClick={onAction}>{action}</button>}</div><p>{subtitle}</p></section>}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Empty({icon,title,text,action,onClick}:{icon:string;title:string;text:string;action:string;onClick:()=>void}){return <section className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p><button className="primary" onClick={onClick}>{action}</button></section>}
