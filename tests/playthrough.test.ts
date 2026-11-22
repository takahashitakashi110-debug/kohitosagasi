import { describe, expect, it } from 'vitest';
import { createGame, freshSave, nextDay } from '../src/game/state';
import type { GameState, KohitoId, SpotId } from '../src/game/state';
import { clearEscaped, enterField, restoreEscaped, travel } from '../src/game/flow';
import { nearestKohito, updateFieldKohitos } from '../src/scenes/field';
import { takePhoto } from '../src/scenes/camera';
import { remainingCandidates } from '../src/game/deduction';
import { loadSave, parseSave } from '../src/game/save';
import { KOHITO } from '../src/data/kohito';

/**
 * 実際のモジュールを通して3日間のクリアまで遊びきる統合テスト。
 * MVP_SPEC.md §12 の受け入れ条件 5〜12 を、手で触らずに毎回検証するためのもの。
 */

const DT = 1 / 60;

function newGame(): GameState {
  const game = createGame(freshSave());
  game.scene = 'map';
  return game;
}

/** こひとの 25px 下に立つ。ファインダーに全身が収まり、距離点も満点になる位置。 */
function standNear(game: GameState, id: KohitoId, dy = 25): void {
  const def = KOHITO[id];
  game.player = { x: def.x, y: def.y + dy };
}

/** その場に立ったまま dt を進める（足音ゼロなので警戒度は上がらない）。 */
function idle(game: GameState, seconds: number): void {
  game.moving = false;
  for (let i = 0; i < Math.round(seconds / DT); i++) updateFieldKohitos(game, DT, false);
}

/** 目の前のこひとを、ピントを合わせきって撮る。 */
function shoot(game: GameState, heldMs = 1200): void {
  const target = nearestKohito(game);
  expect(target, 'カメラを向けられるこひとがいる').toBeDefined();
  game.cameraTarget = target?.id ?? null;
  game.heldMs = heldMs;
  game.pan = 0;
  takePhoto(game);
}

/** スポットへ移動して、そこにいるこひとを1体撮る。 */
function visitAndShoot(game: GameState, spot: SpotId, id: KohitoId): void {
  travel(game, spot);
  expect(game.scene, `${spot} で散策が始まる`).toBe('field');
  expect(game.kohitos.map(k => k.id), `${spot} に ${id} が出る`).toContain(id);
  standNear(game, id);
  shoot(game);
}

function endDay(game: GameState): void {
  travel(game, 'home');
  expect(game.scene, '夜に帰ると その日のまとめ になる').toBe('dayend');
  nextDay(game.save);
  game.escaped.clear();
  game.visitKey = '';
  game.scene = 'map';
}

