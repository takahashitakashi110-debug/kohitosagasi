import type { KohitoId, SpotId, TimeSlot } from '../game/state';
export interface KohitoDefinition { id: KohitoId; spot: SpotId; time: TimeSlot; x: number; y: number }
export const KOHITO: Record<KohitoId, KohitoDefinition> = {
  urasumi: { id: 'urasumi', spot: 'ekimae', time: 'night', x: 288, y: 300 },
  haritsuki: { id: 'haritsuki', spot: 'shoutengai', time: 'noon', x: 288, y: 288 },
  dobunozoki: { id: 'dobunozoki', spot: 'kawazoi', time: 'morning', x: 288, y: 300 },
  noboriyurashi: { id: 'noboriyurashi', spot: 'shoutengai', time: 'evening', x: 360, y: 336 },
  kagebousi: { id: 'kagebousi', spot: 'danchi', time: 'night', x: 288, y: 300 },
  tarejiri: { id: 'tarejiri', spot: 'kawazoi', time: 'evening', x: 336, y: 324 },
};
/** 影を除いた描画全体（通常・決定的瞬間）を収める、立ち位置からの採点用矩形。 */
export const SUBJECT_BOUNDS: Record<KohitoId, { left: number; top: number; w: number; h: number }> = {
  urasumi: { left: -20, top: -10, w: 43, h: 26 },
  haritsuki: { left: -11, top: -30, w: 22, h: 45 },
  dobunozoki: { left: -15, top: -6, w: 30, h: 20 },
  noboriyurashi: { left: -20, top: -30, w: 43, h: 46 },
  kagebousi: { left: -20, top: -20, w: 40, h: 36 },
  tarejiri: { left: -15, top: -37, w: 35, h: 62 },
};
export const HINT_IDS: KohitoId[] = ['urasumi', 'haritsuki', 'noboriyurashi', 'kagebousi', 'dobunozoki'];
