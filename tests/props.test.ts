import { describe, expect, it, vi } from 'vitest';
import { PROPS } from '../src/data/props';
import { KOHITO } from '../src/data/kohito';
import { MAP_COLS, MAP_ROWS, SPAWN, SPOTS, TILE_SIZE } from '../src/data/spots';
import { SPOT_IDS } from '../src/game/state';
import { drawProp, drawProps } from '../src/render/props';
import type { Prop } from '../src/data/props';

interface Bounds { left: number; top: number; right: number; bottom: number }
interface Paint { bounds: Bounds; halfStroke: number }
interface DrawingState {
  x: number; y: number; fillStyle: string; strokeStyle: string; globalAlpha: number;
  lineWidth: number; lineCap: CanvasLineCap; lineJoin: CanvasLineJoin;
}

/** 今回使う図形を記録する。パスはsave/restoreで戻さず、変換した制御点も安全側に含める。 */
class PropContext {
  x = 0; y = 0; fillStyle = '#000000'; strokeStyle = '#000000'; globalAlpha = 1;
  lineWidth = 1; lineCap: CanvasLineCap = 'butt'; lineJoin: CanvasLineJoin = 'miter';
  readonly paints: Paint[] = [];
  calls = 0;
  private path: Bounds | undefined;
  private stack: DrawingState[] = [];
  state(): DrawingState {
    const { x, y, fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin } = this;
    return { x, y, fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin };
  }
  save(): void { this.stack.push(this.state()); }
  restore(): void { const state = this.stack.pop(); if (state) Object.assign(this, state); }
  translate(x: number, y: number): void { this.x += x; this.y += y; }
  beginPath(): void { this.path = undefined; }
  closePath(): void { /* 始点への線は既存の外接矩形内。 */ }
  private include(x: number, y: number): void {
    x += this.x; y += this.y;
    if (!this.path) this.path = { left: x, top: y, right: x, bottom: y };
    else {
      this.path.left = Math.min(this.path.left, x); this.path.top = Math.min(this.path.top, y);
      this.path.right = Math.max(this.path.right, x); this.path.bottom = Math.max(this.path.bottom, y);
    }
  }
  moveTo(x: number, y: number): void { this.include(x, y); }
  lineTo(x: number, y: number): void { this.include(x, y); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void { this.include(cx, cy); this.include(x, y); }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number): void {
    if (start !== 0 || end !== Math.PI * 2) throw new Error('Partial ellipses need a recorder implementation');
    const ex = Math.hypot(rx * Math.cos(rotation), ry * Math.sin(rotation));
    const ey = Math.hypot(rx * Math.sin(rotation), ry * Math.cos(rotation));
    this.include(x - ex, y - ey); this.include(x + ex, y + ey);
  }
  private paint(bounds: Bounds | undefined, stroke: boolean): void {
    this.calls++;
    if (!bounds || this.globalAlpha === 0) return;
    const pad = stroke ? this.lineWidth / 2 : 0;
    this.paints.push({ halfStroke: pad, bounds: {
      left: bounds.left - pad, top: bounds.top - pad, right: bounds.right + pad, bottom: bounds.bottom + pad,
    } });
  }
  fill(): void { this.paint(this.path, false); }
  stroke(): void { this.paint(this.path, true); }
  private rectangle(x: number, y: number, w: number, h: number): Bounds {
    return { left: this.x + Math.min(x, x + w), top: this.y + Math.min(y, y + h),
      right: this.x + Math.max(x, x + w), bottom: this.y + Math.max(y, y + h) };
  }
  fillRect(x: number, y: number, w: number, h: number): void { this.paint(this.rectangle(x, y, w, h), false); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.paint(this.rectangle(x, y, w, h), true); }
}

function trace(): { recorder: PropContext; context: CanvasRenderingContext2D; commands: unknown[][] } {
  const recorder = new PropContext(); const commands: unknown[][] = [];
  const context = new Proxy(recorder as unknown as CanvasRenderingContext2D, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => { commands.push([String(key), ...args]); return Reflect.apply(value, target, args); };
    },
    set(target, key, value: unknown) { commands.push(['set', String(key), value]); return Reflect.set(target, key, value, target); },
  });
  return { recorder, context, commands };
}
function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
function separation(point: { x: number; y: number }, prop: Prop): number {
  const dx = Math.max(prop.x - point.x, 0, point.x - prop.x - prop.w);
  const dy = Math.max(prop.y - point.y, 0, point.y - prop.y - prop.h);
  return Math.hypot(dx, dy);
}