describe('3日間のクリアまで通しで遊ぶ', () => {
  it('ヒント5つを集めて、たれじりの全身を撮ってクリアできる', () => {
    const game = newGame();

    // --- 1日目: 朝 川沿い / 昼 団地 / 夕 商店街 / 夜 駅前 ---
    expect(game.save.day).toBe(1);
    expect(game.save.time).toBe('morning');
    visitAndShoot(game, 'kawazoi', 'dobunozoki');
    expect(game.save.time, 'いえ→最初のスポットでは時間が進まない').toBe('morning');

    travel(game, 'danchi');
    expect(game.save.time, 'スポットを移ると1区分進む').toBe('noon');
    expect(game.kohitos, '団地の昼にはこひとがいない').toHaveLength(0);

    visitAndShoot(game, 'shoutengai', 'noboriyurashi');
    expect(game.save.time).toBe('evening');
    visitAndShoot(game, 'ekimae', 'urasumi');
    expect(game.save.time).toBe('night');

    expect(game.save.hints.sort()).toEqual(['dobunozoki', 'noboriyurashi', 'urasumi']);
    // 夜を除外・団地を除外・朝昼を除外 → 商店街/川沿い/駅前 の夕、の3マス。
    expect(remainingCandidates(game.save.hints), '3つでは絞りきれない').toHaveLength(3);
    endDay(game);

    // --- 2日目: 昼 商店街 / 夜 団地 ---
    expect(game.save.day).toBe(2);
    travel(game, 'kawazoi');
    visitAndShoot(game, 'shoutengai', 'haritsuki');
    expect(game.save.time).toBe('noon');

    travel(game, 'kawazoi');
    expect(game.save.time).toBe('evening');
    expect(game.kohitos.map(k => k.id), 'ヒント4つではまだ たれじり は出ない').not.toContain('tarejiri');
    expect(remainingCandidates(game.save.hints), '4つでは2マス残る').toHaveLength(2);

    visitAndShoot(game, 'danchi', 'kagebousi');
    expect(game.save.time).toBe('night');

    expect(game.save.hints).toHaveLength(5);
    expect(remainingCandidates(game.save.hints), '5つで1マスに確定する')
      .toEqual([{ spot: 'kawazoi', time: 'evening' }]);
    endDay(game);

    // --- 3日目: 夕 川沿い でクリア ---
    expect(game.save.day).toBe(3);
    travel(game, 'shoutengai');
    travel(game, 'danchi');
    travel(game, 'kawazoi');
    expect(game.save.time).toBe('evening');

    const tarejiri = game.kohitos.find(k => k.id === 'tarejiri');
    expect(tarejiri, 'ヒントがそろうと たれじり が出る').toBeDefined();
    if (!tarejiri) return;

    // 隠れている間は、どう撮っても全身にならない。
    standNear(game, 'tarejiri', 25);
    shoot(game);
    expect(game.save.album.tarejiri?.best.framing, '隠れた尻だけでは全身にならない').not.toBe('full');
    expect(game.save.cleared, '隠れたままではクリアにならない').toBe(false);
    game.feedback = null;
    game.scene = 'field';

    // 60〜120px の距離で落ち着いて待つと、物陰から出てくる。
    standNear(game, 'tarejiri', 90);
    expect(tarejiri.fullRemaining).toBe(0);
    idle(game, 3);
    expect(tarejiri.fullRemaining, '4秒たつまでは出てこない').toBe(0);
    idle(game, 1.2);
    expect(tarejiri.fullRemaining, '4秒待つと出てくる').toBeGreaterThan(0);

    // 出ている8秒のうちに近づいて全身を撮る。
    standNear(game, 'tarejiri', 25);
    shoot(game);

    expect(game.save.album.tarejiri?.best.framing).toBe('full');
    expect(game.save.cleared, '全身を撮るとクリア').toBe(true);
    expect(game.save.clearedDay).toBe(3);
    expect(game.scene).toBe('ending');
  });

  it('撮った記録がセーブに残り、読み直しても復元できる', () => {
    const game = newGame();
    visitAndShoot(game, 'kawazoi', 'dobunozoki');

    const entry = game.save.album.dobunozoki;
    expect(entry, 'アルバムに記録される').toBeDefined();
    expect(entry?.stage, 'きちんと撮れば鳴き声まで埋まる').toBe(3);
    expect(entry?.day).toBe(1);
    expect(entry?.time).toBe('morning');
    expect(entry?.spot).toBe('kawazoi');
    expect(game.save.hints, '生態メモまで届くとヒントが入る').toContain('dobunozoki');

    const restored = parseSave(JSON.stringify(game.save));
    expect(restored).toEqual(game.save);
  });

  it('雑な写真ではヒントがもらえない', () => {
    const game = newGame();
    travel(game, 'kawazoi');
    standNear(game, 'dobunozoki');
    shoot(game, 300); // ピント 0.25 なので 生態メモ に届かない

    expect(game.save.album.dobunozoki?.stage).toBe(1);
    expect(game.save.hints, 'ヒントは入らない').toHaveLength(0);
    expect(remainingCandidates(game.save.hints)).toHaveLength(16);
  });

  it('逃げた記録は保存され、リロードしても同じ時間区分には戻ってこない', () => {
    const game = newGame();
    travel(game, 'kawazoi');
    standNear(game, 'dobunozoki', 5);
    game.moving = true;
    game.sneaking = false;
    for (let i = 0; i < 60 * 6; i++) updateFieldKohitos(game, DT, false);
    expect(game.escaped.has('dobunozoki')).toBe(true);
    expect(game.save.escaped, '逃げた瞬間に保存データへ載る').toEqual(['dobunozoki']);

    // リロード相当: 保存データから新しいゲームを作り、「つづける」と同じ手順で戻る。
    const reloaded = createGame(loadSave(), true);
    restoreEscaped(reloaded);
    reloaded.visitKey = '';
    enterField(reloaded);
    expect(reloaded.save.time).toBe('morning');
    expect(reloaded.kohitos.map(k => k.id), 'リロードしても同じ時間区分には出ない').not.toContain('dobunozoki');

    // 翌日になれば保存データからも消えて、また出る。
    travel(reloaded, 'home');
    nextDay(reloaded.save);
    clearEscaped(reloaded);
    reloaded.visitKey = '';
    travel(reloaded, 'kawazoi');
    expect(reloaded.save.escaped).toEqual([]);
    expect(reloaded.kohitos.map(k => k.id)).toContain('dobunozoki');
  });

  it('気づかれると逃げ、その時間区分では戻ってこない', () => {
    const game = newGame();
    travel(game, 'kawazoi');
    standNear(game, 'dobunozoki', 5);

    // 至近距離で普通に歩きまわると気づかれる。
    game.moving = true;
    game.sneaking = false;
    for (let i = 0; i < 60 * 6; i++) updateFieldKohitos(game, DT, false);

    const dobunozoki = game.kohitos.find(k => k.id === 'dobunozoki');
    expect(dobunozoki?.escaped, '警戒度が振り切れると逃げる').toBe(true);
    expect(game.escaped.has('dobunozoki')).toBe(true);
    expect(nearestKohito(game), '逃げた後はカメラを向けられない').toBeUndefined();

    // 同じ時間区分のうちに戻っても出てこない。
    travel(game, 'kawazoi');
    expect(game.save.time, '同じスポットへ戻っても時間は進まない').toBe('morning');
    expect(game.kohitos.find(k => k.id === 'dobunozoki')?.escaped).toBe(true);

    // 時間が進めば記録は消える。
    travel(game, 'danchi');
    expect(game.save.time).toBe('noon');
    expect(game.escaped.size, '時間が進むと逃げた記録はリセットされる').toBe(0);
    expect(game.save.escaped, '保存データの逃走記録も消える').toEqual([]);

    // 翌日の朝には戻っている。
    endDay(game);
    travel(game, 'kawazoi');
    expect(game.save.day).toBe(2);
    expect(game.kohitos.map(k => k.id), '翌日の朝にはまた出る').toContain('dobunozoki');
  });

  it('忍び足なら、普通に歩くより気づかれにくい', () => {
    const walk = newGame();
    travel(walk, 'kawazoi');
    standNear(walk, 'dobunozoki', 20);
    walk.moving = true; walk.sneaking = false;
    for (let i = 0; i < 60; i++) updateFieldKohitos(walk, DT, false);

    const sneak = newGame();
    travel(sneak, 'kawazoi');
    standNear(sneak, 'dobunozoki', 20);
    sneak.moving = true; sneak.sneaking = true;
    for (let i = 0; i < 60; i++) updateFieldKohitos(sneak, DT, false);

    const walked = walk.kohitos[0]?.awareness ?? 0;
    const sneaked = sneak.kohitos[0]?.awareness ?? 0;
    expect(walked).toBeGreaterThan(0);
    expect(sneaked).toBeGreaterThan(0);
    expect(sneaked).toBeLessThan(walked);
  });

  it('1日は4回まで、夜に出ると帰宅になる', () => {
    const game = newGame();
    travel(game, 'kawazoi');
    expect(game.save.time).toBe('morning');
    travel(game, 'danchi');
    expect(game.save.time).toBe('noon');
    travel(game, 'ekimae');
    expect(game.save.time).toBe('evening');
    travel(game, 'shoutengai');
    expect(game.save.time).toBe('night');

    travel(game, 'danchi');
    expect(game.scene, '夜のスポットを出ると帰宅する').toBe('dayend');
    expect(game.save.location).toBe('home');
  });

  it('同じスポットに留まっている間は時間が進まない', () => {
    const game = newGame();
    travel(game, 'kawazoi');
    enterField(game);
    enterField(game);
    travel(game, 'kawazoi');
    expect(game.save.time).toBe('morning');
    expect(game.save.day).toBe(1);
  });
});
