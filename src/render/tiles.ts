import { SPOTS, TILE_SIZE } from '../data/spots';
import type { SpotId, TimeSlot } from '../game/state';
import { P } from './palette';
import { drawProps } from './props';
import { drawSummerBuilding, drawSummerGarden, SUMMER } from './summer';

export function drawTiles(ctx: CanvasRenderingContext2D, spot: SpotId): void {
  ctx.save();
  SPOTS[spot].forEach((row, y) => row.forEach((tile, x) => {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    ctx.fillStyle = tile === 1 ? SUMMER.facade : tile === 2 ? SUMMER.grass : tile === 3 ? SUMMER.dry : tile === 4 ? SUMMER.paving : SUMMER.road;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (tile === 0 || tile === 4) {
      ctx.fillStyle = '#fff5d533'; ctx.fillRect(px + (x * 7 + y * 3) % 16, py + (y * 5) % 20, 3, 1);
      if (tile === 4) { ctx.strokeStyle = '#8b9b8b40'; ctx.lineWidth = 0.7; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE); }
    }
    if (tile === 2) { ctx.strokeStyle = SUMMER.leafLight; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 8, py + 15); ctx.lineTo(px + 10, py + 10); ctx.moveTo(px + 16, py + 20); ctx.lineTo(px + 15, py + 16); ctx.stroke(); }
    if (tile === 3) { ctx.strokeStyle = '#7d80613d'; ctx.lineWidth = 1; ctx.strokeRect(px + 1, py + 1, 22, 22); }
  }));
  // 連続した壁タイルを矩形に分け、区画を越えない建物として描く。
  const seen = new Set<number>(); const tiles = SPOTS[spot];
  for (let y = 1; y < tiles.length - 1; y++) for (let x = 1; x < tiles[y].length - 1; x++) {
    if (tiles[y][x] !== 1 || seen.has(y * 24 + x)) continue;
    let w = 1; let h = 1;
    while (x + w < 23 && tiles[y][x + w] === 1 && !seen.has(y * 24 + x + w)) w++;
    while (y + h < 31 && Array.from({ length: w }, (_, dx) => tiles[y + h][x + dx] === 1 && !seen.has((y + h) * 24 + x + dx)).every(Boolean)) h++;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) seen.add((y + dy) * 24 + x + dx);
    drawSummerBuilding(ctx, spot, x * 24, y * 24, w * 24, h * 24);
  }
  ctx.restore();
}
export function drawObjects(ctx: CanvasRenderingContext2D, spot: SpotId, time: TimeSlot, elapsed: number): void {
  drawSummerGarden(ctx, spot);
  drawProps(ctx, spot);
  ctx.fillStyle = P.shadow; ctx.fillRect(261, 265, 61, 39);
  if (spot === 'ekimae') {
    if (time === 'night') { const light = ctx.createRadialGradient(288, 269, 5, 288, 269, 78); light.addColorStop(0, P.nightGlow); light.addColorStop(1, P.transparent); ctx.fillStyle = light; ctx.fillRect(208, 190, 160, 160); }
    ctx.fillStyle = P.red; ctx.fillRect(265, 236, 46, 64);
    ctx.fillStyle = P.nightGlow; ctx.fillRect(271, 243, 34, 27);
    ctx.fillStyle = P.ink; ctx.fillRect(278, 282, 20, 9);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = P.skin; ctx.fillRect(273 + i * 8, 249, 5, 12); }
  } else if (spot === 'shoutengai') {
    ctx.fillStyle = P.wall; ctx.fillRect(254, 239, 68, 56);
    ctx.strokeStyle = P.wallLight; ctx.lineWidth = 2;
    for (let y = 246; y < 294; y += 7) { ctx.beginPath(); ctx.moveTo(258, y); ctx.lineTo(318, y); ctx.stroke(); }
    ctx.fillStyle = P.wall; ctx.fillRect(349, 272, 3, 70);
    ctx.fillStyle = P.red; ctx.beginPath(); ctx.moveTo(352, 273); ctx.lineTo(379 + Math.sin(elapsed * 2) * 3, 277); ctx.lineTo(375, 317); ctx.lineTo(352, 313); ctx.fill();
  } else if (spot === 'kawazoi') {
    ctx.fillStyle = P.wall; ctx.fillRect(263, 278, 50, 27);
    ctx.fillStyle = P.ink;
    for (let i = 0; i < 5; i++) ctx.fillRect(268 + i * 9, 283, 4, 16);
    ctx.fillStyle = P.concrete; ctx.fillRect(318, 284, 45, 28);
    ctx.fillStyle = P.wallLight; ctx.fillRect(319, 282, 44, 6);
  } else {
    ctx.fillStyle = P.wallLight; ctx.fillRect(254, 243, 72, 51);
    ctx.strokeStyle = P.wall; ctx.lineWidth = 3;
    for (let y = 249; y < 291; y += 8) { ctx.beginPath(); ctx.moveTo(255, y); ctx.lineTo(325, y); ctx.stroke(); }
    ctx.fillStyle = P.ink; ctx.fillRect(262, 221, 16, 25);
  }
}
