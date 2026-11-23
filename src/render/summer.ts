import type { SpotId } from '../game/state';
import { drawSummerTitleImage } from './summerImages';

/** 夏の景色用。既存キャラクターとUIの色は変えず、風景を独立して調整する。 */
export const SUMMER = {
  sky: '#9ed9e9', cloud: '#fffdf1', road: '#e7d6ac', paving: '#c9c6ad',
  grass: '#83ad61', leaf: '#397b59', leafLight: '#69a05c', shade: '#275d6040',
  plaster: '#eee1bc', facade: '#cdbb94', roof: '#a46650', roofBlue: '#5c8283',
  wood: '#775f49', glass: '#577f83', teal: '#4c9385', red: '#c67860',
  flower: '#837cba', yellow: '#ecc45d', dry: '#bfb18d', ink: '#3a5852',
};

function oval(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

export function drawSummerTree(c: CanvasRenderingContext2D, x: number, y: number, size = 1): void {
  c.save(); c.translate(x, y); c.scale(size, size);
  oval(c, 8, 10, 20, 7, SUMMER.shade);
  c.fillStyle = SUMMER.wood; c.fillRect(-2, -15, 4, 25);
  oval(c, -8, -19, 13, 14, SUMMER.leaf);
  oval(c, 7, -22, 15, 15, SUMMER.leaf);
  oval(c, -3, -30, 14, 12, SUMMER.leafLight);
  oval(c, -10, -29, 5, 4, SUMMER.grass);
  c.restore();
}

function flowerPot(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = SUMMER.roof; c.fillRect(x - 5, y, 10, 8);
  c.strokeStyle = SUMMER.leaf; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 18); c.stroke();
  oval(c, x - 3, y - 8, 4, 2, SUMMER.leaf);
  oval(c, x + 3, y - 13, 4, 2, SUMMER.leafLight);
  oval(c, x, y - 18, 4.5, 4.5, SUMMER.flower);
  oval(c, x, y - 18, 1.5, 1.5, SUMMER.cloud);
}

/** 建物の全描画を通れない地形の矩形内へ収める。 */
export function drawSummerBuilding(c: CanvasRenderingContext2D, spot: SpotId, x: number, y: number, w: number, h: number): void {
  c.save();
  const roof = spot === 'danchi' || spot === 'ekimae' ? SUMMER.roofBlue : SUMMER.roof;
  c.fillStyle = SUMMER.facade; c.fillRect(x, y, w, h);
  c.fillStyle = SUMMER.plaster; c.fillRect(x + 2, y + 2, w - 5, h - 6);
  c.fillStyle = roof; c.fillRect(x, y, w, Math.min(17, h / 3));
  c.fillStyle = SUMMER.shade; c.fillRect(x, y + Math.min(17, h / 3), w, 4);
  c.strokeStyle = SUMMER.cloud; c.lineWidth = 0.6; c.globalAlpha = 0.4;
  c.beginPath();
  for (let i = 8; i < w; i += 12) { c.moveTo(x + i, y + 2); c.lineTo(x + i - 2, y + Math.min(15, h / 3)); }
  c.stroke(); c.globalAlpha = 1;
  for (let wy = y + 26; wy + 12 < y + h - 8; wy += 28) {
    for (let wx = x + 8; wx + 13 < x + w - 5; wx += 28) {
      c.fillStyle = SUMMER.wood; c.fillRect(wx - 1, wy - 1, 15, 15);
      c.fillStyle = SUMMER.glass; c.fillRect(wx, wy, 13, 12);
      c.fillStyle = SUMMER.sky; c.fillRect(wx + 1, wy + 1, 5, 8);
      c.fillStyle = SUMMER.plaster; c.fillRect(wx - 2, wy + 12, 18, 2);
    }
  }
  if (spot === 'shoutengai' && w >= 48 && h >= 48) {
    const ay = y + h - 26;
    c.fillStyle = SUMMER.wood; c.fillRect(x + 8, ay + 10, w - 16, 14);
    c.fillStyle = SUMMER.teal; c.fillRect(x + 4, ay, w - 8, 11);
    c.fillStyle = SUMMER.cloud;
    for (let ax = x + 8; ax < x + w - 8; ax += 16) c.fillRect(ax, ay, 6, 11);
    c.fillStyle = SUMMER.shade; c.fillRect(x + 4, ay + 11, w - 8, 3);
    flowerPot(c, x + 12, y + h - 9);
  }
  if (spot === 'danchi' && w >= 72 && h >= 60) {
    c.strokeStyle = SUMMER.wood; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + 10, y + h - 17); c.lineTo(x + w - 10, y + h - 17); c.stroke();
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? SUMMER.cloud : SUMMER.teal;
      c.fillRect(x + 15 + i * 18, y + h - 17, 11, 10);
    }
  }
  c.restore();
}

