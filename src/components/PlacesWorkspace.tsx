import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '../db';
import type {Coordinates, Place, PlaceCategory} from '../types';
import {exportPlaces, normalizePlace, parsePlaces, placeCategories} from '../services/places';
import '../places.css';

type Draft = Omit<Place, 'coordinates'> & {coordinates?: Coordinates};
const fresh = (): Draft => ({id:crypto.randomUUID(), name:'', category:'otro', aliases:[], neighborhood:'', municipality:'Tepic', entrance:'', status:'pendiente', captureMethod:'pin', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()});

export function PlacesWorkspace({onDirtyChange}:{onDirtyChange:(dirty:boolean)=>void}) {
  const places = useLiveQuery(() => db.places.toArray(), []) ?? [];
  const [draft, setDraft] = useState<Draft>(fresh), [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [gpsBusy, setGpsBusy] = useState(false);
  const [query, setQuery] = useState(''), [category, setCategory] = useState('');
  const [incoming, setIncoming] = useState<Place[] | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [basemap,setBasemap] = useState<'google'|'osm'>('google');
  const tileLayer=useRef<L.TileLayer|null>(null);
  const node = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), draftPin = useRef<L.Marker | null>(null), points = useRef<L.LayerGroup | null>(null);
  const alive = useRef(true), gpsRequest = useRef(0), dirtyRef = useRef(false), chooseRef = useRef<(place: Place) => void>(()=>{});
  dirtyRef.current = dirty;
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  function change(patch: Partial<Draft>) {setDraft(d => ({...d,...patch}));setDirty(true)}
  function choose(place: Place) {
    if (dirtyRef.current && !window.confirm('Hay cambios sin guardar. ¿Descartarlos y abrir este lugar?')) return;
    gpsRequest.current++;setGpsBusy(false);setDraft({...place,aliases:[...place.aliases]});setEditing(true);setDirty(false);setNotice('');
    map.current?.setView([place.coordinates.lat,place.coordinates.lng],17);
  }
  chooseRef.current = choose;
  function position(point: Coordinates) {
    gpsRequest.current++;setGpsBusy(false);
    change({coordinates:point,captureMethod:'pin',accuracy:undefined,capturedAt:new Date().toISOString(),status:'pendiente'});
  }
  const positionRef = useRef(position);positionRef.current = position;
  useEffect(() => {
    alive.current=true;
    const m=L.map(node.current!,{center:[21.5095,-104.8957],zoom:14,zoomControl:false});map.current=m;
    L.control.zoom({position:'topright'}).addTo(m);
    points.current=L.layerGroup().addTo(m);
    m.on('click',(event:L.LeafletMouseEvent)=>positionRef.current({lat:event.latlng.lat,lng:event.latlng.lng}));
    const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(node.current!);
    return()=>{alive.current=false;gpsRequest.current++;observer.disconnect();m.remove();map.current=null;draftPin.current=null;points.current=null};
  },[]);
  useEffect(()=>{
    if(!map.current)return;
    tileLayer.current?.remove();
    // Reuse the visual Google layer from the existing stops editor. This supplies
    // imagery only, not Places data, and is not a supported Places API integration.
    const google=basemap==='google';
    const layer=L.tileLayer(google?'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      subdomains:google?['0','1','2','3']:['a','b','c'],maxZoom:19,
      attribution:google?'© Google Maps':'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    tileLayer.current=layer;
    layer.on('tileerror',()=>setNotice('No se pudo cargar parte del mapa. Puedes cambiar la capa a OpenStreetMap; tus lugares siguen guardados.'));
    return()=>{layer.remove();tileLayer.current=null};
  },[basemap]);
  useEffect(()=>{
    const listener=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}};
    window.addEventListener('beforeunload',listener);return()=>window.removeEventListener('beforeunload',listener);
  },[dirty]);
  const visible=places.filter(p=>(!category||p.category===category)&&normalizePlace([p.name,...p.aliases,p.neighborhood,p.municipality].join(' ')).includes(normalizePlace(query)));
  useEffect(()=>{
    if(!map.current||!points.current)return;
    points.current.clearLayers();
    visible.filter(p=>p.id!==draft.id).forEach(place=>{
      const label=document.createElement('span');label.textContent=place.name;
      L.circleMarker([place.coordinates.lat,place.coordinates.lng],{radius:7,color:'#fff',weight:2,fillColor:place.status==='verificado'?'#137e56':'#526884',fillOpacity:1})
        .bindTooltip(label).on('click',event=>{L.DomEvent.stopPropagation(event.originalEvent);chooseRef.current(place)}).addTo(points.current!);
    });
  },[places,query,category,draft.id]);
  useEffect(()=>{
    if(!map.current)return;
    if(!draft.coordinates){draftPin.current?.remove();draftPin.current=null;return;}
    const coords:[number,number]=[draft.coordinates.lat,draft.coordinates.lng];
    if(!draftPin.current){
      draftPin.current=L.marker(coords,{draggable:true,icon:L.divIcon({className:'place-draft-pin',html:'<span></span>',iconSize:[28,36],iconAnchor:[14,36]})}).addTo(map.current);
      draftPin.current.on('dragend',()=>{const p=draftPin.current!.getLatLng();positionRef.current({lat:p.lat,lng:p.lng})});
    }else draftPin.current.setLatLng(coords);
  },[draft.coordinates]);
  function newPlace() {
    if(dirty&&!window.confirm('¿Descartar los cambios sin guardar?'))return;
    gpsRequest.current++;setGpsBusy(false);setDraft(fresh());setEditing(false);setDirty(false);setNotice('Toca el mapa para marcar la entrada del lugar.');
  }
  function locate() {
    if(!navigator.geolocation){setNotice('Este navegador no ofrece GPS. Coloca el pin en el mapa.');return}
    const request=++gpsRequest.current;setGpsBusy(true);setNotice('Buscando una ubicación GPS reciente…');
    navigator.geolocation.getCurrentPosition(fix=>{
      if(!alive.current||request!==gpsRequest.current)return;setGpsBusy(false);
      const {latitude:lat,longitude:lng,accuracy}=fix.coords;
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(accuracy)||accuracy<0||Date.now()-fix.timestamp>30000){setNotice('No recibimos una ubicación válida y reciente. Puedes colocar el pin manualmente.');return}
      change({coordinates:{lat,lng},captureMethod:'gps',accuracy,capturedAt:new Date(fix.timestamp).toISOString(),status:'pendiente'});
      map.current?.setView([lat,lng],17);
      setNotice(`GPS: precisión aproximada de ${Math.round(accuracy)} m.${accuracy>30?' Ajusta el pin sobre la entrada antes de guardar.':' Revisa que el pin esté en la entrada.'}`);
    },error=>{if(alive.current&&request===gpsRequest.current){setGpsBusy(false);setNotice(error.code===1?'Permiso de ubicación denegado. Puedes colocar el pin manualmente.':'No se obtuvo ubicación. Intenta otra vez o coloca el pin.')}},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!draft.coordinates){setNotice('Primero coloca el pin o usa tu GPS.');return}
    if(draft.captureMethod==='gps'&&(draft.accuracy??Infinity)>30){setNotice('La precisión GPS es baja. Ajusta el pin manualmente o vuelve a obtener tu ubicación.');return}
    setBusy(true);
    try{
      const place:Place={...draft,name:draft.name.trim(),aliases:[...new Set(draft.aliases.map(a=>a.trim()).filter(Boolean))],coordinates:draft.coordinates,updatedAt:new Date().toISOString()};
      parsePlaces(exportPlaces([place]));
      await db.places.put(place);setDraft(place);setDirty(false);setEditing(true);setNotice('Lugar guardado en este navegador. Exporta GeoJSON para respaldarlo o llevarlo a otro dispositivo.');
    }catch(error){setNotice(error instanceof Error?error.message:'No se pudo guardar el lugar.')}
    finally{setBusy(false)}
  }
  function download() {
    const blob=new Blob([JSON.stringify(exportPlaces(places),null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='pordondepasa-lugares.geojson';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice(`Exportados ${places.length} lugares guardados. Los cambios sin guardar no se incluyen.`);
  }
  async function readFile(file?:File) {
    if(!file)return;
    setIncoming(null);setReplaceExisting(false);
    try{if(file.size>10*1024*1024)throw Error('El archivo supera 10 MB.');setIncoming(parsePlaces(JSON.parse(await file.text())));setNotice('Archivo validado. Revisa el resumen antes de importar.')}
    catch(error){setNotice(error instanceof Error?error.message:'Archivo inválido.')}
  }
  async function importFile() {
    if(!incoming)return;
    if(dirty&&!window.confirm('Importar descartará los cambios sin guardar del formulario. ¿Continuar?'))return;
    setBusy(true);
    try {
      let count=0;
      await db.transaction('rw',db.places,async()=>{
        const existing=new Set(await db.places.toCollection().primaryKeys());
        const records=incoming.filter(p=>replaceExisting||!existing.has(p.id));
        await db.places.bulkPut(records);count=records.length;
      });
      gpsRequest.current++;setGpsBusy(false);setIncoming(null);setDraft(fresh());setDirty(false);setEditing(false);setNotice(`Importados ${count} lugares. No se borraron otros lugares, rutas ni paradas.`);
    }catch{setNotice('No se pudo importar. No se aplicó la transacción.')}
    finally{setBusy(false)}
  }
  const matches=incoming?.filter(p=>places.some(existing=>existing.id===p.id)).length??0;
  return <section className="places-workspace" aria-label="Editor de lugares">
    <div className="places-map-area"><div ref={node} className="places-map" aria-label="Mapa para colocar lugares"/><div className="places-map-hint">Toca el mapa y arrastra el pin hasta la entrada</div><div className="places-basemap" aria-label="Mapa de referencia"><button type="button" aria-pressed={basemap==='google'} onClick={()=>setBasemap('google')}>Google</button><button type="button" aria-pressed={basemap==='osm'} onClick={()=>setBasemap('osm')}>OpenStreetMap</button></div></div>
    <aside className="places-panel">
      <header><div><h2>Lugares</h2><p>Destinos para PorDóndePasa · {places.length} guardados</p></div><button type="button" onClick={newPlace}>+ Nuevo</button></header>
      <p className="places-local">Guardado local: este navegador. Exporta un respaldo para cambiar de dispositivo.</p>
      <div className="places-actions"><button onClick={download} disabled={!places.length}>Exportar GeoJSON</button><label className="places-import">Importar GeoJSON<input aria-label="Importar GeoJSON de lugares" type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={event=>{void readFile(event.target.files?.[0]);event.target.value=''}}/></label></div>
      {notice&&<p className="places-notice" role="status">{notice}</p>}
      {incoming&&<section className="places-import-preview"><strong>{incoming.length} lugares: {incoming.length-matches} nuevos y {matches} con ID existente.</strong><label><input type="checkbox" checked={replaceExisting} onChange={e=>setReplaceExisting(e.target.checked)}/> Actualizar los {matches} existentes con el archivo</label><p>Por defecto se conservan los existentes. IDs diferentes no se fusionan, aunque tengan el mismo nombre.</p><button disabled={busy} onClick={()=>void importFile()}>Confirmar importación</button><button onClick={()=>setIncoming(null)}>Cancelar</button></section>}
      <form onSubmit={save} className="places-form">
        <h3>{editing?'Editar lugar':'Nuevo lugar'}{dirty?' · Sin guardar':''}</h3>
        <label>Nombre *<input required maxLength={180} value={draft.name} onChange={e=>change({name:e.target.value})} placeholder="Nombre del lugar"/></label>
        <div className="places-fields"><label>Tipo *<select value={draft.category} onChange={e=>change({category:e.target.value as PlaceCategory})}>{Object.entries(placeCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Municipio<input value={draft.municipality} maxLength={180} onChange={e=>change({municipality:e.target.value})} list="place-municipalities"/><datalist id="place-municipalities"><option value="Tepic"/><option value="Xalisco"/></datalist></label></div>
        <label>También lo conocen como<input value={draft.aliases.join(',')} maxLength={600} onChange={e=>change({aliases:e.target.value.split(',')})} placeholder="Nombres separados por coma"/></label>
        <label>Colonia<input value={draft.neighborhood} maxLength={180} onChange={e=>change({neighborhood:e.target.value})}/></label>
        <label>Entrada o referencia<textarea value={draft.entrance} maxLength={1000} rows={2} onChange={e=>change({entrance:e.target.value})} placeholder="Entrada principal por…"/></label>
        <div className="places-position"><button type="button" onClick={locate} disabled={gpsBusy}>{gpsBusy?'Buscando GPS…':'Usar mi ubicación GPS'}</button><small>{draft.coordinates?`${draft.coordinates.lat.toFixed(6)}, ${draft.coordinates.lng.toFixed(6)} · ${draft.captureMethod==='gps'?`GPS ±${Math.round(draft.accuracy??0)} m`:'Pin manual'}`:'Sin posición. Toca el mapa o usa el GPS.'}</small></div>
        <label>Revisión<select value={draft.status} onChange={e=>change({status:e.target.value as Place['status']})}><option value="pendiente">Pendiente de verificar</option><option value="verificado">Verificado por mí</option></select></label>
        <button className="places-save" disabled={busy||gpsBusy||!draft.coordinates||!draft.name.trim()} type="submit">{busy?'Guardando…':editing?'Guardar cambios':'Guardar lugar'}</button>
      </form>
      <section className="places-list" aria-label="Lugares guardados"><h3>Tu catálogo</h3><input aria-label="Buscar lugares guardados" placeholder="Buscar por nombre o colonia" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filtrar lugares por tipo" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(placeCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>{visible.length?visible.map(place=><button key={place.id} onClick={()=>choose(place)} aria-pressed={draft.id===place.id}><strong>{place.name}</strong><small>{placeCategories[place.category]} · {place.neighborhood||place.municipality} · {place.status==='verificado'?'Verificado':'Pendiente'}</small></button>):<p>No hay lugares que mostrar.</p>}</section>
    </aside>
  </section>;
}
