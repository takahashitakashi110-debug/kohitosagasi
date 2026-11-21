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
export const HINT_IDS: KohitoId[] = ['urasumi', 'haritsuki', 'noboriyurashi', 'kagebousi', 'dobunozoki'];