/** 背の高い植物も、通れない区画にだけ置く。歩道や被写体前は塞がない。 */
export function drawSummerGarden(c: CanvasRenderingContext2D, spot: SpotId): void {
  c.save();
  if (spot === 'kawazoi') {
    // 右岸は干上がった水路。流れる川や雨は描かない。
    c.fillStyle = SUMMER.dry; c.fillRect(434, 314, 116, 380);
    c.strokeStyle = SUMMER.wood; c.lineWidth = 1; c.globalAlpha = 0.35;
    for (let y = 330; y < 690; y += 31) {
      c.beginPath(); c.moveTo(444, y); c.lineTo(482, y + 5); c.lineTo(496, y - 1); c.lineTo(538, y + 4); c.stroke();
    }
    c.globalAlpha = 1;
    for (let y = 345; y < 690; y += 65) {
      c.strokeStyle = SUMMER.leaf; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 5; i++) { c.moveTo(444 + i * 5, y + 12); c.lineTo(440 + i * 7, y - 10 + i % 2 * 7); }
      c.stroke();
    }
  } else {
    const trees = spot === 'danchi' ? [[120, 445], [165, 448], [430, 645]]
      : spot === 'ekimae' ? [[288, 528], [96, 110], [480, 115]] : [[148, 110], [456, 254]];
    for (const [x, y] of trees) drawSummerTree(c, x, y, 0.65);
    if (spot === 'danchi') {
      for (let i = 0; i < 4; i++) {
        const x = 72 + i * 29;
        c.strokeStyle = SUMMER.leaf; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 84); c.lineTo(x, 57); c.stroke();
        oval(c, x, 54, 6, 6, SUMMER.yellow); oval(c, x, 54, 2.5, 2.5, SUMMER.wood);
      }
    }
  }
  c.restore();
}

/** 地図の4枚のカードを、小さな夏の風景として描き分ける。 */
export function drawSummerSpotIcon(c: CanvasRenderingContext2D, spot: SpotId, x: number, y: number): void {
  c.save(); c.translate(x, y);
  c.fillStyle = SUMMER.sky; c.fillRect(0, 0, 132, 56);
  oval(c, 103, 10, 18, 5, SUMMER.cloud);
  c.fillStyle = SUMMER.grass; c.fillRect(0, 42, 132, 14);
  if (spot === 'kawazoi') {
    c.fillStyle = SUMMER.dry; c.fillRect(0, 38, 132, 18);
    c.strokeStyle = SUMMER.plaster; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 36); c.lineTo(132, 36); c.stroke();
    for (let i = 0; i < 5; i++) { c.fillStyle = SUMMER.wood; c.fillRect(10 + i * 28, 26, 2, 15); }
    drawSummerTree(c, 103, 35, 0.65);
  } else {
    drawSummerBuilding(c, spot, 12, 16, 76, 37);
    drawSummerTree(c, 107, 44, 0.65);
  }
  c.restore();
}

/** 画像が読めないときにも、青空と入道雲のあるタイトルを描く。 */
export function drawSummerTitle(c: CanvasRenderingContext2D): void {
  if (drawSummerTitleImage(c)) return;
  c.save(); c.fillStyle = SUMMER.sky; c.fillRect(12, 190, 336, 190);
  for (const [x, y, r] of [[85, 215, 22], [110, 209, 28], [137, 219, 20], [266, 226, 27], [293, 219, 31]]) {
    oval(c, x, y, r, r * 0.65, SUMMER.cloud);
  }
  c.fillStyle = SUMMER.grass; c.fillRect(12, 325, 336, 55);
  drawSummerBuilding(c, 'shoutengai', 24, 265, 105, 88);
  drawSummerBuilding(c, 'danchi', 243, 252, 94, 100);
  c.fillStyle = SUMMER.road; c.beginPath(); c.moveTo(163, 284); c.lineTo(192, 284); c.lineTo(252, 380); c.lineTo(104, 380); c.fill();
  drawSummerTree(c, 58, 351, 1.1); drawSummerTree(c, 292, 350, 1.2);
  c.restore();
}
