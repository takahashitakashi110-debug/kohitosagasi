import { beforeEach, describe, expect, it } from 'vitest';
import { deleteSave, hasSave, loadSave, parseSave, writeSave } from '../src/game/save';
import type { SaveStorage } from '../src/game/save';
import { freshSave } from '../src/game/state';
import { scoreShot } from '../src/game/photo';
let raw: string | null = null;
const storage: SaveStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
beforeEach(() => { raw = null; deleteSave(null); });
describe('save', () => {
  it.each(['{', 'null', '{"version":2}', JSON.stringify({ ...freshSave(), location: 'unknown' }), JSON.stringify({ ...freshSave(), hints: ['unknown'] }), JSON.stringify({ ...freshSave(), album: { unknown: {} } })])('invalid save resets safely: %s', value => expect(parseSave(value)).toEqual(freshSave()));
  it('valid progress round trips including the best photo', () => {
    const save = freshSave(); save.day = 3; save.time = 'night'; save.location = 'ekimae'; save.hints = ['urasumi'];
    save.album.urasumi = { stage: 3, best: scoreShot({ subject: { x: 0, y: 0, w: 10, h: 10 }, finder: { x: 0, y: 0, w: 10, h: 10 }, distance: 80, heldMs: 1200, moment: true }), day: 2, time: 'night', spot: 'ekimae' };
    writeSave(save, storage); expect(loadSave(storage)).toEqual(save); expect(hasSave(storage)).toBe(true);
    deleteSave(storage); expect(loadSave(storage)).toEqual(freshSave());
  });
  it.each([{ day: -1 }, { day: 1.5 }, { time: 'dawn' }, { hints: ['urasumi', 'urasumi'] }, { escaped: ['unknown'] }, { escaped: ['urasumi', 'urasumi'] }, { escaped: 'urasumi' }, { album: { urasumi: { stage: 9 } } }, { cleared: true }, { clearedDay: 3 }])('rejects malformed nested or scalar data: %s', patch => expect(parseSave(JSON.stringify({ ...freshSave(), ...patch }))).toEqual(freshSave()));
  it('throwing storage keeps progress in memory', () => {
    const broken: SaveStorage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => { throw new Error(); } };
    const save = freshSave(); save.day = 5;
    expect(() => writeSave(save, broken)).not.toThrow(); expect(loadSave(broken)).toEqual(save);
    expect(() => deleteSave(broken)).not.toThrow(); expect(loadSave(broken)).toEqual(freshSave());
  });
  it('escaped round trips, and an older save without escaped loads as empty', () => {
    const save = freshSave(); save.location = 'kawazoi'; save.escaped = ['dobunozoki', 'tarejiri'];
    writeSave(save, storage); expect(loadSave(storage)).toEqual(save);
    const old: Record<string, unknown> = { ...freshSave(), day: 2 }; delete old.escaped;
    expect(parseSave(JSON.stringify(old))).toEqual({ ...freshSave(), day: 2 });
  });
  it('missing storage works in memory', () => { const save = freshSave(); save.day = 8; writeSave(save, null); expect(loadSave(null)).toEqual(save); });
  it('readable but unwritable storage uses current in-memory progress', () => {
    const quota: SaveStorage = { getItem: () => JSON.stringify(freshSave()), setItem: () => { throw new Error(); }, removeItem: () => { throw new Error(); } };
    const save = freshSave(); save.day = 4; writeSave(save, quota);
    expect(loadSave(quota)).toEqual(save); expect(hasSave(quota)).toBe(true);
    deleteSave(quota); expect(hasSave(quota)).toBe(false);
  });
  it('hasSave rejects invalid data and accepts reordered valid fields', () => {
    raw = '{'; expect(hasSave(storage)).toBe(false);
    raw = JSON.stringify({ ...freshSave(), version: 2 }); expect(hasSave(storage)).toBe(false);
    raw = JSON.stringify(Object.fromEntries(Object.entries(freshSave()).reverse())); expect(hasSave(storage)).toBe(true);
  });
});
