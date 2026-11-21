import { KOHITO } from '../data/kohito';
import { SPAWN } from '../data/spots';
import { remainingCandidates } from './deduction';
import { createKohito } from './kohito';
import { advanceLocation } from './state';
import type { GameState, SpotId } from './state';
import { writeSave } from './save';

/**
 * 現在地（save.location）と時間区分に応じて、こひとの配置と足場を作り直す。
 * 同じ「日・時間・場所」に戻ってきただけのときは作り直さない
 * （逃げたこひとがその時間区分のうちに復活しないようにするため）。
 */
export function enterField(game: GameState): void {
  const save = game.save;
  const key = `${save.day}:${save.time}:${save.location}`;
  if (game.visitKey !== key) {
    game.visitKey = key;
    game.player = { ...SPAWN };
    game.kohitos = Object.values(KOHITO)
      .filter(def => def.spot === save.location && def.time === save.time &&
        (def.id !== 'tarejiri' || remainingCandidates(save.hints).length === 1) && !game.escaped.has(def.id))
      .map(def => createKohito(def.id, def.x, def.y));
    game.traces = remainingCandidates(save.hints).length > 1
      ? Array.from({ length: Math.random() < 0.5 ? 1 : 2 }, () => ({ x: 240 + Math.random() * 120, y: 340 + Math.random() * 60 }))
      : [];
  }
  game.scene = 'field'; game.moving = false; game.feedback = null;
}

/** 地図から移動する。時間が進んだら「逃げた」記録を捨てる。 */
export function travel(game: GameState, destination: SpotId | 'home'): void {
  const previousTime = game.save.time;
  const result = advanceLocation(game.save, destination);
  if (previousTime !== game.save.time) game.escaped.clear();
  game.scene = result;
  if (result === 'field') enterField(game);
  writeSave(game.save);
  game.hasSave = true;
}
