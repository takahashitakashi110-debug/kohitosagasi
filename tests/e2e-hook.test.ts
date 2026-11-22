import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HitButton } from '../src/engine/input';

const { ui } = vi.hoisted(() => ({ ui: { buttons: [] as HitButton[] } }));
vi.mock('../src/engine/loop', () => ({ startLoop: vi.fn() }));
vi.mock('../src/engine/canvas', () => ({ initCanvas: () => ({}) }));
vi.mock('../src/render/ui', () => ({ UI: class { constructor() { return ui; } } }));

beforeEach(() => { vi.resetModules(); ui.buttons = []; });
afterEach(() => vi.unstubAllGlobals());

async function boot(search: string): Promise<Window> {
  const target = { location: { search }, addEventListener: vi.fn() };
  const canvas = { setAttribute: vi.fn(), addEventListener: vi.fn() };
  vi.stubGlobal('window', target);
  vi.stubGlobal('document', { body: { style: {} }, querySelector: () => canvas });
  await import('../src/main');
  return target as unknown as Window;
}

describe('opt-in read-only browser hook', () => {
  it.each(['', '?e2e=0', '?e2e=2', '?other=e2e%3D1'])('does not expose anything for %s', async search => {
    expect(Object.hasOwn(await boot(search), '__kohitoE2E')).toBe(false);
  });
  it('exposes only frozen reader functions when e2e=1', async () => {
    const target = await boot('?e2e=1'); const hook = target.__kohitoE2E!;
    expect(Object.keys(hook).sort()).toEqual(['buttons', 'scene']);
    expect(hook.scene()).toBe('title'); expect(Object.isFrozen(hook)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(target, '__kohitoE2E')).toMatchObject({ writable: false, configurable: false });
  });
  it('returns fresh button objects and arrays instead of internal references', async () => {
    const target = await boot('?e2e=1'); const hook = target.__kohitoE2E!;
    ui.buttons = [{ x: 1, y: 2, w: 3, h: 4, action: 'start' }];
    const copy = hook.buttons(); expect(copy).toEqual(ui.buttons); expect(copy).not.toBe(ui.buttons);
    expect(copy[0]).not.toBe(ui.buttons[0]); copy[0].x = 500; copy.push({ ...copy[0] });
    expect(hook.buttons()).toEqual([{ x: 1, y: 2, w: 3, h: 4, action: 'start' }]);
  });
});
