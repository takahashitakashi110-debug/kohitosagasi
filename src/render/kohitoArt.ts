import type { KohitoId } from '../game/state';
import { P } from './palette';

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
export function drawKohito(c: CanvasRenderingContext2D, id: KohitoId, x: number, y: number, elapsed: number, special = false, hidden = false): void {
  c.save(); c.translate(x, y + Math.sin(elapsed * 2.5) * 1.5);
  ellipse(c, 0, 12, 15, 4, P.shadow);
  if (id === 'tarejiri') {
    if (!hidden) {
      ellipse(c, -1, -10, 10, 18, P.skin);
      ellipse(c, -5, -27, 10, 10, P.pale);
      ellipse(c, -8, -29, 2, 3, P.ink);
      ellipse(c, -12, 9, 4, 5, P.skin);
    }
    c.globalAlpha = 0.64;
    ellipse(c, 7, 2, 13, 9, P.pale);
    ellipse(c, 8, 8, 11, 7, P.pale);
    ellipse(c, 9, 14, 7, 6, P.pale);
    c.globalAlpha = 0.85; ellipse(c, 13, 4, 3, 1.5, P.white);
    if (special) ellipse(c, 9, 23 + Math.sin(elapsed * 8) * 3, 2, 4, P.water);
  } else if (id === 'kagebousi') {
    c.globalAlpha = 0.7; c.rotate(special ? -0.6 : -0.25);
    ellipse(c, 0, -1, special ? 16 : 9, special ? 8 : 18, P.shade);
    ellipse(c, -2, -20, 7, 8, P.shade);
    ellipse(c, -4, -22, 1.5, 2, P.white);
  } else {
    c.globalAlpha = 0.85;
    const stretch = id === 'haritsuki' ? (special ? 12 : 5) : 11;
    ellipse(c, 0, -2, stretch, 15, P.skin);
    ellipse(c, 0, -21, id === 'dobunozoki' ? 12 : 9, 10, P.pale);
    ellipse(c, -6, 12, 4, 3, P.skin); ellipse(c, 6, 12, 4, 3, P.skin);
    for (let i = 0; i < (id === 'dobunozoki' ? 3 : 1); i++) ellipse(c, -6 + i * 6, -24, 2, 3, P.ink);
    if (id === 'urasumi') {
      c.strokeStyle = P.skin; c.lineWidth = 4; c.beginPath(); c.moveTo(7, -9); c.quadraticCurveTo(24, special ? -25 : -6, 17, special ? -20 : -2); c.stroke();
      if (special) ellipse(c, 10, -17, 5, 2, P.red);
    } else if (id === 'dobunozoki' && special) ellipse(c, 0, -14, 6, 7, P.ink);
    else if (id === 'noboriyurashi') {
      c.strokeStyle = P.skin; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -7); c.lineTo(special ? -17 : -12, special ? -30 : -13); c.moveTo(8, -7); c.lineTo(special ? 14 : 12, special ? -30 : -13); c.stroke();
    } else if (special) ellipse(c, 12, -3, 7, 10, P.pale);
    ellipse(c, 4, -6, 3, 1.5, P.white);
  }
  c.restore();
}
export function drawPlayer(c: CanvasRenderingContext2D, x: number, y: number, elapsed: number, moving: boolean): void {
  const step = moving ? Math.sin(elapsed * 12) * 2 : 0;
  ellipse(c, x, y + 8, 8, 3, P.shadow);
  ellipse(c, x - 4, y + 6 + step, 3, 4, P.ink); ellipse(c, x + 4, y + 6 - step, 3, 4, P.ink);
  ellipse(c, x, y - 1, 7, 8, P.red); ellipse(c, x, y - 12, 6, 6, P.sand);
  ellipse(c, x, y - 16, 10, 3, P.cream);
}
