import { describe, expect, it, vi } from 'vitest';
import { KOHITO_IDS, createGame } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import { MASTER_VOLUME, planSound } from '../src/audio/plan';
import type { SoundEvent } from '../src/audio/plan';
import { detectSoundEvents, soundSnapshot } from '../src/audio/events';
import type { SoundSnapshot } from '../src/audio/events';
import { SoundController } from '../src/audio/controller';
import { SETTINGS_KEY, readMuted, writeMuted } from '../src/audio/settings';
import { WebAudioPlayer } from '../src/audio/player';

const events: SoundEvent[] = [
  { type: 'step', sneaking: false }, { type: 'step', sneaking: true },
  { type: 'focus', level: 0.6 }, { type: 'focus', level: 1 },
  { type: 'shutter' }, { type: 'hint' }, { type: 'escape' }, { type: 'ending' },
  ...KOHITO_IDS.map(id => ({ type: 'call' as const, id })),
];
function frame(values: Partial<SoundSnapshot> = {}): SoundSnapshot {
  return { scene: 'field', visit: '1/morning/kawazoi', x: 0, y: 0, moving: false, sneaking: false,
    cameraHeld: false, cameraTarget: 'dobunozoki', heldMs: 0, feedback: null, escapedCount: 0, kohitos: [], ...values };
}
const detect = (prev: SoundSnapshot, next: SoundSnapshot) => detectSoundEvents(prev, next, { stepDistance: 0 }).events;

describe('sound plans', () => {
  it.each(events)('keeps $type within duration, gain and frequency limits', event => {
    const notes = planSound(event);
    expect(notes.length).toBeGreaterThan(0);
    expect(MASTER_VOLUME).toBeGreaterThan(0); expect(MASTER_VOLUME).toBeLessThanOrEqual(0.3);
    for (const n of notes) {
      expect(n.duration).toBeGreaterThan(0); expect(n.duration).toBeLessThanOrEqual(1);
      expect(n.volume).toBeGreaterThan(0); expect(n.volume).toBeLessThanOrEqual(0.3);
      expect(n.delay).toBeGreaterThanOrEqual(0);
      expect(n.frequency).toBeGreaterThan(0); expect(n.endFrequency).toBeGreaterThan(0);
    }
    const total = Math.max(...notes.map(n => n.delay + n.duration));
    expect(total).toBeLessThanOrEqual(event.type === 'ending' ? 4 : 1);
    expect(planSound(event)).toEqual(notes);
  });
  it('gives all six calls different sound patterns', () => {
    const patterns = KOHITO_IDS.map(id => JSON.stringify(planSound({ type: 'call', id })));
    expect(new Set(patterns).size).toBe(6);
    expect(planSound({ type: 'call', id: 'noboriyurashi' }).every(n => n.vibrato)).toBe(true);
    expect(planSound({ type: 'call', id: 'kagebousi' })[0].wave).toBe('noise');
  });
  it('makes sneaking softer and both footsteps at most 0.08 seconds', () => {
    const normal = planSound({ type: 'step', sneaking: false })[0];
    const quiet = planSound({ type: 'step', sneaking: true })[0];
    expect(quiet.volume).toBeLessThan(normal.volume);
    expect(normal.duration).toBeLessThanOrEqual(0.08); expect(quiet.duration).toBeLessThanOrEqual(0.08);
  });
  it('puts the three ascending hint notes after both shutter clicks', () => {
    const shutterEnd = Math.max(...planSound({ type: 'shutter' }).map(n => n.delay + n.duration));
    const hint = planSound({ type: 'hint' });
    expect(hint).toHaveLength(3); expect(hint[0].delay).toBeGreaterThan(shutterEnd);
    expect(hint[0].frequency).toBeLessThan(hint[1].frequency); expect(hint[1].frequency).toBeLessThan(hint[2].frequency);
  });
});

