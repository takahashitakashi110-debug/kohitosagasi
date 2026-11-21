import { clamp } from './photo';
import type { KohitoId } from './state';

export interface AwarenessInput { distance: number; moving: boolean; sneaking: boolean; cameraHeld: boolean }
export function updateAwareness(awareness: number, input: AwarenessInput, dt: number): number {
  const radius = !input.moving ? 0 : input.sneaking ? 30 : 90;
  const noise = input.distance < radius ? (1 - input.distance / radius) * (input.sneaking ? 0.25 : 0.5) : 0;
  const camera = input.cameraHeld ? 0.35 * (1 - clamp(input.distance / 160, 0, 1)) : 0;
  return clamp(awareness + (noise > 0 || camera > 0 ? noise + camera : -0.2) * dt, 0, 1);
}
export interface KohitoRuntime {
  id: KohitoId; x: number; y: number; awareness: number;
  fleeing: number; escaped: boolean; specialClock: number; specialRemaining: number;
  revealWait: number; fullRemaining: number;
}
export function createKohito(id: KohitoId, x: number, y: number): KohitoRuntime {
  return { id, x, y, awareness: 0, fleeing: 0, escaped: false, specialClock: 0, specialRemaining: 0, revealWait: 0, fullRemaining: 0 };
}
export function tickKohito(k: KohitoRuntime, input: AwarenessInput, dt: number, random: () => number = Math.random): void {
  if (k.escaped) return;
  if (k.fleeing > 0) {
    k.fleeing = Math.max(0, k.fleeing - dt);
    if (k.fleeing === 0) k.escaped = true;
    return;
  }
  k.awareness = updateAwareness(k.awareness, input, dt);
  if (k.awareness >= 1) { k.fleeing = 0.6; k.fullRemaining = 0; k.revealWait = 0; return; }
  k.specialRemaining = Math.max(0, k.specialRemaining - dt);
  k.specialClock += dt;
  if (k.specialClock + 1e-9 >= 6) { k.specialClock = Math.max(0, k.specialClock - 6); if (random() < 0.25) k.specialRemaining = 1.5; }
  if (k.id === 'tarejiri') {
    if (k.fullRemaining > 0) {
      k.fullRemaining = Math.max(0, k.fullRemaining - dt);
      k.revealWait = 0;
    } else {
      k.revealWait = input.distance >= 60 && input.distance <= 120 && k.awareness < 0.5 ? k.revealWait + dt : 0;
      if (k.revealWait + 1e-9 >= 4) { k.fullRemaining = 8; k.revealWait = 0; }
    }
  }
}
