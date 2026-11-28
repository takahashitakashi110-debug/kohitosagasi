import { applyChange, emptyNote, fresh, periods } from './rules';
import type { Change, Photo, Record3D } from './rules';

export const databaseName = 'kohitosagasi-3d-p0-v1';
type SaveStatus = 'ready' | 'saving' | 'saved' | 'unsaved';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const positive = (v: unknown): v is number => Number.isInteger(v) && Number(v) > 0;
const knownPeriod = (v: unknown) => periods.some((p) => p === v);
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[\w-]{1,100}$/.test(id) && !Object.hasOwn(Object.prototype, id);

export function restoreRecord(raw: unknown) {
  const data = fresh();
  if (!object(raw)) return { data, damaged: raw !== undefined };
  let damaged = raw.schemaVersion !== 1;
  for (const key of ['encounterSeen', 'ecologySeen', 'trustEventSeen', 'traceSeen', 'muted'] as const) {
    if (typeof raw[key] === 'boolean') data[key] = raw[key];
    else damaged = true;
  }
  if (data.ecologySeen) data.encounterSeen = true;
  if (positive(raw.day)) data.day = raw.day;
  else damaged = true;
  if (knownPeriod(raw.dayPart)) data.dayPart = raw.dayPart as Record3D['dayPart'];
  else damaged = true;
  if (validId(raw.framePhotoId)) data.framePhotoId = raw.framePhotoId;
  else if (raw.framePhotoId !== null) damaged = true;
  if (typeof raw.sensitivity === 'number' && raw.sensitivity >= 0.4 && raw.sensitivity <= 2)
    data.sensitivity = raw.sensitivity;
  else damaged = true;
  if (object(raw.notes)) {
    for (const [id, note] of Object.entries(raw.notes)) {
      if (!validId(id) || !object(note)) {
        damaged = true;
        continue;
      }
      const entry = emptyNote();
      if (typeof note.memoText === 'string') entry.memoText = note.memoText;
      else damaged = true;
      if (note.hypothesisId === 'nuts' || note.hypothesisId === 'quiet' || note.hypothesisId === '')
        entry.hypothesisId = note.hypothesisId;
      else damaged = true;
      data.notes[id] = entry;
    }
  } else damaged = true;
  if (validId(raw.followPhotoId) && data.notes[raw.followPhotoId]?.hypothesisId)
    data.followPhotoId = raw.followPhotoId;
  else if (
    raw.followPhotoId === undefined &&
    data.framePhotoId &&
    data.notes[data.framePhotoId]?.hypothesisId
  )
    data.followPhotoId = data.framePhotoId;
  else if (raw.followPhotoId != null) damaged = true;
  return { data, damaged };
}

export function validPhoto(p: unknown): p is Photo {
  if (
    !object(p) ||
    !validId(p.id) ||
    !(p.imageBlob instanceof Blob) ||
    !p.imageBlob.size ||
    !positive(p.width) ||
    !positive(p.height) ||
    !positive(p.capturedDay) ||
    !knownPeriod(p.capturedDayPart) ||
    !Number.isFinite(p.created) ||
    !object(p.cameraTransform) ||
    !object(p.evidenceGranted)
  )
    return false;
  const t = p.cameraTransform;
  return (
    ['x', 'y', 'z', 'yaw', 'pitch', 'fov'].every((k) => Number.isFinite(t[k])) &&
    (p.location === 'home' || p.location === 'street') &&
    (p.characterId === null || p.characterId === 'hohomochi') &&
    ['idle', 'regrip', 'cheek', 'hidden', 'collect', 'show', 'absent'].includes(
      String(p.capturedBehaviorId),
    ) &&
    typeof p.evidenceGranted.encounter === 'boolean' &&
    typeof p.evidenceGranted.ecology === 'boolean'
  );
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new Error('blocked'));
    };
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('journal');
      request.result.createObjectStore('photos', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

const complete = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('transaction'));
  });

export class Journal {
  record = fresh();
  photos: Photo[] = [];
  status: SaveStatus = 'ready';
  damaged = false;
  private db?: IDBDatabase;
  private pending: Change[] = [];
  private writing = false;
  private incompatible = false;
  private recovered = { encounter: false, ecology: false };
  constructor(private notify: () => void) {}

  async load() {
    try {
      this.db?.close();
      this.db = await openDB();
      const tx = this.db.transaction(['journal', 'photos'], 'readonly');
      const state = tx.objectStore('journal').get('world');
      const pictures = tx.objectStore('photos').getAll();
      await complete(tx);
      const raw: unknown = state.result;
      this.incompatible = object(raw) && typeof raw.schemaVersion === 'number' && raw.schemaVersion > 1;
      const restored = restoreRecord(raw);
      const rows: unknown[] = pictures.result;
      this.photos = rows.filter(validPhoto).sort((a, b) => a.created - b.created);
      this.record = restored.data;
      for (const photo of this.photos) this.record = applyChange(this.record, { kind: 'photo', photo });
      this.recovered = { encounter: this.record.encounterSeen, ecology: this.record.ecologySeen };
      this.damaged =
        restored.damaged ||
        rows.length !== this.photos.length ||
        (raw === undefined && rows.length > 0) ||
        (this.record.framePhotoId !== null && !this.photos.some((p) => p.id === this.record.framePhotoId));
      this.status = this.incompatible ? 'unsaved' : raw === undefined ? 'ready' : 'saved';
    } catch {
      this.status = 'unsaved';
    }
    this.notify();
  }

  change(action: Change) {
    this.record = applyChange(this.record, action);
    if (action.kind === 'photo') this.photos.push(action.photo);
    this.pending.push(action);
    void this.flush();
  }

  async retry() {
    if (this.pending.length) await this.flush();
    else await this.load();
  }

  // Read-modify-write under the same IDB lock. A failed batch keeps its Blobs in memory for retry.
  async flush() {
    if (this.writing || this.incompatible) {
      this.notify();
      return;
    }
    this.writing = true;
    this.status = 'saving';
    this.notify();
    try {
      this.db ??= await openDB();
      while (this.pending.length) {
        const batch = this.pending.slice();
        const tx = this.db.transaction(['journal', 'photos'], 'readwrite');
        const done = complete(tx);
        const journal = tx.objectStore('journal');
        const get = journal.get('world');
        let committed = this.record;
        let externalPhoto: IDBRequest | undefined;
        get.onsuccess = () => {
          try {
            if (object(get.result) && Number(get.result.schemaVersion) > 1) {
              tx.abort();
              return;
            }
            let latest = restoreRecord(get.result).data;
            latest.encounterSeen ||= this.recovered.encounter;
            latest.ecologySeen ||= this.recovered.ecology;
            for (const action of batch) {
              if (action.kind === 'photo') tx.objectStore('photos').put(action.photo);
              latest = applyChange(latest, action);
            }
            journal.put(latest, 'world');
            committed = latest;
            if (latest.framePhotoId && !this.photos.some((p) => p.id === latest.framePhotoId))
              externalPhoto = tx.objectStore('photos').get(latest.framePhotoId);
          } catch {
            tx.abort();
          }
        };
        await done;
        this.pending.splice(0, batch.length);
        if (externalPhoto && validPhoto(externalPhoto.result)) {
          this.photos.push(externalPhoto.result);
          this.photos.sort((a, b) => a.created - b.created);
        }
        this.record = this.pending.reduce(applyChange, committed);
      }
      this.status = 'saved';
    } catch {
      this.db?.close();
      this.db = undefined;
      this.status = 'unsaved';
    } finally {
      this.writing = false;
      this.notify();
    }
  }
}
