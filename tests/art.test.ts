import { describe, expect, it } from 'vitest';
import { drawKohito } from '../src/render/kohitoArt';
import { P } from '../src/render/palette';
import { UI } from '../src/render/ui';
import { KOHITO_IDS } from '../src/game/state';
import type { KohitoId } from '../src/game/state';
import { SUBJECT_BOUNDS } from '../src/data/kohito';

type Matrix = [number, number, number, number, number, number];
interface Bounds { left: number; top: number; right: number; bottom: number }
interface Ellipse { x: number; y: number; rx: number; ry: number }
interface State {
  matrix: Matrix; fillStyle: string; strokeStyle: string; lineWidth: number;
  globalAlpha: number; lineCap: CanvasLineCap; lineJoin: CanvasLineJoin;
}

/** 制御点も含む安全側の外接矩形。パスはsave/restoreの対象外（Canvasと同じ）。 */
class RecordingContext {
  private state: State = {
    matrix: [1, 0, 0, 1, 0, 0], fillStyle: '#000000', strokeStyle: '#000000',
    lineWidth: 1, globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
  };
  private stack: State[] = [];
  private path: Bounds | undefined;
  private ellipses: Ellipse[] = [];
  readonly painted: Bounds[] = [];
  readonly colored: { color: string; stroke: boolean; bounds: Bounds }[] = [];
  readonly whiteEllipses: Ellipse[] = [];
  readonly translations: { x: number; y: number }[] = [];
  drawCalls = 0;

  get fillStyle(): string { return this.state.fillStyle; }
  set fillStyle(value: string) { this.state.fillStyle = value; }
  get strokeStyle(): string { return this.state.strokeStyle; }
  set strokeStyle(value: string) { this.state.strokeStyle = value; }
  get lineWidth(): number { return this.state.lineWidth; }
  set lineWidth(value: number) { this.state.lineWidth = value; }
  get globalAlpha(): number { return this.state.globalAlpha; }
  set globalAlpha(value: number) { this.state.globalAlpha = value; }
  get lineCap(): CanvasLineCap { return this.state.lineCap; }
  set lineCap(value: CanvasLineCap) { this.state.lineCap = value; }
  get lineJoin(): CanvasLineJoin { return this.state.lineJoin; }
  set lineJoin(value: CanvasLineJoin) { this.state.lineJoin = value; }