describe('sound detection', () => {
  it.each([{ sneaking: false, distance: 220 }, { sneaking: true, distance: 340 }])('counts ten $distance px footsteps', ({ sneaking, distance }) => {
    let prev = frame({ sneaking, moving: true }); let state = { stepDistance: 0 }; const found: SoundEvent[] = [];
    for (let i = 1; i <= 100; i++) {
      const next = frame({ x: distance * i / 100, sneaking, moving: true });
      const result = detectSoundEvents(prev, next, state); found.push(...result.events); state = result.state; prev = next;
    }
    expect(found).toEqual(Array.from({ length: 10 }, () => ({ type: 'step', sneaking })));
    expect(state.stepDistance).toBeCloseTo(0);
  });
  it('uses travelled distance around corners, without changing its inputs', () => {
    const prev = frame({ moving: true }); const next = frame({ x: 12, moving: true }); const state = Object.freeze({ stepDistance: 0 });
    const a = detectSoundEvents(Object.freeze(prev), Object.freeze(next), state);
    expect(a.events).toEqual([]); expect(state.stepDistance).toBe(0);
    expect(detectSoundEvents(next, frame({ x: 12, y: 10, moving: true }), a.state).events).toEqual([{ type: 'step', sneaking: false }]);
  });
  it('keeps a partial step over a pause, and never steps while stopped or blocked', () => {
    const prev = frame({ moving: true }); const stopped = frame();
    const paused = detectSoundEvents(prev, stopped, { stepDistance: 20 });
    expect(paused.events).toEqual([]); expect(paused.state.stepDistance).toBe(20);
    expect(detectSoundEvents(stopped, frame({ x: 2, moving: true }), paused.state).events).toEqual([{ type: 'step', sneaking: false }]);
    expect(detect(frame({ moving: true }), frame({ moving: true }))).toEqual([]);
    expect(detect(frame(), frame({ x: 100 }))).toEqual([]);
  });
  it.each(['map', 'camera', 'album', 'ending', 'dayend', 'title'] as const)('does not step in %s or count a scene change as walking', scene => {
    expect(detect(frame({ scene }), frame({ scene, x: 200, moving: true })).filter(e => e.type === 'step')).toEqual([]);
    expect(detectSoundEvents(frame({ scene }), frame({ x: 200, moving: true }), { stepDistance: 21 }).state.stepDistance).toBe(0);
  });
  it('resets footsteps on travel, feedback and entering the camera', () => {
    const prev = frame({ moving: true });
    for (const next of [frame({ visit: '2/morning/kawazoi', x: 300, moving: true }), frame({ feedback: { hintGained: false } }), frame({ scene: 'camera' })]) {
      expect(detectSoundEvents(prev, next, { stepDistance: 21 }).state.stepDistance).toBe(0);
    }
  });
  it('sounds focus once per crossing, only strictly above each threshold', () => {
    let prev = frame({ scene: 'camera', cameraHeld: true }); const found: SoundEvent[] = [];
    for (const heldMs of [720, 721, 900, 1200, 1201, 1600, 4000]) {
      const next = frame({ scene: 'camera', cameraHeld: true, heldMs }); found.push(...detect(prev, next)); prev = next;
    }
    expect(found).toEqual([{ type: 'focus', level: 0.6 }, { type: 'focus', level: 1 }]);
    expect(detect(prev, frame({ scene: 'camera', cameraHeld: false, heldMs: 5000 }))).toEqual([]);
  });
  it('handles both focus crossings in a long frame and a new hold', () => {
    const held = frame({ scene: 'camera', cameraHeld: true, heldMs: 1300 });
    const tones = [{ type: 'focus', level: 0.6 }, { type: 'focus', level: 1 }];
    expect(detect(frame(), held)).toEqual(tones);
    expect(detect(frame({ scene: 'camera', cameraHeld: false, heldMs: 9000 }), held)).toEqual(tones);
    expect(detect(held, frame({ scene: 'camera', cameraHeld: true, heldMs: 0 }))).toEqual([]);
    expect(detect(frame({ scene: 'camera', cameraHeld: true, heldMs: 0 }), held)).toEqual(tones);
  });
  it.each([false, true])('plays shutter once, followed by hint only when hintGained=%s', hintGained => {
    const feedback = { hintGained }; const next = frame({ feedback });
    expect(detect(frame(), next)).toEqual(hintGained ? [{ type: 'shutter' }, { type: 'hint' }] : [{ type: 'shutter' }]);
    expect(detect(next, frame({ feedback }))).toEqual([]);
    expect(detect(next, frame())).toEqual([]);
    expect(detect(next, frame({ feedback: { hintGained } }))).toHaveLength(hintGained ? 2 : 1);
  });
  it.each(KOHITO_IDS)('calls for nearby %s only at the start of a special moment', id => {
    const kohito = { id, x: 160, y: 0, specialRemaining: 0, escaped: false, fleeing: 0 };
    const prev = frame({ kohitos: [kohito] }); const active = { ...kohito, specialRemaining: 1.5 };
    const next = frame({ kohitos: [active] });
    expect(detect(prev, next)).toEqual([{ type: 'call', id }]);
    expect(detect(next, frame({ kohitos: [{ ...active, specialRemaining: 1 }] }))).toEqual([]);
    expect(detect(prev, frame({ kohitos: [{ ...active, x: 160.01 }] }))).toEqual([]);
    expect(detect(prev, frame({ scene: 'camera', kohitos: [active] }))).toEqual([]);
    expect(detect(frame(), next)).toEqual([]);
    expect(detect(prev, frame({ kohitos: [{ ...active, escaped: true }] }))).toEqual([]);
    expect(detect(prev, frame({ kohitos: [{ ...active, fleeing: 0.6 }] }))).toEqual([]);
  });
  it('sounds escape only when the escaped count increases', () => {
    expect(detect(frame(), frame({ escapedCount: 1 }))).toEqual([{ type: 'escape' }]);
    expect(detect(frame({ escapedCount: 1 }), frame({ escapedCount: 1 }))).toEqual([]);
    expect(detect(frame({ escapedCount: 1 }), frame())).toEqual([]);
  });
  it('sounds ending only on entry, including the shutter of the final photo', () => {
    const ending = frame({ scene: 'ending' });
    expect(detect(frame(), ending)).toEqual([{ type: 'ending' }]);
    expect(detect(ending, ending)).toEqual([]);
    expect(detect(frame({ scene: 'camera' }), ending)).toEqual([{ type: 'shutter' }, { type: 'ending' }]);
  });
  it('copies mutable movement and kohito values without touching the game', () => {
    const game = createGame(); game.kohitos.push(createKohito('dobunozoki', 20, 30));
    const before = soundSnapshot(game, false);
    game.player.x += 30; game.kohitos[0].specialRemaining = 1;
    expect(before.x).toBe(288); expect(before.kohitos[0].specialRemaining).toBe(0);
    expect(soundSnapshot(game, true).cameraHeld).toBe(true);
  });
});

