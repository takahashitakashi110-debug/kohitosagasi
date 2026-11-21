import { TEXT } from '../data/text';
import { SPOT_IDS } from '../game/state';
import type { SaveData } from '../game/state';
import type { UI } from '../render/ui';
import { P } from '../render/palette';

export function drawMap(ui: UI, save: SaveData, choice = 0): void {
  const c = ui.ctx;
  c.fillStyle = P.paper; c.fillRect(0, 0, 360, 640);
  ui.text(TEXT.town, 24, 39, 25);
  ui.text(TEXT.dayTime(save.day, TEXT.times[save.time]), 24, 75, 17, P.green);
  ui.button(TEXT.album, 'album', 244, 20, 96);
  c.strokeStyle = P.sand; c.lineWidth = 24;
  c.beginPath(); c.moveTo(85, 170); c.lineTo(275, 430); c.moveTo(275, 170); c.lineTo(85, 430); c.stroke();
  c.strokeStyle = P.water; c.lineWidth = 10; c.beginPath(); c.moveTo(0, 270); c.bezierCurveTo(110, 230, 220, 410, 360, 350); c.stroke();
  SPOT_IDS.forEach((id, i) => {
    const x = i % 2 === 0 ? 24 : 196;
    const y = i < 2 ? 166 : 359;
    ui.panel(x, y - 38, 140, 115, P.sand);
    c.fillStyle = P.wall; c.fillRect(x + 30, y - 25, 70, 35);
    ui.button(TEXT.spots[id], `spot:${id}`, x, y + 24, 140, 48, choice === i);
  });
  ui.button(TEXT.home, 'home', 86, 473, 188, 44, choice === 4);
  TEXT.mapGuide.forEach((line, i) => ui.text(line, 180, 552 + i * 25, 14, P.muted, 'center'));
  ui.text(TEXT.hintCount(save.hints.length), 180, 614, 15, P.green, 'center');
  ui.text(TEXT.mapKeys, 180, 109, 14, P.green, 'center');
}
