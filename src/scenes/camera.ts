import { TEXT } from '../data/text';
import type { GameState, KohitoId } from '../game/state';
import type { KohitoRuntime } from '../game/kohito';
import type { ShotInput, ShotResult } from '../game/photo';
import { clamp, scoreShot, shotStage } from '../game/photo';
import { distance } from '../game/world';
import { HINT_IDS } from '../data/kohito';
import { writeSave } from '../game/save';
import { drawWorld, drawStick } from './field';
import { drawKohito } from '../render/kohitoArt';
import { P } from '../render/palette';
import type { UI } from '../render/ui';
import type { Input } from '../engine/input';

export const FINDER = { x: 72, y: 176, w: 216, h: 288 };
type Rect = ShotInput['subject'];
export function subjectRect(game: GameState, k: KohitoRuntime): Rect {
  const bob = Math.sin(game.elapsed * 2.5) * 1.5;
  const bounds = k.id === 'tarejiri' ? { left: -15, top: -37, w: 35, h: 62 } : { left: -20, top: -30, w: 44, h: 46 };
  return { x: 180 + (k.x - game.player.x + bounds.left) * 1.6 - game.pan, y: 320 + (k.y - game.player.y + bounds.top + bob) * 1.6, w: bounds.w * 1.6, h: bounds.h * 1.6 };
}
function intersection(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x); const y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
}
export function evaluateCamera(game: GameState, k: KohitoRuntime): ShotResult {
  const subject = subjectRect(game, k);
  const hidden = k.id === 'tarejiri' && k.fullRemaining === 0;
  // 隠れ状態は物陰で全身の上部が遮られる。見える尻の範囲だけをファインダーとの交差に使う。
  const visibleFinder = hidden ? intersection(FINDER, { x: subject.x + 9 * 1.6, y: subject.y + 30 * 1.6, w: 26 * 1.6, h: 27 * 1.6 }) : FINDER;
  return scoreShot({ subject, finder: visibleFinder, heldMs: game.heldMs, distance: distance(game.player, k), moment: k.specialRemaining > 0 });
}
export function recordPhoto(game: GameState, id: KohitoId, shot: ShotResult, hidden: boolean): void {
  const save = game.save;
  if (save.location === 'home') return;
  const previous = save.album[id];
  const reached = shotStage(shot);
  const stage = Math.max(previous?.stage ?? 0, reached) as 0 | 1 | 2 | 3;
  if (shot.framing !== 'miss' && (!previous || shot.score > previous.best.score)) {
    save.album[id] = { stage, best: shot, day: save.day, time: save.time, spot: save.location };
  } else if (previous) previous.stage = stage;
  const hintGained = stage >= 2 && HINT_IDS.includes(id) && !save.hints.includes(id);
  if (hintGained) save.hints.push(id);
  game.feedback = { id, shot, hintGained, hidden };
  if (id === 'tarejiri' && !hidden && shot.framing === 'full') {
    save.cleared = true; save.clearedDay = save.day; game.scene = 'ending'; game.endingTime = 0; game.feedback = null;
  } else game.scene = 'field';
  writeSave(save);
}
export function takePhoto(game: GameState): void {
  const k = game.kohitos.find(subject => subject.id === game.cameraTarget);
  if (!k) { game.scene = 'field'; return; }
  const shot = k.escaped || k.fleeing > 0 ? scoreShot({ subject: { x: 0, y: 0, w: 0, h: 0 }, finder: FINDER, heldMs: game.heldMs, distance: distance(game.player, k), moment: false }) : evaluateCamera(game, k);
  recordPhoto(game, k.id, shot, k.id === 'tarejiri' && k.fullRemaining === 0);
}
export function drawCamera(ui: UI, game: GameState, input: Input): void {
  const c = ui.ctx;
  drawWorld(ui, game, true);
  c.fillStyle = P.shadow;
  c.fillRect(0, 0, 360, FINDER.y); c.fillRect(0, FINDER.y + FINDER.h, 360, 640 - FINDER.y - FINDER.h);
  c.fillRect(0, FINDER.y, FINDER.x, FINDER.h); c.fillRect(FINDER.x + FINDER.w, FINDER.y, FINDER.x, FINDER.h);
  const focus = clamp(game.heldMs / 1200, 0, 1);
  c.strokeStyle = focus >= 0.6 ? P.pale : P.white; c.lineWidth = 2; c.strokeRect(FINDER.x, FINDER.y, FINDER.w, FINDER.h);
  c.strokeStyle = P.white; c.beginPath(); c.arc(180, 320, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * focus); c.stroke();
  ui.panel(12, 14, 336, 92);
  ui.text(TEXT.focus, 180, 39, 17, P.ink, 'center');
  ui.text(TEXT.release, 180, 69, 15, P.green, 'center');
  ui.text(TEXT.focusValue(focus), 180, 132, 17, P.white, 'center');
  ui.button(TEXT.cancel, 'cancel', 244, 463, 100);
  drawStick(ui, input);
  ui.button(TEXT.camera, 'camera', 242, 521, 102, 72, true);
  ui.text(TEXT.keyboardMore, 180, 620, 13, P.white, 'center');
}
export function drawFeedback(ui: UI, game: GameState): void {
  const feedback = game.feedback;
  if (!feedback) return;
  ui.buttons = [];
  ui.ctx.fillStyle = P.shadow; ui.ctx.fillRect(0, 0, 360, 640);
  ui.panel(18, 115, 324, 427);
  ui.text(TEXT.result, 180, 143, 21, P.ink, 'center');
  ui.text(TEXT.names[feedback.id], 180, 176, 17, P.green, 'center');
  ui.ctx.save(); ui.ctx.translate(180, 236); ui.ctx.scale(1.7, 1.7);
  if (feedback.shot.framing !== 'miss') drawKohito(ui.ctx, feedback.id, 0, 0, 0, feedback.shot.moment, feedback.hidden);
  ui.ctx.restore();
  ui.text(`${TEXT.rank(feedback.shot.rank)}   ${TEXT.score(feedback.shot.score)}`, 180, 289, 23, P.green, 'center');
  ui.text(`${TEXT.framing[feedback.shot.framing]} / ${TEXT.focusValue(feedback.shot.focus)}`, 180, 325, 16, P.ink, 'center');
  if (feedback.shot.moment) ui.text(TEXT.moment, 180, 355, 17, P.red, 'center');
  if (feedback.hidden) ui.wrap(TEXT.hiddenPhoto, 40, 384, 280, 15);
  if (feedback.hintGained) ui.text(TEXT.hintGained, 180, 423, 16, P.green, 'center');
  ui.button(TEXT.close, 'close', 68, 474, 224, 46, true);
}
