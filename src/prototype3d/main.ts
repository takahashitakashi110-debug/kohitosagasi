import './style.css';
import { P0 as t } from '../data/text';
import {
  actorSpot,
  applyChange,
  benchSpot,
  evaluate,
  homeAt,
  leafSpot,
  looseSpot,
  move,
  naturalBehavior,
  nextAlarm,
  traceSpot,
  tuning,
} from './rules';
import type { Behavior, Photo } from './rules';
import { Journal } from './storage';
import { World } from './world';
import type { View } from './world';
import { button, element, makeShell, Notebook, tool } from './interface';

type Mode = 'walk' | 'camera' | 'notebook' | 'menu' | 'interaction';
const root = document.querySelector<HTMLElement>('#prototype')!;
const ui = makeShell(root);
const journal = new Journal(refreshSave);
const brokenPhotos = new Set<string>();
const book = new Notebook(journal, (id) => {
  brokenPhotos.add(id);
  refreshSave();
});
let world: World;
let mode: Mode = 'walk',
  returning: Mode = 'walk',
  ready = false;
let exhibited: string | null | undefined;
let failedCapture = false,
  busyShot = false,
  crouch = false,
  seated = false,
  carrying = false;
let time = 0,
  collectTime: number | null = null,
  showUntil = 0,
  alarm: number | null = null,
  focusedSince: number | null = null,
  zoomFov = 47;
let behavior: Behavior = 'idle',
  evidence = { encounter: false, ecology: false },
  messageUntil = 0;
let actionKey = '',
  menuKind = '',
  lastHome = true;
const held = new Set<string>();
const view: View = { x: 0, y: 1.52, z: 7.55, yaw: 0, pitch: -0.115, fov: 64 };
const dist = (p: { x: number; z: number }) => Math.hypot(view.x - p.x, view.z - p.z);
const active = () => ready && (mode === 'walk' || mode === 'camera');
const rec = () => journal.record;
const inHome = () => homeAt(view.z);
const nearBench = () => !inHome() && dist(benchSpot) < 2.5;
const nearTrace = () => !inHome() && dist(traceSpot) < 2.35;
const canPick = () =>
  rec().dayPart === 'morning' &&
  !rec().trustEventSeen &&
  !carrying &&
  collectTime === null &&
  dist(looseSpot) < 1.95;
const canPlace = () => carrying && dist(leafSpot) < 2.0 && rec().dayPart === 'morning' && alarm === null;
const context = () =>
  inHome() ? 'home' : nearTrace() || canPick() || canPlace() ? 'hedge' : nearBench() ? 'bench' : '';
function say(text: string, seconds = 3.7) {
  ui.message.textContent = text;
  messageUntil = performance.now() + seconds * 1000;
}
let sound: AudioContext | undefined;
function tone(hz: number, length: number, fall = 0.72) {
  if (rec().muted) return;
  try {
    sound ??= new AudioContext();
    if (sound.state === 'suspended') void sound.resume().catch(() => {});
    const osc = sound.createOscillator(),
      gain = sound.createGain(),
      now = sound.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    osc.frequency.exponentialRampToValueAtTime(hz * fall, now + length);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain);
    gain.connect(sound.destination);
    osc.start(now);
    osc.stop(now + length);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Visual clues are always available. */
  }
}

function refreshSave() {
  const text = [busyShot ? t.encoding : t.statuses[journal.status]];
  if (journal.damaged) text.push(t.damaged);
  if (brokenPhotos.size) text.push(t.badImage);
  if (failedCapture) text.push(t.encodeError);
  const label = text.join('　');
  ui.saveText.textContent = label;
  ui.status.dataset.problem = String(
    journal.status === 'unsaved' || journal.damaged || brokenPhotos.size > 0 || failedCapture,
  );
  ui.retry.hidden = journal.status !== 'unsaved';
  ui.saveInPanel.replaceChildren(element('span', '', label));
  if (journal.status === 'unsaved')
    ui.saveInPanel.append(button(t.retry, () => void journal.retry(), 'retry'));
  if (world && exhibited !== rec().framePhotoId) {
    exhibited = rec().framePhotoId;
    const photo = journal.photos.find((p) => p.id === exhibited);
    void world.exhibit(photo, () => {
      if (photo) brokenPhotos.add(photo.id);
      refreshSave();
    });
  }
}
ui.retry.onclick = () => void journal.retry();

