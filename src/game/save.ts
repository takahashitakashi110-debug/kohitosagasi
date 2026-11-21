import { freshSave, KOHITO_IDS, SPOT_IDS, TIMES } from './state';
import type { AlbumEntry, SaveData } from './state';

export const SAVE_KEY = 'kohitosagasi.save.v1';
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
let memory: string | null = null;
const failedStorage = new WeakSet<SaveStorage>();
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const member = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === 'string' && allowed.some(id => id === value);
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const unit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
function validEntry(value: unknown): value is AlbumEntry {
  if (!object(value) || !integer(value.stage, 0, 3) || !integer(value.day, 1) || !member(value.time, TIMES) || !member(value.spot, SPOT_IDS) || !object(value.best)) return false;
  const best = value.best;
  return member(best.framing, ['miss', 'partial', 'half', 'full']) && unit(best.coverage) && unit(best.focus) && unit(best.distScore) &&
    typeof best.moment === 'boolean' && integer(best.score, 0, 100) && member(best.rank, ['S', 'A', 'B', 'C', 'D', 'fail']);
}
function validateSave(raw: string | null): SaveData | null {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !integer(value.day, 1) || !member(value.time, TIMES) ||
      !member(value.location, ['home', ...SPOT_IDS]) || !object(value.album) || !Array.isArray(value.hints) ||
      !value.hints.every((id: unknown) => member(id, KOHITO_IDS) && id !== 'tarejiri') || new Set(value.hints).size !== value.hints.length ||
      typeof value.cleared !== 'boolean' || !(value.clearedDay === null || integer(value.clearedDay, 1))) return null;
    if (value.cleared !== (value.clearedDay !== null) || (typeof value.clearedDay === 'number' && value.clearedDay > value.day)) return null;
    const album = freshSave().album;
    for (const [id, entry] of Object.entries(value.album)) {
      if (!member(id, KOHITO_IDS) || !validEntry(entry)) return null;
      album[id] = entry;
    }
    return { version: 1, day: value.day, time: value.time, location: value.location, album,
      hints: value.hints.filter(id => member(id, KOHITO_IDS)), cleared: value.cleared, clearedDay: value.clearedDay };
  } catch { return null; }
}
export function parseSave(raw: string | null): SaveData { return validateSave(raw) ?? freshSave(); }
function defaultStorage(): SaveStorage | null { try { return globalThis.localStorage ?? null; } catch { return null; } }
function readRaw(storage: SaveStorage | null): string | null {
  if (!storage || failedStorage.has(storage)) return memory;
  try { return storage.getItem(SAVE_KEY); } catch { return memory; }
}
export function loadSave(storage: SaveStorage | null = defaultStorage()): SaveData {
  return parseSave(readRaw(storage));
}
export function hasSave(storage: SaveStorage | null = defaultStorage()): boolean {
  return validateSave(readRaw(storage)) !== null;
}
export function writeSave(save: SaveData, storage: SaveStorage | null = defaultStorage()): void {
  memory = JSON.stringify(save);
  try { if (storage) { storage.setItem(SAVE_KEY, memory); failedStorage.delete(storage); } }
  catch { if (storage) failedStorage.add(storage); }
}
export function deleteSave(storage: SaveStorage | null = defaultStorage()): void {
  memory = null;
  try { if (storage) { storage.removeItem(SAVE_KEY); failedStorage.delete(storage); } }
  catch { if (storage) failedStorage.add(storage); }
}
