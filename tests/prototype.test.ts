import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESIDENTS } from '../src/data/townspeople';
import { KOHITO, SUBJECT_BOUNDS } from '../src/data/kohito';
import { SPOTS, SPAWN } from '../src/data/spots';
import { createGame, KOHITO_IDS } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import { moveKohito } from '../src/game/motion';
import { beginCamera, cycleSubject, nearbySubjects, selectedSubject } from '../src/game/subjects';
import { blocked, distance } from '../src/game/world';
import { evaluateCamera, subjectRect, takePhoto } from '../src/scenes/camera';

describe('prototype residents are separate photographic subjects', () => {
  it.each(RESIDENTS)('$id has reachable ground and does not change the starting camera availability', resident => {
    expect(blocked(SPOTS[resident.spot], resident.x, resident.y)).toBe(false);
    expect(distance(SPAWN, resident)).toBeGreaterThan(120);
  });
  it('selects the nearest subject and cycles to a nearby kohito', () => {
    const r = RESIDENTS[0]; const game = createGame(); game.save.location = r.spot;
    game.player = { x: r.x, y: r.y - 60 };
    const k = createKohito('haritsuki', r.x + 30, r.y - 40); game.kohitos = [k];
    expect(nearbySubjects(game)).toHaveLength(2);
    const first = selectedSubject(game)!;
    cycleSubject(game); expect(selectedSubject(game)?.kind).not.toBe(first.kind);
    cycleSubject(game); expect(selectedSubject(game)?.body.id).toBe(first.body.id);
  });
  it.each(RESIDENTS)('$id gives resident feedback and leaves all saved game progress unchanged', r => {
    const game = createGame(); game.save.location = r.spot;
    game.player = { x: r.x, y: r.y + 70 };
    const before = JSON.stringify(game.save);
    expect(beginCamera(game)).toBe(true); expect(game.residentTarget).toBe(r.id);
    game.heldMs = 1300; takePhoto(game);
    expect(game.residentFeedback?.id).toBe(r.id); expect(game.residentFeedback?.hintGained).toBe(false);
    expect(game.feedback).toBeNull(); expect(game.scene).toBe('field');
    expect(JSON.stringify(game.save)).toBe(before);
  });
  it('does not target an escaped kohito and returns no subject when far away', () => {
    const game = createGame(); game.save.location = 'kawazoi'; game.player = { x: 40, y: 40 };
    const k = createKohito('dobunozoki', 40, 40); k.escaped = true; game.kohitos = [k];
    expect(nearbySubjects(game)).toEqual([]); expect(beginCamera(game)).toBe(false);
  });
});

describe('short excursions remain photographable', () => {
  it.each(KOHITO_IDS)('%s has rests, a bounded path and no new wall penetration', id => {
    const def = KOHITO[id]; const k = createKohito(id, def.x, def.y); k.fullRemaining = 8;
    const positions: number[] = [];
    for (let i = 0; i < 960; i++) {
      const before = { x: k.x, y: k.y }; moveKohito(k, 1 / 60, SPOTS[def.spot]); positions.push(k.x);
      expect(Math.abs(k.x - def.x)).toBeLessThanOrEqual(22);
      if (k.x !== before.x) expect(blocked(SPOTS[def.spot], k.x, k.y, 3)).toBe(false);
    }
    expect(positions.slice(0, 100).every(x => x === def.x)).toBe(true);
    expect(new Set(positions).size).toBeGreaterThan(10);
  });
  it('keeps hidden tarejiri in the cover and does not move fleeing subjects', () => {
    const k = createKohito('tarejiri', 336, 324);
    for (let i = 0; i < 120; i++) moveKohito(k, 0.1, SPOTS.kawazoi);
    expect([k.x, k.y]).toEqual([336, 324]);
    k.fullRemaining = 8; k.fleeing = 0.5; moveKohito(k, 3, SPOTS.kawazoi);
    expect([k.x, k.y]).toEqual([336, 324]);
  });
  it('locks the aim at camera entry and scores the actual moving location', () => {
    const game = createGame(); game.save.location = 'kawazoi'; game.player = { x: 288, y: 400 };
    const k = createKohito('dobunozoki', 288, 300); game.kohitos = [k];
    expect(beginCamera(game)).toBe(true);
    const before = subjectRect(game, k); const anchor = { ...game.cameraAnchor! };
    moveKohito(k, 3.5, SPOTS.kawazoi);
    const after = subjectRect(game, k);
    expect(game.cameraAnchor).toEqual(anchor);
    expect(after.x - before.x).toBeCloseTo((k.x - 288) * 1.6);
    game.heldMs = 1300; expect(evaluateCamera(game, k).framing).toBe('full');
    game.pan = -48; k.x += 120; expect(evaluateCamera(game, k).framing).not.toBe('full');
  });
});

describe('four-frame image paths', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('uses every motion frame for all seven kohito rows inside their scoring rectangles', async () => {
    vi.stubGlobal('Image', class { complete = true; naturalWidth = 1024; naturalHeight = 1792; src = ''; });
    vi.resetModules(); const { drawSummerKohito } = await import('../src/render/summerImages');
    const drawImage = vi.fn(); const c = { drawImage } as unknown as CanvasRenderingContext2D;
    for (const id of KOHITO_IDS) for (const hidden of id === 'tarejiri' ? [false, true] : [false]) {
      for (let frame = 0; frame < 4; frame++) {
        expect(drawSummerKohito(c, id, false, hidden, frame * 0.35 + 0.01)).toBe(true);
        const [image, sx, sy, , , x, y, w, h] = drawImage.mock.lastCall!;
        expect(image.src).toContain('kohitos-motion.webp'); expect(sx).toBe(frame * 256 + 4);
        expect(sy).toBe((hidden ? 6 : KOHITO_IDS.indexOf(id)) * 256 + 4);
        const b = hidden ? { left: -6, top: -7, w: 26, h: 27 } : SUBJECT_BOUNDS[id];
        expect(x).toBeGreaterThanOrEqual(b.left); expect(y).toBeGreaterThanOrEqual(b.top);
        expect(x + w).toBeLessThanOrEqual(b.left + b.w); expect(y + h).toBeLessThanOrEqual(b.top + b.h);
      }
    }
    expect(drawImage).toHaveBeenCalledTimes(28);
  });
});
