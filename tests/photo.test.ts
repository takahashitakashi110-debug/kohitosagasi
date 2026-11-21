import { describe, expect, it } from 'vitest';
import { scoreShot, shotStage } from '../src/game/photo';
import type { ShotInput } from '../src/game/photo';
import { createGame } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import { evaluateCamera, recordPhoto } from '../src/scenes/camera';

const base: ShotInput = { subject: { x: 0, y: 0, w: 100, h: 100 }, finder: { x: 0, y: 0, w: 100, h: 100 }, heldMs: 1200, distance: 40, moment: false };
describe('camera and album integration', () => {
  it('never downgrades stage, keeps the best score, and awards a hint once', () => {
    const game = createGame(); game.save.location = 'ekimae'; game.save.time = 'night';
    const best = scoreShot(base); recordPhoto(game, 'urasumi', best, false);
    const entry = game.save.album.urasumi;
    recordPhoto(game, 'urasumi', scoreShot({ ...base, heldMs: 0 }), false);
    expect(game.save.album.urasumi).toBe(entry);
    expect(entry?.stage).toBe(3); expect(entry?.best).toEqual(best);
    expect(game.save.hints).toEqual(['urasumi']);
  });
  it('prevents hidden full-body framing, then clears with a revealed full photo', () => {
    const game = createGame(); game.save.location = 'kawazoi'; game.save.time = 'evening';
    game.player = { x: 336, y: 372 }; game.heldMs = 1200;
    const k = createKohito('tarejiri', 336, 324);
    const hidden = evaluateCamera(game, k); expect(hidden.framing).not.toBe('full');
    recordPhoto(game, 'tarejiri', hidden, true); expect(game.save.cleared).toBe(false);
    k.fullRemaining = 8;
    const full = evaluateCamera(game, k); expect(full.framing).toBe('full');
    recordPhoto(game, 'tarejiri', full, false);
    expect(game.scene).toBe('ending'); expect(game.save.clearedDay).toBe(1);
  });
});
describe('photo', () => {
  it.each([[100, 'miss'], [80, 'partial'], [50, 'half'], [5, 'full'], [0, 'full']] as const)('overlap at %s', (x, framing) => {
    expect(scoreShot({ ...base, finder: { ...base.finder, x } }).framing).toBe(framing);
  });
  it('zero-area subjects miss', () => expect(scoreShot({ ...base, subject: { ...base.subject, w: 0 } }).coverage).toBe(0));
  it('miss always fails, even with a moment', () => expect(scoreShot({ ...base, finder: { ...base.finder, x: 101 }, moment: true })).toMatchObject({ score: 0, rank: 'fail' }));
  it.each([[0, 0], [600, 0.5], [1200, 1], [3000, 1]])('focus at %s ms', (heldMs, focus) => expect(scoreShot({ ...base, heldMs }).focus).toBe(focus));
  it.each([[20, 1], [120, 0.5], [200, 0], [300, 0]])('distance at %s', (distance, distScore) => expect(scoreShot({ ...base, distance }).distScore).toBe(distScore));
  it('perfect moment ranks S', () => expect(scoreShot({ ...base, moment: true })).toMatchObject({ score: 100, rank: 'S' }));
  it('moment adds 20 before the cap', () => {
    const shot = { ...base, heldMs: 600, distance: 120 };
    expect(scoreShot({ ...shot, moment: true }).score - scoreShot(shot).score).toBe(20);
    expect(scoreShot({ ...base, moment: true }).score).toBe(100);
  });
  it('stage two includes focus 0.6 and excludes partial', () => {
    expect(shotStage(scoreShot({ ...base, heldMs: 720 }))).toBe(2);
    expect(shotStage(scoreShot({ ...base, heldMs: 719 }))).toBe(1);
    expect(shotStage(scoreShot({ ...base, finder: { ...base.finder, x: 80 } }))).toBe(1);
  });
  it('stage three needs full and focus 0.9 or moment', () => {
    expect(shotStage(scoreShot({ ...base, heldMs: 1080 }))).toBe(3);
    expect(shotStage(scoreShot({ ...base, heldMs: 0, moment: true }))).toBe(3);
    expect(shotStage(scoreShot({ ...base, finder: { ...base.finder, x: 50 } }))).toBe(2);
  });
});