describe('mute and resilient settings', () => {
  function setup(raw: string | null = null) {
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const player = { unlock: vi.fn(), play: vi.fn(), silence: vi.fn() };
    const controller = new SoundController(player, () => storage);
    return { controller, player, storage };
  }
  it('passes plans to playback when enabled, and no plans when muted', () => {
    const { controller, player, storage } = setup();
    expect(controller.muted).toBe(false); controller.unlock(); expect(player.unlock).toHaveBeenCalledOnce();
    controller.play([{ type: 'shutter' }]); expect(player.play).toHaveBeenCalledWith(planSound({ type: 'shutter' }));
    controller.toggleMute(); expect(player.silence).toHaveBeenCalledOnce();
    controller.play(events); expect(player.play).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, '{"muted":true}');
    controller.toggleMute(); controller.play([{ type: 'hint' }]); expect(player.play).toHaveBeenCalledTimes(2);
  });
  it('restores mute in a new controller without passing sound to the sink', () => {
    const { controller, player, storage } = setup(); controller.toggleMute();
    const restored = new SoundController(player, () => storage);
    expect(restored.muted).toBe(true); restored.play(events); expect(player.play).not.toHaveBeenCalled();
  });
  it.each(['null', '{}', 'true', '"muted"', '{"muted":"true"}', '{broken', '{"muted":false}'])('defaults to sound on for %s', raw => {
    expect(readMuted(() => ({ getItem: () => raw, setItem() {} }))).toBe(false);
  });
  it('survives throwing storage getters and read/write methods', () => {
    const denied = () => { throw new Error('storage denied'); };
    expect(readMuted(denied)).toBe(false); expect(() => writeMuted(true, denied)).not.toThrow();
    const storage = { getItem: denied, setItem: denied };
    expect(readMuted(() => storage)).toBe(false); expect(() => writeMuted(true, () => storage)).not.toThrow();
    const player = { unlock() {}, play() {}, silence() {} }; const sound = new SoundController(player, denied);
    expect(() => sound.toggleMute()).not.toThrow(); expect(sound.muted).toBe(true);
  });
  it('does not create audio until a user gesture, and tolerates missing AudioContext', () => {
    const makeContext = vi.fn(() => { throw new Error('no AudioContext'); });
    const player = new WebAudioPlayer(makeContext); expect(makeContext).not.toHaveBeenCalled();
    expect(() => player.play(planSound({ type: 'shutter' }))).not.toThrow(); expect(makeContext).not.toHaveBeenCalled();
    expect(() => player.unlock()).not.toThrow(); expect(makeContext).toHaveBeenCalledOnce();
    expect(() => player.play(planSound({ type: 'ending' }))).not.toThrow(); expect(() => player.silence()).not.toThrow();
  });
});
