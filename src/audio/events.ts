import type { GameState, KohitoId, PhotoFeedback, Scene } from '../game/state';
import type { SoundEvent } from './plan';

export interface SoundSnapshot {
  scene: Scene; visit: string; x: number; y: number; moving: boolean; sneaking: boolean;
  cameraHeld: boolean; cameraTarget: KohitoId | null; heldMs: number;
  feedback: Pick<PhotoFeedback, 'hintGained'> | null; escapedCount: number;
  kohitos: { id: KohitoId; x: number; y: number; specialRemaining: number; escaped: boolean; fleeing: number }[];
}
export interface SoundDetectionState { stepDistance: number }
export function soundSnapshot(game: GameState, cameraHeld: boolean): SoundSnapshot {
  return {
    scene: game.scene, visit: `${game.save.day}/${game.save.time}/${game.save.location}`,
    x: game.player.x, y: game.player.y, moving: game.moving, sneaking: game.sneaking,
    cameraHeld, cameraTarget: game.cameraTarget, heldMs: game.heldMs,
    // 結果の同一性で「出た瞬間」を判定する。結果を変更する処理はここにはない。
    feedback: game.feedback, escapedCount: game.escaped.size,
    kohitos: game.kohitos.map(({ id, x, y, specialRemaining, escaped, fleeing }) => ({ id, x, y, specialRemaining, escaped, fleeing })),
  };
}

/** 入力のスナップショットや蓄積状態を変更せず、次の蓄積状態とイベントを返す。 */
export function detectSoundEvents(prev: SoundSnapshot, next: SoundSnapshot,
  state: SoundDetectionState): { events: SoundEvent[]; state: SoundDetectionState } {
  const events: SoundEvent[] = [];
  const sameField = prev.scene === 'field' && next.scene === 'field' && prev.visit === next.visit && !prev.feedback && !next.feedback;
  let stepDistance = sameField ? state.stepDistance : 0;
  if (sameField && next.moving) {
    stepDistance += Math.hypot(next.x - prev.x, next.y - prev.y);
    const spacing = next.sneaking ? 34 : 22;
    while (stepDistance + 1e-9 >= spacing) {
      events.push({ type: 'step', sneaking: next.sneaking }); stepDistance = Math.max(0, stepDistance - spacing);
    }
  }
  if (next.scene === 'camera' && next.cameraHeld) {
    const previousFocus = prev.scene === 'camera' && prev.cameraHeld && prev.cameraTarget === next.cameraTarget ? prev.heldMs / 1200 : 0;
    for (const level of [0.6, 1] as const) {
      if (previousFocus <= level && next.heldMs / 1200 > level) events.push({ type: 'focus', level });
    }
  }
  if (next.feedback && next.feedback !== prev.feedback) {
    events.push({ type: 'shutter' });
    if (next.feedback.hintGained) events.push({ type: 'hint' });
  }
  if (next.scene === 'field' && !next.feedback && prev.visit === next.visit) {
    for (const k of next.kohitos) {
      const old = prev.kohitos.find(p => p.id === k.id);
      if (old?.specialRemaining === 0 && k.specialRemaining > 0 && !k.escaped && k.fleeing === 0
        && Math.hypot(next.x - k.x, next.y - k.y) <= 160) events.push({ type: 'call', id: k.id });
    }
  }
  if (next.escapedCount > prev.escapedCount) events.push({ type: 'escape' });
  if (prev.scene !== 'ending' && next.scene === 'ending') {
    // 最後の全身写真はrecordPhoto内でfeedbackを消して直接endingへ進む。
    if (prev.scene === 'camera' && !next.feedback) events.push({ type: 'shutter' });
    events.push({ type: 'ending' });
  }
  return { events, state: { stepDistance } };
}
