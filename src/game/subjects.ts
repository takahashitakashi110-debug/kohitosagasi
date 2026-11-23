import { residentAt } from '../data/townspeople';
import type { Resident, ResidentId } from '../data/townspeople';
import type { KohitoRuntime } from './kohito';
import type { GameState } from './state';
import { distance } from './world';

export type Subject = { kind: 'kohito'; body: KohitoRuntime } | { kind: 'resident'; body: Resident };
export function nearbySubjects(game: GameState): Subject[] {
  const candidates: Subject[] = game.kohitos.filter(k => !k.escaped && k.fleeing === 0).map(body => ({ kind: 'kohito', body }));
  const resident = residentAt(game.save.location);
  if (resident) candidates.push({ kind: 'resident', body: resident });
  return candidates.filter(s => distance(s.body, game.player) <= 120).sort((a, b) => distance(a.body, game.player) - distance(b.body, game.player));
}
export function selectedSubject(game: GameState): Subject | undefined {
  const nearby = nearbySubjects(game);
  return nearby.find(s => s.body.id === game.subjectChoice) ?? nearby[0];
}
export function cameraBody(game: GameState): KohitoRuntime | Resident | undefined {
  if (game.residentTarget) return residentAt(game.save.location)?.id === game.residentTarget ? residentAt(game.save.location) : undefined;
  return game.kohitos.find(k => k.id === game.cameraTarget);
}
export function cycleSubject(game: GameState): void {
  const nearby = nearbySubjects(game);
  if (!nearby.length) return;
  const current = nearby.findIndex(s => s.body.id === selectedSubject(game)?.body.id);
  game.subjectChoice = nearby[(current + 1) % nearby.length].body.id;
}
export function beginCamera(game: GameState): boolean {
  const subject = selectedSubject(game);
  if (!subject) return false;
  game.cameraTarget = subject.kind === 'kohito' ? subject.body.id : null;
  game.residentTarget = subject.kind === 'resident' ? subject.body.id : null;
  game.cameraAnchor = { x: subject.body.x, y: subject.body.y };
  game.heldMs = 0; game.pan = 0; game.moving = false; game.scene = 'camera';
  return true;
}
export interface ResidentFeedback { id: ResidentId; frame: number; hintGained: false }
