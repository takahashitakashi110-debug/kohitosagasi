import { initCanvas } from './engine/canvas';
import { startLoop } from './engine/loop';
import { Input } from './engine/input';
import { TEXT } from './data/text';
import { SPOTS } from './data/spots';
import { createGame, freshSave, nextDay, SPOT_IDS } from './game/state';
import { clearEscaped, enterField, restoreEscaped, travel } from './game/flow';
import { loadSave, hasSave, writeSave, deleteSave } from './game/save';
import { clamp } from './game/photo';
import { movePlayer } from './game/world';
import { UI } from './render/ui';
import { P } from './render/palette';
import { drawTitle } from './scenes/title';
import { drawMap } from './scenes/map';
import { drawField, updateFieldKohitos } from './scenes/field';
import { beginCamera, cycleSubject } from './game/subjects';
import { drawCamera, drawFeedback, takePhoto } from './scenes/camera';
import { drawAlbum } from './scenes/album';
import { drawDayend } from './scenes/dayend';
import { drawEnding } from './scenes/ending';
import { SoundController } from './audio/controller';
import { detectSoundEvents, soundSnapshot } from './audio/events';
import type { HitButton } from './engine/input';

declare global {
  interface Window {
    readonly __kohitoE2E?: Readonly<{ scene: () => string; buttons: () => HitButton[] }>;
  }
}

