import { TEXT } from '../data/text';
import { HINT_IDS } from '../data/kohito';
import { KOHITO_IDS, SPOT_IDS, TIMES } from '../game/state';
import type { GameState } from '../game/state';
import { remainingCandidates } from '../game/deduction';
import { drawKohito } from '../render/kohitoArt';
import { P } from '../render/palette';
import type { UI } from '../render/ui';

export function drawAlbum(ui: UI, game: GameState): void {
  const c = ui.ctx;
  c.fillStyle = P.paper; c.fillRect(0, 0, 360, 640);
  ui.text(TEXT.albumTitle, 180, 30, 19, P.ink, 'center');
  TEXT.tabs.forEach((tab, i) => ui.button(tab, `tab:${i}`, 16 + i * 112, 58, 104, 44, game.albumTab === i));
  if (game.albumTab === 2) {
    ui.text(TEXT.deduction, 180, 127, 19, P.ink, 'center');
    const remaining = remainingCandidates(game.save.hints);
    ui.text(TEXT.candidates(remaining.length), 180, 158, 16, P.green, 'center');
    TIMES.forEach((time, i) => ui.text(TEXT.times[time], 122 + i * 63, 195, 15, P.ink, 'center'));
    SPOT_IDS.forEach((spot, row) => {
      ui.text(TEXT.spots[spot], 14, 235 + row * 53, 15);
      TIMES.forEach((time, col) => {
        const alive = remaining.some(candidate => candidate.spot === spot && candidate.time === time);
        ui.panel(94 + col * 63, 214 + row * 53, 57, 44, alive ? remaining.length === 1 ? P.green : P.cream : P.sand);
        ui.text(alive ? remaining.length === 1 ? TEXT.here : '○' : '×', 122 + col * 63, 235 + row * 53, alive && remaining.length === 1 ? 15 : 24, alive && remaining.length === 1 ? P.white : P.muted, 'center');
      });
    });
    ui.text(TEXT.hintCount(game.save.hints.length), 22, 453, 16, P.green);
    const id = HINT_IDS[game.albumPage % HINT_IDS.length];
    if (id) {
      ui.text(game.save.hints.includes(id) ? TEXT.names[id] : TEXT.unknown, 22, 487, 15);
      ui.wrap(game.save.hints.includes(id) && id !== 'tarejiri' ? TEXT.hints[id] : TEXT.noHint, 22, 516, 316, 15);
    }
  } else {
    const id = KOHITO_IDS[game.albumPage % KOHITO_IDS.length];
    if (id) {
      const entry = game.save.album[id];
      ui.text(entry ? TEXT.names[id] : TEXT.unknown, 180, 131, 21, P.ink, 'center');
      ui.panel(28, 163, 304, game.albumTab === 0 ? 270 : 105, P.cream);
      if (game.albumTab === 0) {
        c.save(); c.beginPath(); c.rect(38, 173, 284, 220); c.clip();
        c.fillStyle = entry?.spot === 'kawazoi' ? P.water : entry?.spot === 'danchi' ? P.concrete : P.sand; c.fillRect(38, 173, 284, 220);
        if (entry) {
          c.translate(entry.best.framing === 'partial' ? 305 : entry.best.framing === 'half' ? 280 : 180, 298); c.scale(3, 3);
          c.globalAlpha = 0.6 + entry.best.focus * 0.4;
          drawKohito(c, id, 0, 0, 0, entry.best.moment, id === 'tarejiri' && entry.best.framing !== 'full');
        }
        c.restore();
        ui.text(entry ? `${TEXT.rank(entry.best.rank)} / ${TEXT.score(entry.best.score)}` : TEXT.stages[0], 180, 412, 17, P.green, 'center');
        if (entry) {
          ui.text(`${TEXT.dayTime(entry.day, TEXT.times[entry.time])}・${TEXT.spots[entry.spot]}`, 180, 462, 16, P.ink, 'center');
          ui.text(`${TEXT.framing[entry.best.framing]} / ${TEXT.focusValue(entry.best.focus)}`, 180, 497, 16, P.ink, 'center');
        }
      } else {
        ui.text(TEXT.stages[entry?.stage ?? 0] ?? TEXT.stages[0], 180, 192, 19, P.green, 'center');
        if (entry) ui.wrap(TEXT.clues[id], 45, 226, 270, 15);
        if (entry && entry.stage >= 2) {
          ui.wrap(id === 'tarejiri' ? TEXT.waitTarejiri : TEXT.hints[id], 28, 306, 304, 16);
        } else ui.wrap(TEXT.noHint, 28, 306, 304, 16, P.muted);
        if (entry && entry.stage >= 3) ui.text(TEXT.calls[id], 180, 454, 24, P.green, 'center');
      }
    }
  }
  const pages = game.albumTab === 2 ? 5 : 6;
  ui.button(TEXT.previous, 'previous', 16, 582, 94);
  ui.text(`${game.albumPage % pages + 1} / ${pages}`, 180, 563, 14, P.muted, 'center');
  ui.button(TEXT.back, 'back', 126, 582, 108, 44, true);
  ui.button(TEXT.next, 'next', 250, 582, 94);
}
