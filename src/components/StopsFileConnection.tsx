import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { APP_STOP_FILES, buildAppStopFile, linkedStops, parseAppStopFile, writeAppStopFile, type AppStopFile, type StopFileHandle, type StopFilePicker } from '../services/appStopFiles';

type Connection = { file: AppStopFile; handle?: StopFileHandle };
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StopsFileConnection({ selectedStopId }: { selectedStopId?: string | null }) {
  const [connections, setConnections] = useState<Connection[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const records = useLiveQuery(() => db.stops.toArray(), []) ?? [];
  const selected = records.find(stop => stop.id === selectedStopId);
  const picker = (window as unknown as { showOpenFilePicker?: StopFilePicker }).showOpenFilePicker;
  async function load(items: { name: string; text: string; handle?: StopFileHandle }[]) {
    const incoming = items.map(item => ({ file: parseAppStopFile(item.name, item.text), handle: item.handle }));
    if (new Set(incoming.map(item => item.file.name)).size !== incoming.length) throw new Error('Selecciona una sola copia de cada archivo.');
    const count = incoming.reduce((sum, item) => sum + item.file.stops.length, 0);
    if (!window.confirm(`Conectar ${count} paradas de los archivos. Si ya hay copias editadas en GPS, se conservarán. No se borran tus otras paradas, lugares, rutas ni anuncios. ¿Continuar?`)) return;
    await db.transaction('rw', db.stops, async () => {
      const existing = await db.stops.toArray();
      for (const { file } of incoming) {
        if (existing.some(stop => stop.appFile?.name === file.name)) continue; // Reattaching must not discard unsaved edits.
        const copies = linkedStops(file);
        for (const stop of copies) {
          const collision = existing.find(item => item.id === stop.id);
          if (collision && collision.appFile?.name !== file.name) throw new Error('Un ID coincide con otra parada local. No se modificó ninguna parada.');
        }
        await db.stops.bulkPut(copies);
      }
    });
    setConnections(previous => [...previous.filter(item => !incoming.some(next => next.file.name === item.file.name)), ...incoming]);
    setStatus(`Archivos conectados. Conservamos las copias ya editadas en GPS; los originales no se han modificado. Revisa los cambios antes de guardar.`);
  }
  async function connect() {
    if (!picker) { input.current?.click(); return; }
    // Call the picker directly from the click, while user activation is valid.
    setBusy(true); setStatus('');
    try { const handles = await picker.call(window, { multiple: true, types: [{ description: 'Paradas de PorDóndePasa', accept: { 'application/json': ['.json'] } }] });
      await load(await Promise.all(handles.map(async handle => { const file = await handle.getFile(); if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.'); return { name: handle.name, text: await file.text(), handle }; })));
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus(error instanceof Error ? error.message : 'No se pudieron conectar los archivos.'); }
    finally { setBusy(false); }
  }
  async function save(connection: Connection, direct: boolean) {
    setBusy(true); setStatus('');
    try {
      const output = buildAppStopFile(connection.file, await db.stops.toArray());
      if (!output.stops.length && connection.file.stops.length && !window.confirm('El archivo quedaría SIN PARADAS. ¿Confirmas que eliminaste todas intencionalmente?')) return;
      if (!window.confirm(`${connection.file.name}: ${output.stops.length} paradas; ${output.added} nuevas, ${output.changed} editadas y ${output.removed} eliminadas. ${direct ? 'Se descargará un respaldo y se sobrescribirá este archivo local.' : 'Se descargará el JSON; reemplázalo manualmente en public/data/stops.'} ¿Continuar?`)) return;
      if (direct && connection.handle) {
        const next = await writeAppStopFile(connection.file, output.text, connection.handle, async (text, name) => { download(text, `respaldo-${Date.now()}-${name}`); });
        setConnections(previous => previous.map(item => item === connection ? { ...item, file: next } : item));
        setStatus(`${connection.file.name} guardado. No se ha publicado en internet; la app local leerá este archivo al recargar.`);
      } else { download(output.text, connection.file.name); setStatus(`JSON descargado: ${connection.file.name}. Reemplaza SOLO ese archivo en PorDondePasa/public/data/stops. Aún no está publicado.`); }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo guardar. Tus ediciones siguen en GPS.'); }
    finally { setBusy(false); }
  }
  async function assign(name: string) {
    if (!selected || selected.appFile || busy) return;
    if (records.some(stop => stop.appFile?.name === name && stop.appFile.originalId === selected.id)) { setStatus('Este ID ya está vinculado al archivo. No se duplicó la parada.'); return; }
    setBusy(true);
    try { await db.stops.update(selected.id, { appFile: { name, originalId: selected.id } }); setStatus(`Parada añadida a ${name}. Guarda ese archivo para llevarla a la app.`); }
    catch { setStatus('No se pudo vincular esta parada.'); }
    finally { setBusy(false); }
  }
  async function reload(connection: Connection) {
    if (!window.confirm(`Reemplazar las copias de ${connection.file.name} en GPS por el contenido del archivo conectado. Se perderán las ediciones locales de este archivo; las otras paradas, lugares y anuncios se conservan. ¿Continuar?`)) return;
    setBusy(true);
    try {
      const file = connection.handle ? parseAppStopFile(connection.file.name, await (await connection.handle.getFile()).text()) : connection.file;
      await db.transaction('rw', db.stops, async () => { const all = await db.stops.toArray(); await db.stops.bulkDelete(all.filter(stop => stop.appFile?.name === file.name).map(stop => stop.id)); await db.stops.bulkPut(linkedStops(file)); });
      setConnections(previous => previous.map(item => item === connection ? { ...item, file } : item));
      setStatus('Copias recargadas del archivo. Los archivos del proyecto no se han modificado.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo recargar; las copias anteriores se conservaron.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Archivos de paradas de PorDóndePasa" className="p-3 border-b border-slate-200 dark:border-slate-700 text-xs space-y-2">
    <details open={connections.length > 0}>
      <summary className="cursor-pointer font-bold py-2">Archivos de PorDóndePasa</summary>
      <p className="my-2 text-slate-500">Conecta los JSON de <strong>public/data/stops</strong>. Conservamos separados General, Insurgentes y México, sin redondear coordenadas.</p>
      <button disabled={busy} onClick={() => void connect()} className="min-h-10 px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{picker ? 'Conectar archivos locales' : 'Cargar JSON de la app'}</button>
      {picker && <button disabled={busy} onClick={() => input.current?.click()} className="min-h-10 px-2 ml-1 border rounded-lg">Cargar sin conexión directa</button>}
      <input ref={input} type="file" multiple accept=".json,application/json" className="hidden" onChange={async event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; setBusy(true); try { await load(await Promise.all(files.map(async file => { if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.'); return { name: file.name, text: await file.text() }; }))); } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudieron cargar.'); } finally { setBusy(false); } }} />
      {!picker && <p className="mt-2 text-slate-500">Este navegador permite cargar y descargar; sobrescribir directamente requiere un navegador con acceso a archivos locales.</p>}
      {connections.map(connection => { const count = records.filter(stop => stop.appFile?.name === connection.file.name).length; return <div key={connection.file.name} className="mt-2 p-2 rounded border border-slate-200 dark:border-slate-700 space-y-1">
        <strong>{connection.file.name}</strong><span className="block text-slate-500">{count} paradas editables</span>
        <div className="flex flex-wrap gap-2">{connection.handle && <button disabled={busy} onClick={() => void save(connection, true)} className="min-h-10 px-2 bg-emerald-700 text-white rounded disabled:opacity-50">Guardar con respaldo</button>}<button disabled={busy} onClick={() => void save(connection, false)} className="min-h-10 px-2 border rounded disabled:opacity-50">Descargar JSON</button><button disabled={busy} onClick={() => void reload(connection)} className="min-h-10 text-slate-500 underline">Recargar y descartar ediciones</button></div>
        {selected && !selected.appFile && <button disabled={busy || selected.isLocked} onClick={() => void assign(connection.file.name)} className="min-h-10 text-blue-600 underline">Añadir parada seleccionada a este archivo</button>}
      </div>; })}
      <p className="mt-2 text-slate-500">Tras recargar GPS, vuelve a conectar los archivos. Guardar aquí no cambia las rutas ni las pautas, ni publica la app.</p>
      {!connections.length && <small>{APP_STOP_FILES.join(' · ')}</small>}
    </details>
    {status && <p role="status" className="p-2 rounded bg-blue-50 text-blue-900 break-words">{status}</p>}
  </section>;
}
