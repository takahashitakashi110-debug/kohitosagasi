import type { KohitoRuntime } from './kohito';
import type { Tile } from '../data/spots';
import { blocked } from './world';

const homes = new WeakMap<KohitoRuntime, { x: number; y: number; time: number }>();
/** Deterministic short excursions with long rests. Hidden tarejiri stays behind its cover. */
export function moveKohito(k: KohitoRuntime, dt: number, tiles: Tile[][]): void {
  if (k.escaped || k.fleeing > 0) return;
  let home = homes.get(k);
  if (!home) { home = { x: k.x, y: k.y, time: 0 }; homes.set(k, home); }
  home.time += dt;
  if (k.id === 'tarejiri' && k.fullRemaining === 0) { k.x = home.x; k.y = home.y; return; }
  const t = home.time % 8;
  const ease = (v: number): number => { const n = Math.max(0, Math.min(1, v)); return n * n * (3 - 2 * n); };
  const offset = t < 2 ? 0 : t < 3 ? -ease(t - 2) : t < 4 ? -1
    : t < 5.5 ? -1 + 2 * ease((t - 4) / 1.5) : t < 6.5 ? 1 : 1 - ease((t - 6.5) / 1.5);
  const amplitude = k.id === 'tarejiri' ? 8 : k.id === 'haritsuki' ? 10 : 22;
  const x = home.x + offset * amplitude;
  // The original spawn can touch a decorative wall. Reject only new blocked positions.
  if (!blocked(tiles, x, home.y, 3)) { k.x = x; k.y = home.y; }
}