document.title = TEXT.title;
document.body.style.background = P.ink;
const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing canvas');
canvas.setAttribute('aria-label', `${TEXT.title}. ${TEXT.keyboard}. ${TEXT.keyboardMore}`);
const ui = new UI(initCanvas(canvas));
const input = new Input(canvas);
const game = createGame(loadSave(), hasSave());
// 通常プレイでは公開しない。関数だけを公開し、内部の配列やボタンへの参照も渡さない。
if (new URLSearchParams(window.location.search).get('e2e') === '1') {
  Object.defineProperty(window, '__kohitoE2E', {
    value: Object.freeze({
      scene: () => game.scene,
      buttons: () => ui.buttons.map(({ x, y, w, h, action }) => ({ x, y, w, h, action })),
    }),
    writable: false, configurable: false,
  });
}
const sound = new SoundController();
let previousSound = soundSnapshot(game, false);
let soundState = { stepDistance: 0 };
window.addEventListener('keydown', event => {
  sound.unlock();
  if (event.code === 'KeyM' && !event.repeat) input.commands.push('toggle-sound');
});
canvas.addEventListener('pointerdown', () => sound.unlock());
function leaveField(): void {
  if (game.save.time === 'night') travel(game, 'home'); else { game.scene = 'map'; game.moving = false; }
}
function openAlbum(): void {
  if (game.scene === 'album') { game.scene = game.returnScene; return; }
  if (game.scene === 'camera') { game.scene = 'field'; input.suppressCamera(); }
  if (game.scene === 'title') return;
  if (game.scene === 'field' || game.scene === 'map' || game.scene === 'ending' || game.scene === 'dayend') game.returnScene = game.scene;
  game.feedback = null; game.scene = 'album'; game.moving = false;
}
function command(action: string): void {
  if (action === 'toggle-sound') { sound.toggleMute(); return; }
  if (action === 'confirm' && game.scene !== 'field' && game.scene !== 'camera') action = 'primary';
  if (game.feedback) { if (['close', 'cancel', 'primary'].includes(action)) { game.feedback = null; input.suppressCamera(); } return; }
  if (game.residentFeedback) { if (['close', 'cancel', 'primary'].includes(action)) { game.residentFeedback = null; input.suppressCamera(); } return; }
  if (game.scene === 'field' && action === 'change-subject') { cycleSubject(game); return; }
  if (action === 'album') { openAlbum(); return; }
  if (action === 'cancel' || action === 'back') {
    if (game.scene === 'camera') { game.scene = 'field'; input.suppressCamera(); }
    else if (game.scene === 'album') game.scene = game.returnScene;
    else if (game.scene === 'field') leaveField();
    else if (game.scene === 'map') { game.scene = 'title'; game.hasSave = hasSave(); }
    return;
  }
  if (game.scene === 'title') {
    if (action === 'start' || (action === 'primary' && !game.hasSave)) {
      if (game.hasSave && !window.confirm(TEXT.confirmRestart)) return;
      deleteSave(); Object.assign(game, createGame(freshSave())); game.scene = 'map'; input.suppressCamera();
    } else if (action === 'continue' || action === 'primary') {
      game.save = loadSave(); restoreEscaped(game); game.visitKey = '';
      game.scene = game.save.cleared ? 'ending' : game.save.location === 'home' ? game.save.time === 'morning' ? 'map' : 'dayend' : 'field';
      if (game.scene === 'field') enterField(game);
    }
  } else if (game.scene === 'map') {
    if (action === 'nav:right' || action === 'nav:down') game.mapChoice = (game.mapChoice + 1) % 5;
    if (action === 'nav:left' || action === 'nav:up') game.mapChoice = (game.mapChoice + 4) % 5;
    if (action === 'primary') { travel(game, SPOT_IDS[game.mapChoice] ?? 'home'); input.suppressCamera(); return; }
    const destination = SPOT_IDS.find(id => action === `spot:${id}`);
    if (destination) travel(game, destination);
    if (action === 'home') travel(game, 'home');
  } else if (game.scene === 'field' && action === 'map') leaveField();
  else if (game.scene === 'album') {
    if (action === 'primary') { game.scene = game.returnScene; return; }
    if (action === 'nav:left') action = 'previous';
    if (action === 'nav:right') action = 'next';
    if (action === 'nav:up') { game.albumTab = (game.albumTab + 2) % 3; game.albumPage = 0; }
    if (action === 'nav:down') { game.albumTab = (game.albumTab + 1) % 3; game.albumPage = 0; }
    if (action.startsWith('tab:')) { game.albumTab = clamp(Number(action.slice(4)), 0, 2); game.albumPage = 0; }
    const pages = game.albumTab === 2 ? 5 : 6;
    if (action === 'next') game.albumPage = (game.albumPage + 1) % pages;
    if (action === 'previous') game.albumPage = (game.albumPage + pages - 1) % pages;
  } else if (game.scene === 'ending' && action === 'primary' && game.endingTime >= 9) openAlbum();
  else if (game.scene === 'dayend' && (action === 'tomorrow' || action === 'primary')) {
    nextDay(game.save); clearEscaped(game); game.visitKey = ''; game.scene = 'map'; writeSave(game.save);
  }
}
startLoop(dt => {
  game.elapsed += dt;
  for (const action of input.commands.splice(0)) command(action);
  input.fieldControls = !game.feedback && !game.residentFeedback && (game.scene === 'field' || game.scene === 'camera');
  if (game.feedback || game.residentFeedback) return;
  if (game.scene === 'field') {
    const movement = input.movement;
    game.sneaking = movement.sneaking;
    game.moving = game.save.location !== 'home' && movement.moving
      ? movePlayer(game.player, movement, movement.sneaking, dt, SPOTS[game.save.location]) : false;
    updateFieldKohitos(game, dt, false);
    if (input.cameraHeld) {
      beginCamera(game);
    }
  } else if (game.scene === 'camera') {
    game.moving = false;
    game.pan = clamp(game.pan + input.pan * 70 * dt, -48, 48);
    if (input.cameraHeld) game.heldMs += dt * 1000;
    updateFieldKohitos(game, dt, input.cameraHeld);
    if (!input.cameraHeld) { takePhoto(game); game.hasSave = true; }
  } else if (game.scene === 'ending') game.endingTime += dt;
}, () => {
  // 更新処理の早期return（撮影結果の表示中など）も含め、更新後の状態を毎フレーム観察する。
  const nextSound = soundSnapshot(game, game.scene === 'camera' && input.cameraHeld);
  const detected = detectSoundEvents(previousSound, nextSound, soundState);
  sound.play(detected.events); previousSound = nextSound; soundState = detected.state;
  ui.reset();
  ui.ctx.clearRect(0, 0, 360, 640);
  switch (game.scene) {
    case 'title': drawTitle(ui, game.hasSave, sound.muted); break;
    case 'map': drawMap(ui, game.save, game.mapChoice); break;
    case 'field': drawField(ui, game, input, sound.muted); if (game.feedback || game.residentFeedback) drawFeedback(ui, game); break;
    case 'camera': drawCamera(ui, game, input); break;
    case 'album': drawAlbum(ui, game); break;
    case 'dayend': drawDayend(ui, game.save); break;
    case 'ending': drawEnding(ui, game); break;
  }
  input.buttons = ui.buttons;
});
