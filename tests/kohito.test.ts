import { describe, expect, it } from 'vitest';
import { createKohito, tickKohito, updateAwareness } from '../src/game/kohito';
import { advanceLocation, freshSave, nextDay } from '../src/game/state';
import { SPOTS } from '../src/data/spots';
import { KOHITO } from '../src/data/kohito';
import { blocked, fieldCamera, movePlayer } from '../src/game/world';
const still = { distance: 80, moving: false, sneaking: false, cameraHeld: false };
describe('world', () => {
  it('has four 24 by 32 maps and open subject approach positions', () => {
    for (const tiles of Object.values(SPOTS)) {
      expect(tiles).toHaveLength(32); expect(tiles.every(row => row.length === 24)).toBe(true);
      expect(blocked(tiles, 288, 420)).toBe(false);
    }
    for (const def of Object.values(KOHITO)) expect(blocked(SPOTS[def.spot], def.x, def.y + 48)).toBe(false);
  });
  it('slides along walls and clamps the camera at both map edges', () => {
    const player = { x: 30, y: 400 };
    movePlayer(player, { x: -1, y: 1 }, false, 0.1, SPOTS.shoutengai);
    expect(player).toEqual({ x: 30, y: 407 });
    expect(fieldCamera({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(fieldCamera({ x: 576, y: 768 })).toEqual({ x: 216, y: 128 });
  });
});
describe('awareness and behavior', () => {
  it('standing still makes no noise and recovers', () => expect(updateAwareness(0.5, { ...still, distance: 0 }, 1)).toBeCloseTo(0.3));
  it('walking uses radius 90 and rate 0.5', () => expect(updateAwareness(0, { ...still, distance: 45, moving: true }, 1)).toBeCloseTo(0.25));
  it('sneaking uses radius 30 and rate 0.25', () => expect(updateAwareness(0, { ...still, distance: 15, moving: true, sneaking: true }, 1)).toBeCloseTo(0.125));
  it('camera adds its rate, but not decay', () => expect(updateAwareness(0.2, { ...still, cameraHeld: true }, 1)).toBeCloseTo(0.375));
  it('outside both radii awareness recovers', () => expect(updateAwareness(0.5, { ...still, distance: 160, cameraHeld: true, moving: true }, 1)).toBeCloseTo(0.3));
  it('clamps to zero and one', () => {
    expect(updateAwareness(0, still, 1)).toBe(0);
    expect(updateAwareness(0.9, { ...still, distance: 0, cameraHeld: true }, 1)).toBe(1);
  });
  it('flee animation lasts 0.6 seconds', () => {
    const k = createKohito('urasumi', 0, 0); k.awareness = 0.99;
    tickKohito(k, { ...still, distance: 0, cameraHeld: true }, 0.1);
    expect(k.fleeing).toBe(0.6); expect(k.escaped).toBe(false);
    tickKohito(k, still, 0.59); expect(k.escaped).toBe(false);
    tickKohito(k, still, 0.02); expect(k.escaped).toBe(true);
  });
  it('special actions roll at 6s, probability boundary 25%, and last 1.5s', () => {
    const k = createKohito('urasumi', 0, 0);
    tickKohito(k, still, 5.99, () => 0); expect(k.specialRemaining).toBe(0);
    tickKohito(k, still, 0.01, () => 0.249); expect(k.specialRemaining).toBe(1.5);
    tickKohito(k, still, 1.5); expect(k.specialRemaining).toBe(0);
    const other = createKohito('urasumi', 0, 0); tickKohito(other, still, 6, () => 0.25); expect(other.specialRemaining).toBe(0);
  });
  it('tarejiri needs four continuous quiet seconds and stays out eight', () => {
    const k = createKohito('tarejiri', 0, 0);
    tickKohito(k, still, 3); tickKohito(k, { ...still, distance: 59 }, 0.1);
    tickKohito(k, still, 3.9); expect(k.fullRemaining).toBe(0);
    tickKohito(k, still, 0.1); expect(k.fullRemaining).toBe(8);
    tickKohito(k, still, 8); expect(k.fullRemaining).toBe(0);
  });
  it('high awareness interrupts the reveal', () => {
    const k = createKohito('tarejiri', 0, 0); k.revealWait = 3; k.awareness = 0.6;
    tickKohito(k, { ...still, cameraHeld: true }, 0.1); expect(k.revealWait).toBe(0);
  });
});
describe('daily route', () => {
  it('first outing stays morning; same spot stays; three changes reach night; then home', () => {
    const save = freshSave();
    advanceLocation(save, 'kawazoi'); expect(save.time).toBe('morning');
    advanceLocation(save, 'kawazoi'); expect(save.time).toBe('morning');
    advanceLocation(save, 'shoutengai'); expect(save.time).toBe('noon');
    advanceLocation(save, 'kawazoi'); expect(save.time).toBe('evening');
    advanceLocation(save, 'ekimae'); expect(save.time).toBe('night');
    expect(advanceLocation(save, 'danchi')).toBe('dayend'); expect(save.location).toBe('home');
    nextDay(save); expect(save.day).toBe(2); expect(save.time).toBe('morning');
  });
});