function setMode(next: Mode) {
  mode = next;
  root.dataset.mode = next;
  held.clear();
  drag = undefined;
  focusedSince = null;
  actionKey = '';
  cameraBtn.setAttribute('aria-pressed', String(next === 'camera'));
  if (next === 'walk' || next === 'camera') {
    if (ui.dialog.open) ui.dialog.close();
    ui.canvas.focus({ preventScroll: true });
  }
}
function openPanel(kind: 'menu' | 'notebook' | 'interaction', title: string) {
  if (!ui.dialog.open) returning = mode;
  setMode(kind);
  ui.title.textContent = title;
  ui.content.replaceChildren();
  ui.dialog.classList.toggle('wide', kind === 'notebook');
  if (!ui.dialog.open) ui.dialog.showModal();
  refreshSave();
}
function back() {
  if (!ready) return;
  setMode(returning === 'camera' ? 'camera' : 'walk');
  menuKind = '';
}
ui.close.onclick = back;
ui.dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  back();
});
function openBook() {
  if (!ready) return;
  openPanel('notebook', t.titleBook);
  book.selection = rec().framePhotoId;
  book.render(ui.content, inHome());
}
function settings() {
  if (!ready) return;
  openPanel('menu', t.menu);
  ui.content.append(element('p', '', t.instructions), element('p', '', t.cameraInstructions));
  const label = element('label', '', t.sensitivity);
  const range = element('input');
  range.type = 'range';
  range.min = '0.4';
  range.max = '2';
  range.step = '0.1';
  range.value = String(rec().sensitivity);
  range.oninput = () => journal.change({ kind: 'sensitivity', value: Number(range.value) });
  label.append(range);
  const mute = element('label');
  const check = element('input');
  check.type = 'checkbox';
  check.checked = rec().muted;
  check.onchange = () => journal.change({ kind: 'mute', value: check.checked });
  mute.append(check, document.createTextNode(t.mute));
  ui.content.append(label, mute);
}
function toggleCamera() {
  if (!active()) return;
  setMode(mode === 'camera' ? 'walk' : 'camera');
}
const cameraBtn = tool(t.camera, 'cam', toggleCamera);
ui.nav.append(cameraBtn, tool(t.notebook, 'book', openBook), tool(t.menu, 'gear', settings));

function restMenu() {
  const next = applyChange(rec(), { kind: 'rest' }).dayPart;
  ui.title.textContent = t.restQuestion(t.periods[next]);
  ui.content.replaceChildren(
    button(
      t.confirmRest,
      () => {
        journal.change({ kind: 'rest' });
        alarm = null;
        collectTime = null;
        carrying = false;
        showUntil = 0;
        time = 0;
        seated = false;
        back();
        say(t.rested(t.periods[rec().dayPart]));
      },
      'primary',
    ),
    button(t.cancel, () => interaction(menuKind)),
  );
}
function interaction(where = context()) {
  if (!ready || !where) return;
  menuKind = where;
  openPanel('interaction', where === 'home' ? t.atHome : where === 'bench' ? t.atBench : t.atHedge);
  const add = (name: string, fn: () => void) => ui.content.append(button(name, fn));
  if (where === 'home') {
    add(t.frame, openBook);
    add(t.rest, restMenu);
    return;
  }
  if (where === 'bench') {
    add(seated ? t.stand : t.sit, () => {
      seated = !seated;
      back();
      if (seated) say(t.sat);
    });
    add(t.rest, restMenu);
    return;
  }
  if (nearTrace())
    add(t.inspect, () => {
      journal.change({ kind: 'trace' });
      back();
      say(t.traceHint, 5);
    });
  if (canPick())
    add(t.pick, () => {
      carrying = true;
      back();
      say(t.picked);
      tone(370, 0.11);
    });
  if (canPlace())
    add(t.place, () => {
      carrying = false;
      collectTime = 0;
      back();
      say(t.returned);
      tone(410, 0.16);
    });
}
function refreshOpenBook() {
  if (mode !== 'notebook') return;
  const editor = ui.content.querySelector('textarea');
  const editing = !!editor && document.activeElement === editor;
  const start = editor?.selectionStart ?? 0,
    end = editor?.selectionEnd ?? 0;
  book.render(ui.content, inHome());
  if (editing) {
    const next = ui.content.querySelector('textarea');
    next?.focus();
    next?.setSelectionRange(start, end);
  }
}

