import { TEXT } from '../data/text';
import type { Input } from '../engine/input';
import { tickKohito } from '../game/kohito';
import type { KohitoRuntime } from '../game/kohito';
import type { GameState } from '../game/state';
import { distance, fieldCamera } from '../game/world';
import { drawKohito, drawPlayer } from '../render/kohitoArt';
import { P } from '../render/palette';
import { drawObjects, drawTiles } from '../render/tiles';
import type { UI } from '../render/ui';

export function nearestKohito(game: GameState): KohitoRuntime | undefined {
  return game.kohitos.filter(k => !k.escaped && k.fleeing === 0 && distance(k, game.player) <= 120).sort((a, b) => distance(a, game.player) - distance(b, game.player))[0];
}
export function updateFieldKohitos(game: GameState, dt: number, cameraHeld: boolean): void {
  for (const k of game.kohitos) {
    tickKohito(k, { distance: distance(k, game.player), moving: game.moving, sneaking: game.sneaking, cameraHeld }, dt);
    if (k.fleeing > 0 || k.escaped) game.escaped.add(k.id);
  }
}
export function drawWorld(ui: UI, game: GameState, cameraMode = false): void {
  const c = ui.ctx;
  const spot = game.save.location;
  if (spot === 'home') return;
  c.save();
  if (cameraMode) { c.translate(180 - game.pan, 320); c.scale(1.6, 1.6); c.translate(-game.player.x, -game.player.y); }
  else { const camera = fieldCamera(game.player); c.translate(-camera.x, -camera.y); }
  drawTiles(c, spot);
  drawObjects(c, spot, game.save.time, game.elapsed);
  for (const trace of game.traces) { c.fillStyle = P.water; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(trace.x, trace.y, 9, 3, 0.5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  for (const k of game.kohitos) {
    if (k.escaped) continue;
    c.save();
    if (k.fleeing > 0) { c.globalAlpha = k.fleeing / 0.6; c.translate((0.6 - k.fleeing) * 65, -(0.6 - k.fleeing) * 30); }
    const hidden = k.id === 'tarejiri' && k.fullRemaining === 0;
    if (k.id === 'tarejiri' && k.fullRemaining > 7.4) {
      c.save(); c.globalAlpha *= (8 - k.fullRemaining) / 0.6;
      drawKohito(c, k.id, k.x, k.y - (k.fullRemaining - 7.4) * 8, game.elapsed, k.specialRemaining > 0, false);
      c.restore();
      drawKohito(c, k.id, k.x, k.y, game.elapsed, false, true);
    } else drawKohito(c, k.id, k.x, k.y, game.elapsed, k.specialRemaining > 0, hidden);
    if (hidden) { c.fillStyle = P.concrete; c.fillRect(k.x - 18, k.y - 39, 28, 33); }
    c.restore();
    if (!cameraMode && k.fleeing === 0) {
      const status = k.awareness < 0.33 ? TEXT.calm : k.awareness < 0.66 ? TEXT.curious : TEXT.alert;
      ui.text(status, k.x, k.y - 48, 12, k.awareness >= 0.66 ? P.red : P.ink, 'center');
      if (k.specialRemaining > 0) ui.text(TEXT.moment, k.x, k.y + 31, 12, P.green, 'center');
    }
  }
  if (!cameraMode) drawPlayer(c, game.player.x, game.player.y, game.elapsed, game.moving);
  c.restore();
  c.fillStyle = P.time[game.save.time]; c.fillRect(0, 0, 360, 640);
}
export function drawStick(ui: UI, input: Input): void {
  const c = ui.ctx;
  c.fillStyle = P.shadow; c.beginPath(); c.arc(70, 555, 44, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.cream; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(70, 555, 22, 0, Math.PI * 2); c.stroke();
  c.fillStyle = P.cream; c.beginPath(); c.arc(70 + input.stick.x * 32, 555 + input.stick.y * 32, 13, 0, Math.PI * 2); c.fill();
}
export function drawField(ui: UI, game: GameState, input: Input): void {
  drawWorld(ui, game);
  const spot = game.save.location;
  ui.panel(10, 10, 340, 80);
  ui.text(spot === 'home' ? TEXT.home : TEXT.spots[spot], 24, 34, 21);
  ui.text(TEXT.dayTime(game.save.day, TEXT.times[game.save.time]), 24, 66, 15, P.green);
  ui.button(TEXT.album, 'album', 244, 24, 96);
  ui.button(TEXT.map, 'map', 207, 455, 138);
  drawStick(ui, input);
  const target = nearestKohito(game);
  if (target) {
    ui.button(TEXT.camera, 'camera', 242, 521, 102, 72, true);
    ui.wrap(target.id === 'tarejiri' ? target.fullRemaining > 0 ? TEXT.tarejiriOut : TEXT.waitTarejiri : TEXT.clues[target.id], 20, 116, 320, 14);
  }
  ui.text(game.moving ? game.sneaking ? TEXT.sneaking : TEXT.walking : TEXT.still, 70, 614, 14, P.cream, 'center');
  if (game.escaped.size > 0) ui.wrap(TEXT.escaped, 18, 409, 320, 14);
  else ui.text(TEXT.look, 180, 422, 14, P.ink, 'center');
  ui.text(TEXT.fieldGuide[0], 180, 627, 13, P.cream, 'center');
  ui.wrap(TEXT.fieldGuide[1], 16, 466, 176, 14);
}
