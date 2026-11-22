import type { KohitoId } from '../game/state';
import { P } from './palette';
import { roundedRectPath } from './shapes';

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function drawUrasumi(c: CanvasRenderingContext2D, _elapsed: number, special: boolean): void {
  // 頭を胴に埋めた、低く横長の一つながりの輪郭。
  c.fillStyle = P.skin; c.beginPath(); c.moveTo(-19, 9);
  c.bezierCurveTo(-19, -8, -5, -8, -3, -8);
  c.quadraticCurveTo(7, -8, 10, 6); c.quadraticCurveTo(12, 12, -3, 12);
  c.lineTo(-15, 12); c.quadraticCurveTo(-19, 12, -19, 9); c.fill();
  ellipse(c, -5, -2, 2.8, 0.9, P.ink);
  c.strokeStyle = P.skin; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(6, 3);
  if (special) {
    c.lineTo(19, 7); c.lineTo(14, -1); c.lineTo(5, 2);
    c.moveTo(5, 2); c.lineTo(2, 0); c.moveTo(5, 2); c.lineTo(1, 2); c.moveTo(5, 2); c.lineTo(2, 4);
  } else {
    c.lineTo(16, -2); c.lineTo(17, 5); c.lineTo(20, 8);
    c.moveTo(17, 5); c.lineTo(20, 5); c.moveTo(17, 5); c.lineTo(18, 9);
  }
  c.stroke();
  if (special) {
    ellipse(c, 1, 3, 3.5, 1.4, P.ink);
    ellipse(c, 4, 3, 2.5, 0.7, P.red);
  } else {
    ellipse(c, 19, 12, 1.2, 2, P.water);
    ellipse(c, 18.7, 11.3, 0.4, 0.6, P.white);
  }
}

function drawHaritsuki(c: CanvasRenderingContext2D, elapsed: number, special: boolean): void {
  c.fillStyle = P.skin; c.beginPath(); roundedRectPath(c, -9, -29, 18, 37, 4); c.fill();
  c.strokeStyle = P.shade; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    c.lineWidth = i === 3 ? 1.2 + Math.sin(elapsed * 2) * 0.6 : 0.8;
    c.beginPath(); c.moveTo(-7, -20 + i * 6); c.lineTo(7, -20 + i * 6); c.stroke();
  }
  if (special) {
    // 一枚の上半身がめくれる。別の頭は追加しない。
    c.fillStyle = P.shade; c.beginPath(); c.moveTo(-9, -28); c.lineTo(9, -24);
    c.lineTo(7, -9); c.lineTo(-9, -7); c.closePath(); c.fill();
    c.strokeStyle = P.pale; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-8, -27); c.lineTo(7, -23); c.lineTo(5, -10); c.stroke();
    ellipse(c, 3, -12, 1.6, 0.6, P.white);
  }
  for (const x of [-3, 3]) ellipse(c, x, special ? -19 : -24, 0.7, 2.1, P.ink);
  for (const x of [-6, 0, 6]) ellipse(c, x, 10.5, 1.3, 2.5, P.water);
}

function drawDobunozoki(c: CanvasRenderingContext2D, _elapsed: number, special: boolean): void {
  c.fillStyle = P.skin; c.beginPath(); c.moveTo(-13, 12);
  c.bezierCurveTo(-13, 6, -9, 1, 0, 1); c.bezierCurveTo(9, 1, 13, 6, 13, 12);
  c.closePath(); c.fill();
  for (let i = 0; i < 3; i++) {
    const x = -7 + i * 7; const y = i === 1 ? -1 : 0;
    ellipse(c, x, y, 3, 3, P.pale);
    if (special) {
      c.strokeStyle = P.ink; c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.stroke();
    } else {
      ellipse(c, x, y, 1.9, 2, P.ink);
      ellipse(c, x - 0.6, y - 0.7, 0.8, 0.8, P.white);
    }
  }
  ellipse(c, -5, 5, 4, 0.65, P.white);
  if (special) ellipse(c, 1, 7, 4.5, 3.5, P.ink);
}

