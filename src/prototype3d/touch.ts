import { P0 as t } from '../data/text';
import { button, element } from './interface';

// Mobile browsers can omit the compatibility click on a HUD button just after a stick drag.
// Complete each real tap on release and cancel its synthesized click. Keyboard and mouse use native clicks.
function enableHudTaps(root: HTMLElement) {
  const pending = new Map<number, { button: HTMLButtonElement; x: number; y: number }>();
  root.addEventListener(
    'touchstart',
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('.tools button, .actions button, .touch-tools button')
          : null;
      if (!target || target.disabled) return;
      for (const finger of event.changedTouches)
        pending.set(finger.identifier, { button: target, x: finger.clientX, y: finger.clientY });
    },
    { passive: true },
  );
  root.addEventListener(
    'touchmove',
    (event) => {
      for (const finger of event.changedTouches) {
        const tap = pending.get(finger.identifier);
        if (tap && Math.hypot(finger.clientX - tap.x, finger.clientY - tap.y) > 10)
          pending.delete(finger.identifier);
      }
    },
    { passive: true },
  );
  root.addEventListener('touchcancel', (event) => {
    for (const finger of event.changedTouches) pending.delete(finger.identifier);
  });
  root.addEventListener(
    'touchend',
    (event) => {
      for (const finger of event.changedTouches) {
        const tap = pending.get(finger.identifier);
        if (!tap) continue;
        pending.delete(finger.identifier);
        event.preventDefault();
        const under = document.elementFromPoint(finger.clientX, finger.clientY);
        if (under && tap.button.contains(under)) tap.button.click();
      }
    },
    { passive: false },
  );
}

export function mountTouchControls(
  root: HTMLElement,
  crouch: () => void,
  run: () => void,
  zoom: (steps: number) => void,
) {
  const pad = element('div', 'move-pad');
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', t.stick);
  for (const [side, arrow] of [
    ['north', '▴'],
    ['west', '◂'],
    ['east', '▸'],
    ['south', '▾'],
  ]) {
    const mark = element('span', 'pad-mark ' + side, arrow);
    mark.ariaHidden = 'true';
    pad.append(mark);
  }
  const thumb = element('span', 'pad-thumb');
  pad.append(thumb);
  const tools = element('div', 'touch-tools');
  const crouchButton = button(t.crouch, crouch, 'pace');
  const runButton = button(t.run, run, 'pace');
  const minus = button('−', () => zoom(1), 'lens-step');
  const plus = button('＋', () => zoom(-1), 'lens-step');
  minus.ariaLabel = t.zoomOut;
  plus.ariaLabel = t.zoomIn;
  tools.append(crouchButton, runButton, minus, plus);
  root.append(pad, tools);
  root.dataset.touch = 'true';
  enableHudTaps(root);

  const axes = { side: 0, forward: 0 };
  let owner: number | undefined;
  let centerX = 0,
    centerY = 0,
    radius = 1;
  function update(event: PointerEvent) {
    if (event.pointerId !== owner) return;
    const dx = (event.clientX - centerX) / radius;
    const dy = (event.clientY - centerY) / radius;
    const length = Math.hypot(dx, dy);
    const cap = Math.max(1, length);
    axes.side = length < 0.13 ? 0 : dx / cap;
    axes.forward = length < 0.13 ? 0 : -dy / cap;
    thumb.style.transform = 'translate(' + (dx / cap) * radius + 'px,' + (dy / cap) * radius + 'px)';
  }
  function reset() {
    const captured = owner;
    owner = undefined;
    axes.side = axes.forward = 0;
    thumb.style.transform = '';
    if (captured !== undefined && pad.hasPointerCapture(captured)) pad.releasePointerCapture(captured);
  }
  pad.addEventListener('pointerdown', (event) => {
    if (owner !== undefined || event.button !== 0) return;
    event.preventDefault();
    const box = pad.getBoundingClientRect();
    centerX = box.left + box.width / 2;
    centerY = box.top + box.height / 2;
    radius = (box.width - thumb.offsetWidth) / 2 - 5;
    owner = event.pointerId;
    pad.setPointerCapture(owner);
    update(event);
  });
  pad.addEventListener('pointermove', update);
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    pad.addEventListener(kind, (event) => {
      if (event.pointerId === owner) reset();
    });
  }
  window.addEventListener('resize', reset);
  return {
    axes,
    reset,
    pace(isCrouching: boolean, isRunning: boolean) {
      crouchButton.setAttribute('aria-pressed', String(isCrouching));
      runButton.setAttribute('aria-pressed', String(isRunning));
    },
  };
}
