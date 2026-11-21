import { describe, expect, it } from 'vitest';
import { remainingCandidates } from '../src/game/deduction';
import type { KohitoId } from '../src/game/state';

const hints: KohitoId[] = ['urasumi', 'haritsuki', 'noboriyurashi', 'kagebousi', 'dobunozoki'];
describe('deduction', () => {
  it('starts with sixteen', () => expect(remainingCandidates([])).toHaveLength(16));
  it.each([8, 6, 4, 2, 1])('reduces to %s in the specified order', count => expect(remainingCandidates(hints.slice(0, [8, 6, 4, 2, 1].indexOf(count) + 1))).toHaveLength(count));
  it('ends at riverside evening regardless of order', () => {
    expect(remainingCandidates(hints)).toEqual([{ spot: 'kawazoi', time: 'evening' }]);
    expect(remainingCandidates([...hints].reverse())).toEqual(remainingCandidates(hints));
  });
  it.each(hints)('needs the clue from %s', omitted => expect(remainingCandidates(hints.filter(id => id !== omitted)).length).toBeGreaterThanOrEqual(2));
  it('duplicate hints are idempotent', () => expect(remainingCandidates([...hints, ...hints])).toEqual(remainingCandidates(hints)));
});
