import { TEXT } from '../data/text';
import type { UI } from '../render/ui';
import { P } from '../render/palette';
import { drawSummerTitle } from '../render/summer';

export function drawTitle(ui: UI, hasSave: boolean, muted = false): void {
  const c = ui.ctx;
  c.fillStyle = P.paper; c.fillRect(0, 0, 360, 640);
  drawSummerTitle(c);
  // タイトル → 副題 → 操作説明の順に縦に積む（重ならないよう間隔を固定）。
  ui.text(TEXT.title, 180, 96, 34, P.ink, 'center');
  ui.text(TEXT.subtitle, 180, 126, 16, P.green, 'center');
  ui.text(TEXT.keyboard, 180, 152, 12, P.ink, 'center');
  ui.text(TEXT.keyboardMore, 180, 170, 12, P.ink, 'center');
  TEXT.intro.forEach((line, i) => ui.text(line, 180, 410 + i * 25, 15, P.ink, 'center'));
  ui.button(hasSave ? TEXT.continue : TEXT.start, hasSave ? 'continue' : 'start', 70, 496, 220, 48, true);
  if (hasSave) ui.button(TEXT.restart, 'start', 70, 555, 220);
  ui.text(TEXT.saved, 180, 617, 13, P.muted, 'center');
  ui.button(muted ? TEXT.soundOff : TEXT.soundOn, 'toggle-sound', 244, 18, 100, 32);
}