async function shutter() {
  if (mode !== 'camera' || !ready || busyShot) return;
  busyShot = true;
  refreshSave();
  try {
    drawFrame(0);
    const evidenceGranted = { ...evidence },
      pose = { ...view },
      state = rec();
    const capturedBehaviorId = evidenceGranted.encounter ? behavior : 'absent';
    const capture = world.snapshot();
    const atHome = inHome();
    const blob = await capture.blob;
    const id =
      crypto.randomUUID?.() ??
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join('');
    const photo: Photo = {
      id,
      imageBlob: blob,
      width: capture.width,
      height: capture.height,
      capturedDay: state.day,
      capturedDayPart: state.dayPart,
      location: atHome ? 'home' : 'street',
      created: Date.now(),
      cameraTransform: pose,
      characterId: evidenceGranted.encounter ? 'hohomochi' : null,
      evidenceGranted,
      capturedBehaviorId,
    };
    failedCapture = false;
    journal.change({ kind: 'photo', photo });
    refreshOpenBook();
    tone(810, 0.065, 0.4);
    say(
      evidenceGranted.ecology && !state.ecologySeen
        ? state.encounterSeen
          ? t.ecology
          : t.both
        : evidenceGranted.encounter && !state.encounterSeen
          ? t.first
          : t.shot,
    );
  } catch {
    failedCapture = true;
    refreshSave();
    say(t.encodeError);
  } finally {
    busyShot = false;
    refreshSave();
  }
}

let drag: { id: number; x: number; y: number; total: number } | undefined;
function look(dx: number, dy: number) {
  if (!dx && !dy) return;
  view.yaw -= dx;
  view.pitch = Math.max(-1.22, Math.min(1.21, view.pitch - dy));
  focusedSince = null;
}
ui.canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  toggleCamera();
});
ui.canvas.addEventListener('pointerdown', (e) => {
  if (!active() || e.button !== 0) return;
  ui.canvas.focus();
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, total: 0 };
  ui.canvas.setPointerCapture(e.pointerId);
});
ui.canvas.addEventListener('pointermove', (e) => {
  if (!active() || !drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.total += Math.hypot(dx, dy);
  const sensitivity = 0.0038 * rec().sensitivity * (mode === 'camera' ? 0.75 : 1);
  look(dx * sensitivity, dy * sensitivity);
});
ui.canvas.addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId || e.button !== 0) return;
  const click = drag.total < 5;
  drag = undefined;
  if (click && mode === 'camera') void shutter();
});
ui.canvas.addEventListener('pointercancel', () => {
  drag = undefined;
});
ui.canvas.addEventListener(
  'wheel',
  (e) => {
    if (mode !== 'camera') return;
    e.preventDefault();
    zoomFov = Math.max(26, Math.min(64, zoomFov + Math.sign(e.deltaY) * 5));
    focusedSince = null;
  },
  { passive: false },
);
const continuous = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'ShiftLeft',
  'ShiftRight',
]);
window.addEventListener('keydown', (e) => {
  if (!ready || e.isComposing || e.keyCode === 229) return;
  if (ui.dialog.open) {
    if (e.code === 'Escape') {
      e.preventDefault();
      back();
    }
    return;
  }
  if (continuous.has(e.code)) {
    e.preventDefault();
    held.add(e.code);
    return;
  }
  if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
    e.preventDefault();
    crouch = !crouch;
    focusedSince = null;
    return;
  }
  if (e.repeat) return;
  if (e.code === 'Tab') {
    e.preventDefault();
    openBook();
  } else if (e.code === 'Escape') {
    e.preventDefault();
    if (mode === 'camera') setMode('walk');
    else settings();
  } else if (e.code === 'KeyE') {
    e.preventDefault();
    interaction();
  } else if (e.code === 'Space' && mode === 'camera') {
    e.preventDefault();
    void shutter();
  }
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => {
  held.clear();
  drag = undefined;
  focusedSince = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    held.clear();
    drag = undefined;
    focusedSince = null;
  }
});

