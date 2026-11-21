import { SPOT_IDS, TIMES } from './state';
import type { KohitoId, SpotId, TimeSlot } from './state';

export interface Candidate { spot: SpotId; time: TimeSlot }
export function remainingCandidates(hints: KohitoId[]): Candidate[] {
  return SPOT_IDS.flatMap(spot => TIMES.map(time => ({ spot, time }))).filter(candidate =>
    !(hints.includes('urasumi') && (candidate.time === 'morning' || candidate.time === 'noon')) &&
    !(hints.includes('haritsuki') && candidate.spot === 'shoutengai') &&
    !(hints.includes('noboriyurashi') && candidate.spot === 'danchi') &&
    !(hints.includes('kagebousi') && candidate.spot === 'ekimae') &&
    !(hints.includes('dobunozoki') && candidate.time === 'night'));
}
