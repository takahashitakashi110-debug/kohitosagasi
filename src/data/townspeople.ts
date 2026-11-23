import type { SpotId } from '../game/state';

export const RESIDENT_IDS = ['shutter_breather', 'drain_greeter', 'shadow_measurer', 'wind_angler'] as const;
export type ResidentId = typeof RESIDENT_IDS[number];
export interface Resident { id: ResidentId; spot: SpotId; x: number; y: number }
export const RESIDENTS: readonly Resident[] = [
  { id: 'shutter_breather', spot: 'shoutengai', x: 300, y: 552 },
  { id: 'drain_greeter', spot: 'kawazoi', x: 396, y: 492 },
  { id: 'shadow_measurer', spot: 'danchi', x: 300, y: 552 },
  { id: 'wind_angler', spot: 'ekimae', x: 216, y: 552 },
];
export function residentAt(spot: SpotId | 'home'): Resident | undefined { return RESIDENTS.find(r => r.spot === spot); }