function drawNoboriyurashi(c: CanvasRenderingContext2D, elapsed: number, special: boolean): void {
  const lean = special ? Math.sin(elapsed * 3 + 0.5) * 4 : 0;
  const wave = (position: number): number => Math.sin(elapsed * 3 + position) * (special ? 4 : 2);
  c.globalAlpha = 0.48; c.fillStyle = P.red; c.beginPath();
  c.moveTo(-5 + lean, -23); c.quadraticCurveTo(8, -24, 19 + wave(0), -21);
  c.lineTo(19 + wave(1), -12); c.lineTo(19 + wave(2), -3); c.lineTo(19 + wave(3), 6);
  c.quadraticCurveTo(7, 3, -5, 8); c.closePath(); c.fill();
  c.globalAlpha = 0.9; c.fillStyle = P.skin; c.beginPath();
  c.moveTo(-12 + lean, -25); c.lineTo(-5 + lean, -25);
  c.lineTo(-5, 15); c.lineTo(-12, 15); c.closePath(); c.fill();
  ellipse(c, -8.5 + lean, -25, 3.5, 4, P.pale);
  for (let i = 0; i < 3; i++) ellipse(c, -8.5 + lean, -26 + i * 3, 0.9, 0.9, P.ink);
  const fall = (elapsed % 1.8) / 1.8;
  ellipse(c, 18 + Math.sin(elapsed * 3), 9 + fall * 4, 1, 1.5, P.water);
}

function drawKagebousi(c: CanvasRenderingContext2D, _elapsed: number, special: boolean): void {
  c.scale(special ? 1.5 : 1, special ? 0.7 : 1);
  c.globalAlpha = 0.35; ellipse(c, 0, 12, 12, 2, P.water);
  c.globalAlpha = 0.7; c.fillStyle = P.shade; c.beginPath(); c.moveTo(-9, 11);
  c.quadraticCurveTo(-3, -1, -10, -11); c.quadraticCurveTo(-10, -18, -4, -18);
  c.quadraticCurveTo(5, -18, 4, -9); c.lineTo(10, 7);
  c.quadraticCurveTo(11, 11, -9, 11); c.fill();
  c.globalAlpha = 1;
  for (let i = 0; i < (special ? 4 : 2); i++) ellipse(c, -6 + i * 3, -13, 0.7, 1, P.white);
}

function drawTarejiri(c: CanvasRenderingContext2D, elapsed: number, special: boolean, hidden: boolean): void {
  if (!hidden) {
    c.fillStyle = P.skin; c.beginPath(); c.moveTo(-7, -25);
    c.quadraticCurveTo(-13, -23, -11, -13); c.lineTo(-8, 10);
    c.quadraticCurveTo(-5, 14, -3, 9); c.lineTo(1, -5);
    c.quadraticCurveTo(10, -2, 12, 1); c.lineTo(7, -14); c.closePath(); c.fill();
    ellipse(c, -6, -27, 9, 10, P.pale);
    ellipse(c, -10, -28, 1.3, 2.2, P.ink);
    // 腰から尻へつなぐ。隠れ状態では胴と同様に描かない。
    c.globalAlpha = 0.64; ellipse(c, 3, -5, 9, 10, P.pale);
  }
  // 両状態で同じ座標・透明度を使い、下へ行くほど細くする。
  c.globalAlpha = 0.64;
  ellipse(c, 7, 2, 13, 9, P.pale);
  ellipse(c, 8, 6, 11, 7, P.pale);
  ellipse(c, 9, 10, 7, 6, P.pale);
  c.globalAlpha = 0.85; ellipse(c, 13, 4, 3, 1.5, P.white);
  const fall = (elapsed % (special ? 0.6 : 1.8)) / (special ? 0.6 : 1.8);
  if (special || fall < 0.75) {
    ellipse(c, 9, 17 + fall * (hidden ? 2.4 : 6.8), hidden ? 0.6 : 1, hidden ? 0.6 : 1, P.water);
  }
}

export function drawKohito(c: CanvasRenderingContext2D, id: KohitoId, x: number, y: number, elapsed: number, special = false, hidden = false): void {
  c.save(); c.translate(x, y + Math.sin(elapsed * 2.5) * 1.5);
  ellipse(c, 0, 12, 15, 4, P.shadow);
  switch (id) {
    case 'urasumi': drawUrasumi(c, elapsed, special); break;
    case 'haritsuki': drawHaritsuki(c, elapsed, special); break;
    case 'dobunozoki': drawDobunozoki(c, elapsed, special); break;
    case 'noboriyurashi': drawNoboriyurashi(c, elapsed, special); break;
    case 'kagebousi': drawKagebousi(c, elapsed, special); break;
    case 'tarejiri': drawTarejiri(c, elapsed, special, hidden); break;
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
