import { PROPS } from '../data/props';
import type { Prop } from '../data/props';
import type { SpotId } from '../game/state';
import { P } from './palette';

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

/** 枠の内側だけを使い、色・透明度・パスの線幅を外へ持ち出さない。 */
export function drawProp(c: CanvasRenderingContext2D, prop: Prop): void {
  const { w, h, kind } = prop;
  c.save(); c.translate(prop.x, prop.y);
  c.globalAlpha = 0.72; c.lineWidth = 1; c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = P.wall; c.strokeStyle = P.wall;
  switch (kind) {
    case 'shutter':
      c.fillStyle = P.wallLight; c.fillRect(1, 1, w - 2, h - 2);
      c.beginPath();
      for (let i = 1; i < 7; i++) { c.moveTo(3, h * i / 7); c.lineTo(w - 3, h * i / 7); }
      c.stroke(); c.strokeRect(2, 2, w - 4, h - 4);
      break;
    case 'sign':
      c.fillStyle = P.skin; c.fillRect(1, 1, w - 2, h - 2);
      c.fillStyle = P.red; c.fillRect(5, 5, w * 0.22, h - 10);
      c.fillStyle = P.wall; c.fillRect(w * 0.38, h * 0.35, w * 0.48, 2);
      c.fillRect(w * 0.38, h * 0.6, w * 0.3, 2);
      break;
    case 'bench':
      c.fillRect(4, h * 0.65, 3, h * 0.3); c.fillRect(w - 7, h * 0.65, 3, h * 0.3);
      c.fillStyle = P.skin; c.fillRect(2, 2, w - 4, h * 0.35); c.fillRect(1, h * 0.55, w - 2, h * 0.2);
      c.beginPath(); c.moveTo(4, h * 0.22); c.lineTo(w - 4, h * 0.22); c.stroke();
      break;
    case 'bin':
      c.fillRect(3, 4, w - 6, h - 6);
      c.fillStyle = P.wallLight; c.fillRect(1, 2, w - 2, 4);
      c.strokeStyle = P.wallLight; c.beginPath();
      for (let i = 1; i <= 3; i++) { c.moveTo(w * i / 4, 10); c.lineTo(w * i / 4, h - 5); }
      c.stroke();
      break;
    case 'line':
      c.globalAlpha = 0.65; c.fillStyle = P.cream;
      c.fillRect(1, 1, w - 2, h - 2);
      break;
    case 'flyer':
      c.fillStyle = P.paper; c.beginPath(); c.moveTo(1, 1); c.lineTo(w - 4, 1);
      c.lineTo(w - 1, h - 4); c.lineTo(3, h - 1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(5, 5); c.lineTo(w - 6, 5); c.moveTo(5, 8); c.lineTo(w - 8, 8); c.stroke();
      break;
    case 'drain':
      c.globalAlpha = 0.65; c.fillStyle = P.skin; c.fillRect(1, 1, w - 2, h - 2);
      c.beginPath();
      for (let i = 1; i < 6; i++) { c.moveTo(w * i / 6, 4); c.lineTo(w * i / 6, h - 4); }
      c.stroke();
      break;
    case 'leaves':
      c.globalAlpha = 0.68; c.fillStyle = P.grass;
      for (let i = 0; i < 4; i++) oval(c, w * (0.15 + i * 0.22), h * (i % 2 ? 0.7 : 0.3), w * 0.08, h * 0.13);
      break;
    case 'railing': {
      c.fillStyle = P.skin;
      const horizontal = w > h;
      for (let i = 0; i < 5; i++) {
        const p = 0.06 + i * 0.22;
        if (horizontal) c.fillRect(w * p, 1, 2, h - 2);
        else c.fillRect(1, h * p, w - 2, 2);
      }
      if (horizontal) { c.fillRect(1, h * 0.25, w - 2, 2); c.fillRect(1, h * 0.65, w - 2, 2); }
      else { c.fillRect(w * 0.25, 1, 2, h - 2); c.fillRect(w * 0.65, 1, 2, h - 2); }
      break;
    }
    case 'stones':
      c.fillStyle = P.wallLight;
      for (let i = 0; i < 3; i++) oval(c, w * (0.18 + i * 0.31), h * (i === 1 ? 0.4 : 0.65), w * 0.14, h * 0.28);
      break;
    case 'reeds':
      c.strokeStyle = P.grass; c.beginPath();
      for (let i = 0; i < 7; i++) {
        const x = w * (0.1 + i * 0.13);
        c.moveTo(x, h - 2); c.lineTo(x - 3, h * (i % 2 ? 0.15 : 0.35));
        c.moveTo(x, h * 0.65); c.lineTo(x + 4, h * 0.3);
      }
      c.stroke();
      break;
    case 'crack':
      c.lineWidth = 1.5;
      c.globalAlpha = 0.78; c.beginPath(); c.moveTo(1, h * 0.35); c.lineTo(w * 0.3, h * 0.5);
      c.lineTo(w * 0.48, h * 0.24); c.lineTo(w * 0.7, h * 0.65); c.lineTo(w - 1, h * 0.5);
      c.moveTo(w * 0.3, h * 0.5); c.lineTo(w * 0.25, h - 2); c.stroke();
      break;
    case 'silt':
      c.lineWidth = 1.5;
      c.globalAlpha = 0.78; c.beginPath();
      for (let i = 1; i <= 3; i++) {
        c.moveTo(2, h * i / 4); c.quadraticCurveTo(w * 0.5, h * (i + 0.4) / 4, w - 2, h * i / 4);
      }
      c.stroke();
      break;
    case 'puddle':
      c.lineWidth = 1.5;
      c.globalAlpha = 0.78; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.45, h * 0.36, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(w * 0.24, h * 0.65); c.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.7, h * 0.6); c.stroke();
      break;
    case 'windows':
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const x = w * (0.05 + col * 0.33); const y = h * (0.1 + row * 0.47);
        c.fillRect(x, y, w * 0.22, h * 0.27);
        c.fillStyle = P.wallLight; c.fillRect(x, y + h * 0.27, w * 0.25, 2); c.fillStyle = P.wall;
      }
      break;
    case 'board':
      c.fillRect(2, 2, w - 4, h - 4);
      c.fillStyle = P.skin; c.fillRect(5, 5, w - 10, h - 10);
      c.fillStyle = P.paper; c.fillRect(w * 0.17, h * 0.2, w * 0.25, h * 0.35);
      c.fillRect(w * 0.55, h * 0.3, w * 0.25, h * 0.4);
      break;
    case 'bicycle': {
      const r = Math.min(w * 0.18, h * 0.28);
      c.beginPath(); c.ellipse(w * 0.23, h * 0.68, r, r, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(w * 0.77, h * 0.68, r, r, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(w * 0.23, h * 0.68); c.lineTo(w * 0.4, h * 0.3);
      c.lineTo(w * 0.6, h * 0.68); c.closePath(); c.moveTo(w * 0.4, h * 0.3);
      c.lineTo(w * 0.65, h * 0.3); c.lineTo(w * 0.77, h * 0.68); c.lineTo(w * 0.6, h * 0.68);
      c.moveTo(w * 0.65, h * 0.3); c.lineTo(w * 0.63, h * 0.14); c.lineTo(w * 0.74, h * 0.14);
      c.moveTo(w * 0.34, h * 0.24); c.lineTo(w * 0.46, h * 0.24); c.stroke();
      break;
    }
    case 'hedge':
      c.globalAlpha = 0.68; c.fillStyle = P.green;
      for (let i = 0; i < 5; i++) oval(c, w * (0.12 + i * 0.19), h * 0.52, w * 0.11, h * 0.42);
      break;
    case 'paving':
      c.globalAlpha = 0.55; c.strokeRect(1, 1, w - 2, h - 2); c.beginPath();
      for (let i = 1; i <= 3; i++) { c.moveTo(w * i / 4, 1); c.lineTo(w * i / 4, h - 1); }
      c.moveTo(1, h / 2); c.lineTo(w - 1, h / 2); c.stroke();
      break;
    case 'busStop':
    case 'clock':
      c.fillRect(w / 2 - 1, h * 0.2, 2, h * 0.77);
      c.fillStyle = P.wallLight; oval(c, w / 2, h * 0.16, w * 0.43, w * 0.43);
      if (kind === 'clock') {
        c.beginPath(); c.moveTo(w * 0.3, h * 0.16); c.lineTo(w / 2, h * 0.16); c.lineTo(w / 2, h * 0.08); c.stroke();
      } else {
        c.fillStyle = P.red; c.fillRect(w * 0.22, h * 0.13, w * 0.56, 3);
        c.fillStyle = P.wall; c.fillRect(w * 0.33, h * 0.36, w * 0.34, h * 0.2);
      }
      break;
    case 'crossing':
      c.globalAlpha = 0.65; c.fillStyle = P.cream;
      for (let i = 0; i < 6; i++) c.fillRect(w * (0.02 + i * 0.166), 2, w * 0.1, h - 4);
      break;
    case 'taxiLine':
      c.globalAlpha = 0.65; c.strokeStyle = P.cream; c.lineWidth = 2; c.beginPath();
      c.moveTo(2, 2); c.lineTo(2, h - 2); c.lineTo(w - 2, h - 2); c.lineTo(w - 2, 2);
      c.moveTo(w / 2, 2); c.lineTo(w / 2, h - 2); c.stroke();
      break;
    case 'gum':
      c.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) oval(c, w * (0.18 + i * 0.31), h * (i % 2 ? 0.3 : 0.65), w * 0.08, h * 0.13);
      break;
  }
  c.restore();
}

export function drawProps(c: CanvasRenderingContext2D, spot: SpotId): void {
  for (const prop of PROPS[spot]) drawProp(c, prop);
}
