import { TEXT } from '../data/text';
import type { UI } from '../render/ui';
import { P } from '../render/palette';

export function drawTitle(ui: UI, hasSave: boolean): void {
  const c = ui.ctx;
  c.fillStyle = P.sand; c.fillRect(0, 0, 360, 640);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? P.wallLight : P.concrete; c.fillRect(i * 52 - 20, 220 - i % 3 * 14, 46, 155); }
  c.fillStyle = P.grass; c.fillRect(0, 354, 360, 35);
  ui.text(TEXT.subtitle, 180, 93, 17, P.green, 'center');
  ui.text(TEXT.keyboard, 180, 126, 13, P.ink, 'center');
  ui.text(TEXT.keyboardMore, 180, 149, 13, P.ink, 'center');
  ui.text(TEXT.title, 180, 145, 36, P.ink, 'center');
  c.fillStyle = P.skin; c.beginPath(); c.ellipse(180, 315, 25, 35, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.ink; c.beginPath(); c.arc(174, 304, 3, 0, Math.PI * 2); c.fill();
  TEXT.intro.forEach((line, i) => ui.text(line, 180, 410 + i * 25, 15, P.ink, 'center'));
  ui.button(hasSave ? TEXT.continue : TEXT.start, hasSave ? 'continue' : 'start', 70, 496, 220, 48, true);
  if (hasSave) ui.button(TEXT.restart, 'start', 70, 555, 220);
  ui.text(TEXT.saved, 180, 617, 13, P.muted, 'center');
}
