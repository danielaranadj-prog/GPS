import type { Stop } from '../types/index.ts';
import { parseStops } from './stops.ts';

export const APP_STOP_FILES = ['general-stops.json', 'insurgentes-stops.json', 'mexico-stops.json'] as const;
export type AppStopFile = { name: string; baseline: string; document: unknown; stops: Stop[] };
export type StopFileHandle = {
  name: string;
  getFile(): Promise<{ text(): Promise<string>; size: number }>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
};
export type StopFilePicker = (options: { multiple: boolean; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<StopFileHandle[]>;

export function parseAppStopFile(name: string, text: string): AppStopFile {
  if (!APP_STOP_FILES.some(file => file === name)) throw new Error('Selecciona general-stops.json, insurgentes-stops.json o mexico-stops.json de public/data/stops.');
  if (text.length > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.');
  const document: unknown = JSON.parse(text), stops = parseStops(document);
  return { name, baseline: text, document, stops };
}

export function linkedStops(file: AppStopFile): Stop[] {
  return file.stops.map(stop => ({ ...stop, id: `app-file:${file.name}:${stop.id}`, appFile: { name: file.name, originalId: stop.id } }));
}

/** Keep source headers, arbitrary stop metadata and full coordinate precision.
 * Read raw DB records, not a route view with computed route memberships. */
export function buildAppStopFile(file: AppStopFile, records: Stop[]): { text: string; stops: Stop[]; added: number; removed: number; changed: number } {
  const originals = new Map(file.stops.map(stop => [stop.id, stop]));
  const bound = records.filter(stop => stop.appFile?.name === file.name);
  const byId = new Map(bound.map(stop => [stop.appFile!.originalId, stop]));
  if (bound.length !== byId.size) throw new Error('Hay IDs originales repetidos en este archivo. Corrígelos antes de guardar.');
  const ordered = [...file.stops.map(stop => stop.id).filter(id => byId.has(id)), ...[...byId.keys()].filter(id => !originals.has(id))];
  const stops = ordered.map(id => {
    const { appFile: _binding, id: _localId, ...fields } = byId.get(id)!;
    // isLocked is an editor setting. Preserve it only if it was in the original file.
    if (!originals.get(id) || !('isLocked' in originals.get(id)!)) delete fields.isLocked;
    return { ...originals.get(id), ...fields, id } as Stop;
  });
  parseStops(stops);
  const payload = Array.isArray(file.document) ? stops : { ...(file.document as Record<string, unknown>), stops };
  return { text: JSON.stringify(payload, null, 2) + '\n', stops,
    added: stops.filter(stop => !originals.has(stop.id)).length,
    removed: file.stops.filter(stop => !byId.has(stop.id)).length,
    changed: stops.filter(stop => originals.has(stop.id) && JSON.stringify(stop) !== JSON.stringify(originals.get(stop.id))).length };
}

/** Refuse stale overwrites; a writable stream replaces the file only on close. */
export async function writeAppStopFile(file: AppStopFile, text: string, handle: StopFileHandle, backup: (text: string, name: string) => Promise<void>): Promise<AppStopFile> {
  const next = parseAppStopFile(file.name, text);
  if (handle.name !== file.name) throw new Error('El archivo conectado no coincide con el origen.');
  if (await (await handle.getFile()).text() !== file.baseline) throw new Error('El archivo cambió fuera de GPS. Vuelve a cargarlo antes de sobrescribir; tus ediciones siguen en GPS.');
  await backup(file.baseline, file.name);
  const stream = await handle.createWritable();
  try {
    await stream.write(text);
    if (await (await handle.getFile()).text() !== file.baseline) throw new Error('El archivo cambió mientras se guardaba. Se canceló la escritura.');
    await stream.close();
  } catch (error) { await stream.abort().catch(() => {}); throw error; }
  return next;
}
