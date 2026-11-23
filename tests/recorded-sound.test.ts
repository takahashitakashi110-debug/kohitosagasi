import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundController } from '../src/audio/controller';
import { WebAudioPlayer } from '../src/audio/player';
import { planSound } from '../src/audio/plan';
import { SAMPLE_URLS } from '../src/audio/samples';

describe('generated sound cues', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses recorded cues when ready, and preserves synthesis for other events and failures', () => {
    const player = { unlock: vi.fn(), silence: vi.fn(), play: vi.fn(), playSample: vi.fn().mockReturnValue(true) };
    const controller = new SoundController(player, () => ({ getItem: () => null, setItem() {} }));
    controller.play([{ type: 'shutter' }, { type: 'hint' }, { type: 'resident' }, { type: 'ending' }]);
    expect(player.playSample.mock.calls.map(c => c[0])).toEqual(['shutter', 'hint', 'resident', 'ending']);
    expect(player.play).not.toHaveBeenCalled();
    player.playSample.mockReturnValue(false);
    controller.play([{ type: 'shutter' }, { type: 'step', sneaking: true }]);
    expect(player.play.mock.calls.map(c => c[0])).toEqual([planSound({ type: 'shutter' }), planSound({ type: 'step', sneaking: true })]);
    controller.toggleMute(); controller.play([{ type: 'ending' }]);
    expect(player.silence).toHaveBeenCalledOnce(); expect(player.playSample).toHaveBeenCalledTimes(5);
  });
  it('loads only after user unlock and stops all recorded voices including delayed cues on mute', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    vi.stubGlobal('window', {}); vi.stubGlobal('fetch', fetcher);
    const starts: number[] = []; const stops: number[] = [];
    const context = { state: 'running', currentTime: 10, destination: {},
      createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }),
      decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
      createBufferSource: () => ({ buffer: null, onended: null, connect() {}, disconnect() {}, start: (t: number) => starts.push(t), stop: () => stops.push(1) }),
    };
    const player = new WebAudioPlayer(() => context as unknown as AudioContext);
    expect(fetcher).not.toHaveBeenCalled(); expect(player.playSample('shutter')).toBe(false);
    player.unlock();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(4));
    await vi.waitFor(() => expect(player.playSample('shutter')).toBe(true));
    expect(player.playSample('hint')).toBe(true); expect(player.playSample('ending')).toBe(true);
    expect(starts).toEqual([10, 10.18, 12]);
    player.silence(); expect(stops).toHaveLength(3);
    player.silence(); expect(stops).toHaveLength(3);
    player.unlock(); expect(fetcher).toHaveBeenCalledTimes(4);
    for (const call of fetcher.mock.calls) expect(Object.values(SAMPLE_URLS)).toContain(call[0]);
    const failed = { buffer: null, onended: null, connect() {}, disconnect: vi.fn(), start() { throw new Error('cannot schedule'); }, stop: vi.fn() };
    context.createBufferSource = () => failed;
    expect(player.playSample('shutter')).toBe(false);
    expect(failed.disconnect).toHaveBeenCalledOnce(); expect(failed.stop).toHaveBeenCalledOnce();
    player.silence(); expect(failed.stop).toHaveBeenCalledOnce();
  });
  it('keeps the fallback available when a sound cannot be downloaded or decoded', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const context = { state: 'running', currentTime: 0, destination: {}, createGain: () => ({ gain: { value: 0 }, connect() {} }) };
    const player = new WebAudioPlayer(() => context as unknown as AudioContext);
    player.unlock(); await Promise.resolve(); await Promise.resolve();
    expect(player.playSample('hint')).toBe(false); expect(() => player.silence()).not.toThrow();
  });
});
