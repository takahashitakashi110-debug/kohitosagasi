import { TEXT } from '../data/text';
import { HINT_IDS } from '../data/kohito';
import type { GameState } from '../game/state';
import { clamp } from '../game/photo';
import { drawKohito } from '../render/kohitoArt';
import { P } from '../render/palette';
import type { UI } from '../render/ui';

export function drawEnding(ui: UI, game: GameState): void {
  const c = ui.ctx;
  const t = game.endingTime;
  c.fillStyle = P.sand; c.fillRect(0, 0, 360, 640);
  c.fillStyle = P.wallLight; c.fillRect(0, 217, 360, 225);
  c.fillStyle = P.concrete; c.fillRect(0, 229, 360, 201);
  c.fillStyle = P.water; c.beginPath(); c.ellipse(180, 354, 5 + clamp((t - 2) / 5, 0, 1) * 60, 3 + clamp((t - 2) / 5, 0, 1) * 22, 0, 0, Math.PI * 2); c.fill();
  drawKohito(c, 'tarejiri', 180, 297 + clamp(t / 2, 0, 1) * 26, t, t > 2);
  if (t > 5) HINT_IDS.forEach((id, i) => {
    const angle = Math.PI * 2 * i / 5;
    const approach = 160 - clamp((t - 5) / 4, 0, 1) * 89;
    drawKohito(c, id, 180 + Math.cos(angle) * approach, 346 + Math.sin(angle) * approach * 0.55, t);
  });
  ui.text(TEXT.title, 180, 82, 30, P.ink, 'center');
  const index = t < 2 ? 0 : t < 5 ? 1 : t < 9 ? 2 : 3;
  ui.wrap(TEXT.ending[index] ?? '', 28, 480, 304, 17);
  if (t >= 9) {
    ui.text(TEXT.clearedDays(game.save.clearedDay ?? game.save.day), 180, 538, 18, P.green, 'center');
    ui.button(TEXT.viewAlbum, 'album', 76, 577, 208, 46, true);
  }
}
