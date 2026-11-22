import type { HitButton } from '../engine/input';
import { P } from './palette';
import { roundedRectPath } from './shapes';

export class UI {
  buttons: HitButton[] = [];
  constructor(readonly ctx: CanvasRenderingContext2D) {}
  reset(): void { this.buttons = []; }
  text(value: string, x: number, y: number, size = 16, color = P.ink, align: CanvasTextAlign = 'left'): void {
    const ctx = this.ctx;
    ctx.fillStyle = color; ctx.font = `${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }
  wrap(value: string, x: number, y: number, width: number, size = 15, color = P.ink, lineHeight = 23): number {
    this.ctx.font = `${size}px system-ui, sans-serif`;
    let line = '';
    let row = y;
    for (const character of value) {
      if (this.ctx.measureText(line + character).width > width && line) { this.text(line, x, row, size, color); row += lineHeight; line = ''; }
      line += character;
    }
    if (line) this.text(line, x, row, size, color);
    return row + lineHeight;
  }
  panel(x: number, y: number, w: number, h: number, fill = P.cream): void {
    const ctx = this.ctx;
    ctx.fillStyle = fill; ctx.beginPath(); roundedRectPath(ctx, x, y, w, h, 12); ctx.fill();
  }
  button(label: string, action: string, x: number, y: number, w: number, h = 44, active = false): void {
    this.panel(x, y, w, h, active ? P.green : P.cream);
    this.ctx.strokeStyle = P.green; this.ctx.lineWidth = 1; this.ctx.stroke();
    this.text(label, x + w / 2, y + h / 2, 16, active ? P.white : P.ink, 'center');
    this.buttons.push({ x, y, w, h, action });
  }
}