describe('prop recorder', () => {
  it('restores translation/styles without discarding paths, and includes stroke thickness', () => {
    const c = new PropContext(); c.save(); c.translate(10, 20); c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 7); c.stroke(); c.restore();
    expect(c.paints[0]).toEqual({ halfStroke: 2, bounds: { left: 8, top: 18, right: 17, bottom: 29 } });
    c.fill();
    expect(c.paints[1].bounds).toEqual({ left: 10, top: 20, right: 15, bottom: 27 });
    expect(c.state()).toEqual(new PropContext().state());
  });
  it('includes curve control points and the rotated extent of an ellipse', () => {
    const c = new PropContext(); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-5, -7, 3, 4); c.fill();
    expect(c.paints[0].bounds).toEqual({ left: -5, top: -7, right: 3, bottom: 4 });
    c.beginPath(); c.ellipse(0, 0, 4, 2, Math.PI / 2, 0, Math.PI * 2); c.fill();
    expect(c.paints[1].bounds.left).toBeCloseTo(-2); expect(c.paints[1].bounds.bottom).toBeCloseTo(4);
  });
});

describe.each(SPOT_IDS)('%s prop layout', spot => {
  const props = PROPS[spot];
  it('has 8–14 props and at least four kinds', () => {
    expect(props.length).toBeGreaterThanOrEqual(8); expect(props.length).toBeLessThanOrEqual(14);
    expect(new Set(props.map(prop => prop.kind)).size).toBeGreaterThanOrEqual(4);
  });
  it('keeps positive, finite rectangles inside the whole map', () => {
    for (const prop of props) {
      expect([prop.x, prop.y, prop.w, prop.h].every(Number.isFinite)).toBe(true);
      expect(prop.w).toBeGreaterThan(0); expect(prop.h).toBeGreaterThan(0);
      expect(prop.x).toBeGreaterThanOrEqual(0); expect(prop.y).toBeGreaterThanOrEqual(0);
      expect(prop.x + prop.w).toBeLessThanOrEqual(MAP_COLS * TILE_SIZE);
      expect(prop.y + prop.h).toBeLessThanOrEqual(MAP_ROWS * TILE_SIZE);
    }
  });
  it('puts every obstacle-looking rectangle entirely on blocked tiles', () => {
    for (const prop of props.filter(prop => prop.solid)) {
      for (let row = Math.floor(prop.y / TILE_SIZE); row < Math.ceil((prop.y + prop.h) / TILE_SIZE); row++) {
        for (let col = Math.floor(prop.x / TILE_SIZE); col < Math.ceil((prop.x + prop.w) / TILE_SIZE); col++) {
          expect([1, 3], `${prop.kind} (${row},${col})`).toContain(SPOTS[spot][row][col]);
        }
      }
    }
  });
  it('stays at least 48px from every kohito in the spot, including both river inhabitants', () => {
    const inhabitants = Object.values(KOHITO).filter(k => k.spot === spot);
    for (const prop of props) for (const kohito of inhabitants) {
      expect(separation(kohito, prop), `${prop.kind} vs ${kohito.id}`).toBeGreaterThanOrEqual(48);
    }
  });
  it('stays at least 48px from SPAWN', () => {
    for (const prop of props) expect(separation(SPAWN, prop), prop.kind).toBeGreaterThanOrEqual(48);
  });
  it('does not overlap the existing landmark area', () => {
    for (const prop of props) expect(overlap(prop, { x: 240, y: 180, w: 150, h: 170 }), prop.kind).toBe(false);
  });
  it('does not overlap any other decoration', () => {
    for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
      expect(overlap(props[i], props[j]), `${props[i].kind} vs ${props[j].kind}`).toBe(false);
    }
  });
  it('draws identical commands for identical arguments without using random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Random decoration'); });
    try {
      const a = trace(); const b = trace(); drawProps(a.context, spot); drawProps(b.context, spot);
      expect(a.commands.length).toBeGreaterThan(0); expect(a.commands).toEqual(b.commands);
    } finally { random.mockRestore(); }
  });
  it('uses at most 160 fill/stroke operations for the entire spot', () => {
    const { context, recorder } = trace(); drawProps(context, spot);
    expect(recorder.calls).toBeGreaterThan(0); expect(recorder.calls).toBeLessThanOrEqual(160);
  });
  it('preserves the caller drawing state for the existing landmarks', () => {
    const { context, recorder } = trace();
    context.translate(5, 8); context.globalAlpha = 0.73; context.lineWidth = 3;
    context.fillStyle = '#123456'; context.strokeStyle = '#654321'; const before = recorder.state();
    drawProps(context, spot); expect(recorder.state()).toEqual(before);
  });
});

describe('prop drawing bounds', () => {
  const cases = SPOT_IDS.flatMap(spot => PROPS[spot].map((prop, index) => ({ spot, index, ...prop })));
  it.each(cases)('$spot #$index $kind stays in its own rectangle', prop => {
    const { context, recorder } = trace(); drawProp(context, prop);
    expect(recorder.paints.length).toBeGreaterThan(0);
    for (const { bounds: b, halfStroke } of recorder.paints) {
      expect(b.left).toBeGreaterThanOrEqual(prop.x - halfStroke - 1e-9);
      expect(b.top).toBeGreaterThanOrEqual(prop.y - halfStroke - 1e-9);
      expect(b.right).toBeLessThanOrEqual(prop.x + prop.w + halfStroke + 1e-9);
      expect(b.bottom).toBeLessThanOrEqual(prop.y + prop.h + halfStroke + 1e-9);
    }
  });
});