  save(): void { this.stack.push({ ...this.state, matrix: [...this.state.matrix] }); }
  restore(): void { const saved = this.stack.pop(); if (saved) this.state = saved; }
  private transform([a, b, c, d, e, f]: Matrix): void {
    const [A, B, C, D, E, F] = this.state.matrix;
    this.state.matrix = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d,
      A * e + C * f + E, B * e + D * f + F];
  }
  translate(x: number, y: number): void {
    this.translations.push({ x, y }); this.transform([1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number): void { this.transform([x, 0, 0, y, 0, 0]); }
  rotate(angle: number): void {
    this.transform([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
  }
  private point(x: number, y: number): { x: number; y: number } {
    const [a, b, c, d, e, f] = this.state.matrix;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }
  private include(x: number, y: number): void {
    if (!this.path) this.path = { left: x, top: y, right: x, bottom: y };
    else {
      this.path.left = Math.min(this.path.left, x); this.path.right = Math.max(this.path.right, x);
      this.path.top = Math.min(this.path.top, y); this.path.bottom = Math.max(this.path.bottom, y);
    }
  }
  beginPath(): void { this.path = undefined; this.ellipses = []; }
  closePath(): void { /* 閉じる線は既存の外接矩形内に収まる。 */ }
  moveTo(x: number, y: number): void { const p = this.point(x, y); this.include(p.x, p.y); }
  lineTo(x: number, y: number): void { this.moveTo(x, y); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.moveTo(cx, cy); this.moveTo(x, y);
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.moveTo(c1x, c1y); this.moveTo(c2x, c2y); this.moveTo(x, y);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y); this.moveTo(x + w, y); this.moveTo(x + w, y + h); this.moveTo(x, y + h);
  }
  roundRect(x: number, y: number, w: number, h: number, _radii?: number | number[]): void {
    this.rect(x, y, w, h);
  }
  arc(x: number, y: number, r: number, start: number, end: number, ccw = false): void {
    this.ellipse(x, y, r, r, 0, start, end, ccw);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, ccw = false): void {
    this.ellipses.push({ x, y, rx, ry });
    const [a, b, c, d] = this.state.matrix;
    const origin = this.point(x, y);
    // 変換後の楕円 = origin + u*cos(t) + v*sin(t)。両軸の極値を調べる。
    const co = Math.cos(rotation); const si = Math.sin(rotation);
    const u = { x: rx * (a * co + c * si), y: rx * (b * co + d * si) };
    const v = { x: ry * (-a * si + c * co), y: ry * (-b * si + d * co) };
    const tau = Math.PI * 2;
    const mod = (n: number): number => (n % tau + tau) % tau;
    const sweep = ccw ? start - end : end - start;
    const full = sweep >= tau;
    const within = (t: number): boolean => full || mod(ccw ? start - t : t - start) <= mod(sweep) + 1e-10;
    const tx = Math.atan2(v.x, u.x); const ty = Math.atan2(v.y, u.y);
    for (const t of [start, end, ...[tx, tx + Math.PI, ty, ty + Math.PI].filter(within)]) {
      this.include(origin.x + u.x * Math.cos(t) + v.x * Math.sin(t),
        origin.y + u.y * Math.cos(t) + v.y * Math.sin(t));
    }
  }
  private record(bounds: Bounds | undefined, color: string, stroke: boolean): void {
    this.drawCalls++;
    if (!bounds || color === P.shadow || this.globalAlpha === 0) return;
    const [a, b, c, d] = this.state.matrix;
    const px = stroke ? Math.hypot(a, c) * this.lineWidth / 2 : 0;
    const py = stroke ? Math.hypot(b, d) * this.lineWidth / 2 : 0;
    this.painted.push({ left: bounds.left - px, top: bounds.top - py,
      right: bounds.right + px, bottom: bounds.bottom + py });
    this.colored.push({ color, stroke, bounds: this.painted[this.painted.length - 1] });
  }
  fill(): void {
    this.record(this.path, this.fillStyle, false);
    if (this.fillStyle === P.white && this.globalAlpha > 0) this.whiteEllipses.push(...this.ellipses);
  }
  stroke(): void { this.record(this.path, this.strokeStyle, true); }
  fillText(_value: string, _x: number, _y: number): void { /* UIの文字は図形の範囲集計から除く。 */ }
  private rectangle(x: number, y: number, w: number, h: number): Bounds {
    const points = [this.point(x, y), this.point(x + w, y), this.point(x, y + h), this.point(x + w, y + h)];
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.record(this.rectangle(x, y, w, h), this.fillStyle, false);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.record(this.rectangle(x, y, w, h), this.strokeStyle, true);
  }
  bounds(offset = { x: 0, y: 0 }): Bounds {
    return { left: Math.min(...this.painted.map(p => p.left)) - offset.x,
      right: Math.max(...this.painted.map(p => p.right)) - offset.x,
      top: Math.min(...this.painted.map(p => p.top)) - offset.y,
      bottom: Math.max(...this.painted.map(p => p.bottom)) - offset.y };
  }
}

function recordingContext(nativeRoundRect = true): RecordingContext {
  const c = new RecordingContext();
  if (!nativeRoundRect) Object.defineProperty(c, 'roundRect', { value: undefined });
  return c;
}
function draw(id: KohitoId, elapsed = 0, special = false, hidden = false, nativeRoundRect = true): RecordingContext {
  const c = recordingContext(nativeRoundRect);
  drawKohito(c as unknown as CanvasRenderingContext2D, id, 0, 0, elapsed, special, hidden);
  return c;
}
function localBounds(c: RecordingContext): Bounds {
  // 描画から観測した最初のtranslateを引く。上下ゆれの式は複製しない。
  return c.bounds(c.translations[0]);
}
const otherIds = KOHITO_IDS.filter(id => id !== 'tarejiri');
const states = KOHITO_IDS.flatMap(id => [false, true].flatMap(special =>
  (id === 'tarejiri' ? [false, true] : [false]).map(hidden => ({ id, special, hidden }))));

describe('recording context', () => {
  it('tracks composed transforms and restores styles and the matrix', () => {
    const c = new RecordingContext();
    c.translate(10, 20); c.save(); c.scale(2, 3); c.rotate(Math.PI / 2);
    c.fillRect(0, 0, 2, 4);
    expect(c.bounds().left).toBeCloseTo(2); expect(c.bounds().bottom).toBeCloseTo(26);
    c.fillStyle = P.shadow; c.lineWidth = 8; c.globalAlpha = 0.4; c.restore();
    expect(c.fillStyle).toBe('#000000'); expect(c.lineWidth).toBe(1); expect(c.globalAlpha).toBe(1);
    c.fillRect(0, 0, 1, 1);
    expect(c.painted.at(-1)).toEqual({ left: 10, top: 20, right: 11, bottom: 21 });
  });
  it('includes curve control points, excludes shadows, and preserves paths across restore', () => {
    const c = new RecordingContext(); c.beginPath(); c.moveTo(0, 0); c.save();
    c.quadraticCurveTo(-10, -20, 1, 1); c.bezierCurveTo(30, 40, 5, 6, 2, 2); c.restore(); c.fill();
    c.fillStyle = P.shadow; c.fillRect(-100, -100, 200, 200);
    expect(c.bounds()).toEqual({ left: -10, top: -20, right: 30, bottom: 40 });
  });
  it('bounds rotated ellipses and scales stroke padding', () => {
    const c = new RecordingContext(); c.scale(2, 3); c.beginPath();
    c.ellipse(0, 0, 4, 2, Math.PI / 2, 0, Math.PI * 2); c.lineWidth = 2; c.stroke();
    expect(c.bounds().left).toBeCloseTo(-6); expect(c.bounds().right).toBeCloseTo(6);
    expect(c.bounds().top).toBeCloseTo(-15); expect(c.bounds().bottom).toBeCloseTo(15);
  });
  it('does not expand a semicircle into a full circle', () => {
    const c = new RecordingContext(); c.beginPath(); c.arc(0, 0, 4, Math.PI, 2 * Math.PI); c.closePath(); c.fill();
    expect(c.bounds().top).toBeCloseTo(-4); expect(c.bounds().bottom).toBeCloseTo(0);
  });
});

describe('art bounds and drawing budget', () => {
  const variants = states.flatMap(state => [true, false].map(nativeRoundRect => ({ ...state, nativeRoundRect })));
  it.each(variants)('$id special=$special hidden=$hidden nativeRoundRect=$nativeRoundRect stays within the scoring rectangle at all 61 times', ({ id, special, hidden, nativeRoundRect }) => {
    const subject = SUBJECT_BOUNDS[id];
    const limit = id !== 'tarejiri' ? { left: subject.left, top: subject.top, right: subject.left + subject.w, bottom: subject.top + subject.h }
      : hidden ? { left: -6, top: -7, right: 20, bottom: 20 }
        : { left: -15, top: -37, right: 20, bottom: 25 };
    for (let tick = 0; tick <= 60; tick++) {
      const c = draw(id, tick / 10, special, hidden, nativeRoundRect); const b = localBounds(c);
      const message = `${id}, t=${tick / 10}, special=${special}, hidden=${hidden}: ${JSON.stringify(b)}`;
      expect(b.left, message).toBeGreaterThanOrEqual(limit.left - 1e-9);
      expect(b.top, message).toBeGreaterThanOrEqual(limit.top - 1e-9);
      expect(b.right, message).toBeLessThanOrEqual(limit.right + 1e-9);
      expect(b.bottom, message).toBeLessThanOrEqual(limit.bottom + 1e-9);
      expect(c.drawCalls, message).toBeLessThanOrEqual(30);
    }
  });
});

describe('subject bounds fit the art', () => {
  it.each(KOHITO_IDS)('%s stays inside the previous rectangle; tarejiri is unchanged', id => {
    const subject = SUBJECT_BOUNDS[id];
    if (id === 'tarejiri') {
      expect(subject).toEqual({ left: -15, top: -37, w: 35, h: 62 });
    } else {
      expect(subject.left).toBeGreaterThanOrEqual(-20);
      expect(subject.top).toBeGreaterThanOrEqual(-30);
      expect(subject.left + subject.w).toBeLessThanOrEqual(24);
      expect(subject.top + subject.h).toBeLessThanOrEqual(16);
    }
  });
  it.each(otherIds)('%s leaves no more than 3 units on any side of all animation poses combined', id => {
    const drawings = [false, true].flatMap(special => Array.from({ length: 61 }, (_, tick) =>
      localBounds(draw(id, tick / 10, special))));
    const subject = SUBJECT_BOUNDS[id];
    const gaps = {
      left: Math.min(...drawings.map(b => b.left)) - subject.left,
      top: Math.min(...drawings.map(b => b.top)) - subject.top,
      right: subject.left + subject.w - Math.max(...drawings.map(b => b.right)),
      bottom: subject.top + subject.h - Math.max(...drawings.map(b => b.bottom)),
    };
    for (const [side, gap] of Object.entries(gaps)) {
      expect(gap, `${id} ${side}`).toBeGreaterThanOrEqual(-1e-9);
      expect(gap, `${id} ${side}`).toBeLessThanOrEqual(3 + 1e-9);
    }
  });
});

describe('UI rounded rectangles', () => {
  it.each([true, false])('draws panels and buttons, nativeRoundRect=%s', nativeRoundRect => {
    const c = recordingContext(nativeRoundRect);
    if (!nativeRoundRect) expect(c.roundRect).toBeUndefined();
    const ui = new UI(c as unknown as CanvasRenderingContext2D);
    expect(() => {
      ui.panel(10, 20, 100, 40);
      ui.button('test', 'test-action', 20, 80, 120, 44, true);
    }).not.toThrow();
    expect(c.painted).toHaveLength(3);
    expect(c.painted[0]).toEqual({ left: 10, top: 20, right: 110, bottom: 60 });
    expect(c.painted[1]).toEqual({ left: 20, top: 80, right: 140, bottom: 124 });
    expect(c.painted[2]).toEqual({ left: 19.5, top: 79.5, right: 140.5, bottom: 124.5 });
    expect(ui.buttons).toEqual([{ x: 20, y: 80, w: 120, h: 44, action: 'test-action' }]);
  });
});

describe('distinct silhouettes', () => {
  it.each(otherIds)('%s does not paint the former shared white dot in either state', id => {
    for (const special of [false, true]) for (let tick = 0; tick <= 60; tick++) {
      expect(draw(id, tick / 10, special).whiteEllipses).not.toContainEqual({ x: 4, y: -6, rx: 3, ry: 1.5 });
    }
  });
  const targets: { id: KohitoId; height: [number, number]; width: [number, number] }[] = [
    { id: 'urasumi', height: [20, 24], width: [36, 42] },
    { id: 'haritsuki', height: [40, 44], width: [16, 20] },
    { id: 'dobunozoki', height: [14, 18], width: [24, 28] },
    { id: 'noboriyurashi', height: [42, 46], width: [30, 40] },
    { id: 'kagebousi', height: [30, 34], width: [18, 26] },
    { id: 'tarejiri', height: [55, 60], width: [30, 35] },
  ];
  it.each(targets)('$id has the requested height and width at elapsed=0', ({ id, height, width }) => {
    const b = localBounds(draw(id));
    expect(b.bottom - b.top).toBeGreaterThanOrEqual(height[0]);
    expect(b.bottom - b.top).toBeLessThanOrEqual(height[1]);
    expect(b.right - b.left).toBeGreaterThanOrEqual(width[0]);
    expect(b.right - b.left).toBeLessThanOrEqual(width[1]);
  });
  it('every pair of ordinary kohitos differs by at least 6 in width or height', () => {
    for (let i = 0; i < otherIds.length; i++) for (let j = i + 1; j < otherIds.length; j++) {
      const a = localBounds(draw(otherIds[i])); const b = localBounds(draw(otherIds[j]));
      const widthDifference = Math.abs((a.right - a.left) - (b.right - b.left));
      const heightDifference = Math.abs((a.bottom - a.top) - (b.bottom - b.top));
      expect(Math.max(widthDifference, heightDifference), `${otherIds[i]} vs ${otherIds[j]}`).toBeGreaterThanOrEqual(6);
    }
  });
  it('hidden tarejiri paints only the rump region, for every animation time and state', () => {
    for (const special of [false, true]) for (let tick = 0; tick <= 60; tick++) {
      const c = draw('tarejiri', tick / 10, special, true);
      const offset = c.translations[0];
      for (const b of c.painted) {
        expect(b.left - offset.x).toBeGreaterThanOrEqual(-6 - 1e-9);
        expect(b.top - offset.y).toBeGreaterThanOrEqual(-7 - 1e-9);
      }
    }
  });
});

describe('noboriyurashi hugging the flag', () => {
  it('keeps the wrapped red cloth at x <= 4 throughout the special moment', () => {
    for (let tick = 0; tick <= 60; tick++) {
      const cloth = draw('noboriyurashi', tick / 10, true).colored.filter(paint => paint.color === P.red);
      expect(cloth.length).toBeGreaterThan(0);
      expect(Math.max(...cloth.map(paint => paint.bounds.right)), `elapsed=${tick / 10}`).toBeLessThanOrEqual(4);
    }
  });
  it('still lets the ordinary red cloth extend to x >= 15 at all 61 times', () => {
    for (let tick = 0; tick <= 60; tick++) {
      const cloth = draw('noboriyurashi', tick / 10).colored.filter(paint => paint.color === P.red);
      expect(cloth.length).toBeGreaterThan(0);
      expect(Math.max(...cloth.map(paint => paint.bounds.right)), `elapsed=${tick / 10}`).toBeGreaterThanOrEqual(15);
    }
  });
  it('draws two drops and three closed eyes during the special moment', () => {
    for (let tick = 0; tick <= 60; tick++) {
      const paints = draw('noboriyurashi', tick / 10, true).colored;
      expect(paints.filter(paint => paint.color === P.water && !paint.stroke)).toHaveLength(2);
      expect(paints.filter(paint => paint.color === P.ink && paint.stroke)).toHaveLength(3);
      expect(paints.filter(paint => paint.color === P.ink && !paint.stroke)).toHaveLength(0);
    }
  });
  it('preserves the complete ordinary command and style trace at elapsed=0', () => {
    // 変更前の9517219を実ブラウザで記録した固定値。現在の実装から生成し直さない。
    const originalCommands: unknown[][] = [
      ['save'], ['translate', 0, 0], ['set', 'fillStyle', '#2d3d4440'], ['beginPath'],
      ['ellipse', 0, 12, 15, 4, 0, 0, 6.283185307179586], ['fill'],
      ['set', 'globalAlpha', 0.48], ['set', 'fillStyle', '#ac6157'], ['beginPath'],
      ['moveTo', -5, -23], ['quadraticCurveTo', 8, -24, 19, -21],
      ['lineTo', 20.682941969615793, -12], ['lineTo', 20.818594853651362, -3],
      ['lineTo', 19.282240016119733, 6], ['quadraticCurveTo', 7, 3, -5, 8], ['closePath'], ['fill'],
      ['set', 'globalAlpha', 0.9], ['set', 'fillStyle', '#babdaf'], ['beginPath'],
      ['moveTo', -12, -25], ['lineTo', -5, -25], ['lineTo', -5, 15], ['lineTo', -12, 15], ['closePath'], ['fill'],
      ['set', 'fillStyle', '#dce3bd'], ['beginPath'], ['ellipse', -8.5, -25, 3.5, 4, 0, 0, 6.283185307179586], ['fill'],
      ['set', 'fillStyle', '#303d39'], ['beginPath'], ['ellipse', -8.5, -26, 0.9, 0.9, 0, 0, 6.283185307179586], ['fill'],
      ['set', 'fillStyle', '#303d39'], ['beginPath'], ['ellipse', -8.5, -23, 0.9, 0.9, 0, 0, 6.283185307179586], ['fill'],
      ['set', 'fillStyle', '#303d39'], ['beginPath'], ['ellipse', -8.5, -20, 0.9, 0.9, 0, 0, 6.283185307179586], ['fill'],
      ['set', 'fillStyle', '#94b8b1'], ['beginPath'], ['ellipse', 18, 9, 1, 1.5, 0, 0, 6.283185307179586], ['fill'], ['restore'],
    ];
    const commands: unknown[][] = [];
    const c = new Proxy(new RecordingContext() as unknown as CanvasRenderingContext2D, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          commands.push([String(key), ...args]);
          return Reflect.apply(value, target, args);
        };
      },
      set(target, key, value: unknown) {
        commands.push(['set', String(key), value]);
        return Reflect.set(target, key, value, target);
      },
    });
    drawKohito(c, 'noboriyurashi', 0, 0, 0, false);
    expect(commands).toEqual(originalCommands);
  });
});
