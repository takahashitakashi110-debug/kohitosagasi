import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../data/spots';
import type { Tile } from '../data/spots';
import type { Point } from '../engine/canvas';
import { clamp } from './photo';

export function blocked(tiles: Tile[][], x: number, y: number, radius = 6): boolean {
  for (let row = Math.floor((y - radius) / TILE_SIZE); row <= Math.floor((y + radius) / TILE_SIZE); row++) {
    for (let col = Math.floor((x - radius) / TILE_SIZE); col <= Math.floor((x + radius) / TILE_SIZE); col++) {
      const tile = tiles[row]?.[col];
      if (tile !== undefined && tile !== 1 && tile !== 3) continue;
      const nearestX = clamp(x, col * TILE_SIZE, (col + 1) * TILE_SIZE);
      const nearestY = clamp(y, row * TILE_SIZE, (row + 1) * TILE_SIZE);
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2) return true;
    }
  }
  return false;
}
export function movePlayer(player: Point, direction: Point, sneaking: boolean, dt: number, tiles: Tile[][]): boolean {
  const distance = (sneaking ? 28 : 70) * dt;
  const x = player.x + direction.x * distance;
  const y = player.y + direction.y * distance;
  const before = { ...player };
  if (!blocked(tiles, x, player.y)) player.x = x;
  if (!blocked(tiles, player.x, y)) player.y = y;
  return player.x !== before.x || player.y !== before.y;
}
export function fieldCamera(player: Point): Point {
  return { x: clamp(player.x - 180, 0, MAP_COLS * TILE_SIZE - 360), y: clamp(player.y - 320, 0, MAP_ROWS * TILE_SIZE - 640) };
}
/** カメラ画面の拡大率。 */
export const CAMERA_ZOOM = 1.6;
/**
 * カメラを構えたとき、画面中心をプレイヤーから対象へどれだけ寄せるか（0=プレイヤー中心、1=対象中心）。
 * プレイヤー中心のままだと、真上／真下 70〜120px のこひとが縦にはみ出して全身を収められない。
 * 1 にしないのは、遠いほど横パンで合わせる手間が残るようにするため。
 */
export const CAMERA_AIM = 0.6;
/** カメラ画面の中心に来るワールド座標（パン適用前）。描画と採点の両方がこれを使う。 */
export function cameraCenter(player: Point, target: Point | undefined): Point {
  if (!target) return { ...player };
  return { x: player.x + (target.x - player.x) * CAMERA_AIM, y: player.y + (target.y - player.y) * CAMERA_AIM };
}
export function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
