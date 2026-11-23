export const periods = ['morning', 'noon', 'evening', 'night'] as const;
export type Period = (typeof periods)[number];
export type Behavior = 'idle' | 'regrip' | 'cheek' | 'hidden' | 'collect' | 'show' | 'absent';
export type Bookmark = '' | 'nuts' | 'quiet';
export type Evidence = { encounter: boolean; ecology: boolean };
export type Note = { memoText: string; hypothesisId: Bookmark };
export type Photo = {
  id: string;
  imageBlob: Blob;
  width: number;
  height: number;
  characterId: 'hohomochi' | null;
  capturedDayPart: Period;
  capturedDay: number;
  capturedBehaviorId: Behavior;
  location: 'home' | 'street';
  created: number;
  cameraTransform: { x: number; y: number; z: number; yaw: number; pitch: number; fov: number };
  evidenceGranted: Evidence;
};
export type Record3D = {
  schemaVersion: 1;
  day: number;
  dayPart: Period;
  traceSeen: boolean;
  encounterSeen: boolean;
  ecologySeen: boolean;
  trustEventSeen: boolean;
  framePhotoId: string | null;
  followPhotoId: string | null;
  notes: Record<string, Note>;
  muted: boolean;
  sensitivity: number;
};
export type Change =
  | { kind: 'photo'; photo: Photo }
  | { kind: 'rest' | 'trace' | 'trust' }
  | { kind: 'frame'; id: string }
  | { kind: 'memo'; id: string; text: string }
  | { kind: 'bookmark'; id: string; value: Bookmark }
  | { kind: 'mute'; value: boolean }
  | { kind: 'sensitivity'; value: number };

export const tuning = {
  focusSeconds: 0.95,
  maxDistance: 8,
  minHeightFraction: 0.045,
  cycle: 6,
  regripStart: 1.6,
  cheekStart: 2.6,
  cheekEnd: 5,
  startleDistance: 2.75,
  retreatDistance: 3.15,
  quietSeconds: 1.6,
};
export const emptyNote = (): Note => ({ memoText: '', hypothesisId: '' });
export const fresh = (): Record3D => ({
  schemaVersion: 1,
  day: 1,
  dayPart: 'morning',
  traceSeen: false,
  encounterSeen: false,
  ecologySeen: false,
  trustEventSeen: false,
  framePhotoId: null,
  followPhotoId: null,
  notes: {},
  muted: false,
  sensitivity: 1,
});

export function applyChange(record: Record3D, action: Change): Record3D {
  switch (action.kind) {
    case 'rest': {
      const next = (periods.indexOf(record.dayPart) + 1) % periods.length;
      return { ...record, dayPart: periods[next], day: record.day + Number(next === 0) };
    }
    case 'photo': {
      const { encounter, ecology } = action.photo.evidenceGranted;
      return {
        ...record,
        encounterSeen: record.encounterSeen || encounter || ecology,
        ecologySeen: record.ecologySeen || ecology,
      };
    }
    case 'trace':
      return { ...record, traceSeen: true };
    case 'trust':
      return { ...record, trustEventSeen: true };
    case 'frame':
      return { ...record, framePhotoId: action.id };
    case 'mute':
      return { ...record, muted: action.value };
    case 'sensitivity':
      return { ...record, sensitivity: action.value };
    case 'memo':
    case 'bookmark': {
      const note = { ...(record.notes[action.id] ?? emptyNote()) };
      let followPhotoId = record.followPhotoId;
      if (action.kind === 'memo') note.memoText = action.text;
      else {
        note.hypothesisId = action.value;
        if (action.value) followPhotoId = action.id;
        else if (followPhotoId === action.id) followPhotoId = null;
      }
      return { ...record, followPhotoId, notes: { ...record.notes, [action.id]: note } };
    }
  }
}

export function naturalBehavior(seconds: number): Behavior {
  const t = seconds % tuning.cycle;
  if (t >= tuning.cheekStart && t < tuning.cheekEnd) return 'cheek';
  if (t >= tuning.regripStart && t < tuning.cheekStart) return 'regrip';
  return 'idle';
}

export function nextAlarm(current: number | null, distance: number, noisy: boolean, dt: number) {
  if (noisy && distance < tuning.startleDistance) return 0;
  if (current === null) return null;
  const quiet = distance >= tuning.retreatDistance ? current + dt : 0;
  return quiet >= tuning.quietSeconds ? null : quiet;
}

export type Sighting = {
  distance: number;
  heightFraction: number;
  cheek: boolean;
  nut: boolean;
  behavior: Behavior;
};
export function evaluate(sight: Sighting, focusSeconds: number): Evidence {
  const encounter =
    sight.behavior !== 'hidden' &&
    sight.behavior !== 'absent' &&
    sight.distance <= tuning.maxDistance &&
    sight.heightFraction >= tuning.minHeightFraction &&
    sight.cheek;
  return {
    encounter,
    ecology: encounter && sight.nut && sight.behavior === 'cheek' && focusSeconds >= tuning.focusSeconds,
  };
}

export const actorSpot = { x: 0.45, z: -9.8 };
export const traceSpot = { x: -0.82, z: -8.62 };
export const looseSpot = { x: -1.35, z: -6.75 };
export const leafSpot = { x: 0.7, z: -8.65 };
export const benchSpot = { x: 2.25, z: -3.55 };
export const homeAt = (z: number) => z >= 3.4;

// Rooms and road meet through an open doorway. Furniture and raised planting beds are solid.
export function canWalk(x: number, z: number) {
  if (z < -8.75 || z > 9.88) return false;
  if (Math.abs(z - 3.4) < 0.28 && Math.abs(x) > 0.84) return false;
  if (homeAt(z)) {
    if (Math.abs(x) > 3.25) return false;
    if (x < -1.35 && z < 5.28) return false;
    if (x > 1.68 && z > 6.0) return false;
  } else {
    if (Math.abs(x) > 2.92) return false;
    if (x > 2.0 && Math.abs(z - benchSpot.z) < 1.15) return false;
  }
  return true;
}

export function move(x: number, z: number, dx: number, dz: number) {
  // Substeps prevent cutting through the door jamb on a slow animation frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < steps; i++) {
    if (canWalk(x + dx / steps, z)) x += dx / steps;
    if (canWalk(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}
