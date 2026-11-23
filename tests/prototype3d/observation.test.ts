import { describe, it, expect } from 'vitest';
import {
  applyChange,
  canWalk,
  evaluate,
  fresh,
  move,
  naturalBehavior,
  nextAlarm,
  periods,
  tuning,
} from '../../src/prototype3d/rules';
import type { Photo, Sighting } from '../../src/prototype3d/rules';
import { restoreRecord, validPhoto } from '../../src/prototype3d/storage';

const scene: Sighting = { distance: 3, heightFraction: 0.18, cheek: true, nut: true, behavior: 'cheek' };
const shot: Photo = {
  id: 'test-shot',
  imageBlob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  width: 1280,
  height: 720,
  characterId: 'hohomochi',
  capturedDayPart: 'morning',
  capturedDay: 1,
  capturedBehaviorId: 'cheek',
  location: 'street',
  created: 1,
  cameraTransform: { x: 0, y: 1.5, z: -6.7, yaw: 0, pitch: -0.11, fov: 47 },
  evidenceGranted: evaluate(scene, 1),
};

describe('same-frame evidence', () => {
  it('accepts an ecology photo first, including at the exact focus boundary', () => {
    expect(evaluate(scene, tuning.focusSeconds)).toEqual({ encounter: true, ecology: true });
    expect(evaluate(scene, tuning.focusSeconds - 0.001)).toEqual({ encounter: true, ecology: false });
  });
  it.each([
    { cheek: false },
    { heightFraction: tuning.minHeightFraction - 0.001 },
    { distance: tuning.maxDistance + 0.01 },
    { behavior: 'hidden' as const },
    { behavior: 'absent' as const },
  ])('rejects unidentifiable view %o', (change) => {
    expect(evaluate({ ...scene, ...change }, 2)).toEqual({ encounter: false, ecology: false });
  });
  it.each([
    { nut: false },
    { behavior: 'idle' as const },
    { behavior: 'regrip' as const },
    { behavior: 'show' as const },
  ])('retains a recognizable cheek and withholds ecology for %o', (change) => {
    expect(evaluate({ ...scene, ...change }, 2)).toEqual({ encounter: true, ecology: false });
  });
  it('repeats the natural observable motion without any interactions', () => {
    for (const cycle of [0, 1, 5]) {
      const start = cycle * tuning.cycle;
      expect([0, 2, 3, 4.8, 5.7].map((t) => naturalBehavior(start + t))).toEqual([
        'idle',
        'regrip',
        'cheek',
        'cheek',
        'idle',
      ]);
    }
  });
});
describe('journal, time and walking', () => {
  it('retains one-shot discoveries after displaying scenery, with a blank note and no trust', () => {
    let r = applyChange(fresh(), { kind: 'photo', photo: shot });
    r = applyChange(r, {
      kind: 'photo',
      photo: { ...shot, id: 'other', evidenceGranted: { encounter: false, ecology: false } },
    });
    r = applyChange(r, { kind: 'frame', id: 'other' });
    expect(r).toMatchObject({
      encounterSeen: true,
      ecologySeen: true,
      trustEventSeen: false,
      day: 1,
      dayPart: 'morning',
      framePhotoId: 'other',
      notes: {},
    });
  });
  it('trust and trace do not award photo evidence or advance time', () => {
    const r = applyChange(applyChange(fresh(), { kind: 'trust' }), { kind: 'trace' });
    expect(r).toMatchObject({
      trustEventSeen: true,
      traceSeen: true,
      ecologySeen: false,
      encounterSeen: false,
      dayPart: 'morning',
    });
  });
  it('preserves exact multiline notes per photo across bookmark edits and frame swaps', () => {
    let r = applyChange(fresh(), { kind: 'memo', id: 'one', text: '目が合った？\n <葉>  ' });
    r = applyChange(r, { kind: 'bookmark', id: 'one', value: 'quiet' });
    r = applyChange(r, { kind: 'frame', id: 'two' });
    r = applyChange(r, { kind: 'memo', id: 'two', text: '別の一枚' });
    expect(r.notes.one).toEqual({ memoText: '目が合った？\n <葉>  ', hypothesisId: 'quiet' });
    expect(r.notes.two.memoText).toBe('別の一枚');
    expect(r.followPhotoId).toBe('one');
    expect(applyChange(r, { kind: 'bookmark', id: 'one', value: '' }).followPhotoId).toBeNull();
    expect(r.dayPart).toBe('morning');
  });
  it('advances one period per explicit rest and rolls over exactly once', () => {
    let r = fresh();
    for (let day = 1; day <= 3; day++)
      for (const part of periods) {
        expect([r.day, r.dayPart]).toEqual([day, part]);
        r = applyChange(r, { kind: 'rest' });
      }
    expect([r.day, r.dayPart]).toEqual([4, 'morning']);
  });
  it('requires a quiet retreat to recover after a nearby noise', () => {
    expect(nextAlarm(null, 1, false, 1)).toBeNull();
    expect(nextAlarm(null, 1, true, 1)).toBe(0);
    expect(nextAlarm(0, 1, false, 5)).toBe(0);
    expect(nextAlarm(0, 4, false, 1.0)).toBe(1);
    expect(nextAlarm(1, 4, false, 0.7)).toBeNull();
  });
  it('connects the room through the open door, and stops at its jamb, the bed and the raised hedge', () => {
    expect(move(0, 7, 0, -14).z).toBeCloseTo(-7);
    expect(move(-1.2, 6, 0, -8).z).toBeGreaterThan(3.4);
    expect(canWalk(2.5, 8)).toBe(false);
    expect(move(0, -7, 0, -10).z).toBeGreaterThanOrEqual(-8.75);
  });
});
describe('damaged saves', () => {
  it('starts in an intact empty journal only for a genuine first visit', () => {
    expect(restoreRecord(undefined)).toEqual({ data: fresh(), damaged: false });
    expect(restoreRecord(null).damaged).toBe(true);
    expect(restoreRecord(fresh()).damaged).toBe(false);
  });
  it('recovers usable fields and flags invalid days, notes and broken structure', () => {
    const raw = {
      ...fresh(),
      ecologySeen: true,
      day: -2,
      dayPart: 'winter',
      notes: { a: { memoText: '本文そのまま', hypothesisId: 'bad' }, b: null },
    };
    const { data, damaged } = restoreRecord(raw);
    expect(damaged).toBe(true);
    expect(data.encounterSeen).toBe(true);
    expect(data.dayPart).toBe('morning');
    expect(data.notes.a).toEqual({ memoText: '本文そのまま', hypothesisId: '' });
  });
  it('requires actual bytes, a complete camera transform and coherent metadata', () => {
    expect(validPhoto(shot)).toBe(true);
    for (const bad of [
      { imageBlob: undefined },
      { imageBlob: new Blob([]) },
      { width: 0 },
      { cameraTransform: {} },
      { capturedDay: 0 },
      { capturedDayPart: 'bad' },
      { evidenceGranted: {} },
      { id: '__proto__' },
    ])
      expect(validPhoto({ ...shot, ...bad })).toBe(false);
  });
});