function movePlayer(elapsed: number) {
  const dt = Math.min(elapsed, 0.18);
  const forward = Number(held.has('KeyW')) - Number(held.has('KeyS'));
  const side = Number(held.has('KeyD')) - Number(held.has('KeyA'));
  const yaw = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
  const pitch = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
  look(yaw * dt * 1.62, pitch * dt * 1.14);
  const run = !crouch && (held.has('ShiftLeft') || held.has('ShiftRight'));
  if (forward || side) {
    const amount = ((crouch ? 1.3 : run ? 4.75 : 2.85) * dt) / Math.hypot(forward, side);
    const c = Math.cos(view.yaw),
      s = Math.sin(view.yaw);
    const p = move(view.x, view.z, (side * c - forward * s) * amount, (-forward * c - side * s) * amount);
    if (p.x !== view.x || p.z !== view.z) focusedSince = null;
    Object.assign(view, p);
    seated = false;
  }
  if (collectTime !== null) {
    collectTime += elapsed;
    if (collectTime >= 2.1) {
      collectTime = null;
      showUntil = time + 3.7;
      journal.change({ kind: 'trust' });
      say(t.trusted);
      tone(245, 0.3);
    }
  }
  if (rec().dayPart === 'morning' && collectTime === null) {
    const old = alarm;
    alarm = nextAlarm(alarm, dist(actorSpot), Boolean(run && (forward || side)), elapsed);
    if (old === null && alarm !== null) {
      say(t.alarm);
      tone(390, 0.21);
    }
    if (old !== null && alarm === null) {
      say(t.calm);
      tone(240, 0.2);
    }
  }
}
function drawFrame(dt: number) {
  const playing = active(),
    isCamera = mode === 'camera';
  if (playing) {
    time += dt;
    movePlayer(dt);
  }
  const period = rec().dayPart;
  const outOfSight = !rec().encounterSeen && !rec().traceSeen && dist(actorSpot) > 5.5;
  const showing = time < showUntil || (rec().trustEventSeen && time % 18 > 12.1 && time % 18 < 13.5);
  if (period !== 'morning') behavior = 'absent';
  else if (alarm !== null || outOfSight) behavior = 'hidden';
  else if (collectTime !== null) behavior = 'collect';
  else if (showing) behavior = 'show';
  else behavior = naturalBehavior(time);
  view.y = seated ? 0.96 : crouch ? 0.84 : 1.52;
  view.fov = isCamera ? zoomFov : 64;
  world.render(
    view,
    period,
    behavior,
    time,
    collectTime === null ? 0 : Math.min(1, collectTime / 2.1),
    carrying,
    rec().trustEventSeen,
  );
  if (isCamera) {
    const sight = world.sight(behavior);
    const valid = evaluate(sight, 0).encounter;
    if (!valid) focusedSince = null;
    else focusedSince ??= time;
    const focus = focusedSince === null ? 0 : time - focusedSince;
    evidence = evaluate(sight, focus);
    const type = evidence.ecology
      ? 'ecology'
      : valid
        ? focus >= tuning.focusSeconds
          ? 'encounter'
          : 'focus'
        : 'scene';
    ui.focus.textContent =
      type === 'ecology'
        ? t.readyShot
        : type === 'encounter'
          ? t.portrait
          : type === 'focus'
            ? t.focus
            : t.scenery;
    if (valid && behavior === 'cheek' && !sight.nut) ui.focus.textContent = t.reframe;
    ui.focus.dataset.sight = type;
    ui.zoom.textContent = t.zoom(64 / view.fov);
  } else evidence = { encounter: false, ecology: false };
  if (inHome() && !lastHome) {
    say(t.homeLater);
  }
  lastHome = inHome();
  const place = inHome() ? t.home : dist(actorSpot) < 5.3 ? t.hedge : t.street;
  ui.place.textContent = place;
  ui.when.textContent = t.day(rec().day) + ' · ' + t.periods[period];
  const followed = rec().followPhotoId;
  const bookmark = followed ? rec().notes[followed]?.hypothesisId : '';
  let hint = inHome() ? (journal.photos.length ? t.homeLater : t.roomHint) : t.roadHint;
  if (!inHome() && dist(actorSpot) < 5.3) {
    if (period !== 'morning') hint = t.offHours;
    else if (alarm !== null) hint = t.alarm;
    else if (bookmark) hint = bookmark === 'nuts' ? t.revisitNuts : t.revisitQuiet;
    else if (behavior === 'regrip' && rec().traceSeen) hint = t.regrip;
    else if (behavior === 'cheek' && rec().traceSeen) hint = t.voice + '。' + t.cheek;
    else if (rec().ecologySeen) hint = t.afterHint;
    else if (rec().traceSeen) hint = t.nearHint;
  }
  ui.hint.textContent = hint;
  if (performance.now() > messageUntil && ui.message.textContent) ui.message.textContent = '';
  const where = context();
  const prompt =
    where === 'home'
      ? t.atHome
      : where === 'bench'
        ? t.atBench
        : canPlace()
          ? t.place
          : nearTrace()
            ? t.inspect
            : canPick()
              ? t.pick
              : t.interact;
  const key = [mode, where, prompt, seated, crouch].join('/');
  if (key !== actionKey) {
    actionKey = key;
    ui.actions.replaceChildren();
    if (isCamera) ui.actions.append(button(t.shutter, () => void shutter()));
    else if (mode === 'walk' && where) ui.actions.append(button('E　' + prompt, () => interaction()));
    ui.keys.textContent = (isCamera ? t.cameraControls : t.controls) + (crouch ? '　·　' + t.crouched : '');
  }
}

async function start() {
  try {
    world = new World(ui.canvas);
  } catch {
    root.replaceChildren(element('p', 'warning', t.fatal));
    return;
  }
  await journal.load();
  ready = true;
  setMode('walk');
  refreshSave();
  let before = performance.now();
  const tick = (now: number) => {
    const dt = Math.max(0, Math.min((now - before) / 1000, 1));
    before = now;
    if (!document.hidden && (active() || actionKey === '')) drawFrame(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
void start();
