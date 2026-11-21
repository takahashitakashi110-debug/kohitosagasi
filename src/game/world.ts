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
export function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
