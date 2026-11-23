import type { KohitoId } from '../game/state';

export type SoundEvent =
  | { type: 'step'; sneaking: boolean }
  | { type: 'focus'; level: 0.6 | 1 }
  | { type: 'shutter' | 'hint' | 'escape' | 'ending' | 'resident' }
  | { type: 'call'; id: KohitoId };

export interface Note {
  wave: 'sine' | 'triangle' | 'square' | 'noise';
  frequency: number; endFrequency: number;
  duration: number; volume: number; delay: number;
  vibrato?: { frequency: number; depth: number };
}
export const MASTER_VOLUME = 0.25;

function note(wave: Note['wave'], frequency: number, endFrequency: number,
  duration: number, volume: number, delay = 0): Note {
  return { wave, frequency, endFrequency, duration, volume, delay };
}
function drop(delay = 0): Note { return note('sine', 1150, 250, 0.24, 0.23, delay); }

/** 音の設計だけを返す。時刻・乱数・Web Audioには依存しない。 */
export function planSound(event: SoundEvent): Note[] {
  switch (event.type) {
    case 'step': return event.sneaking
      ? [note('triangle', 140, 80, 0.065, 0.04)]
      : [note('noise', 850, 320, 0.055, 0.23)];
    case 'focus': return [note('sine', event.level === 1 ? 1320 : 990, event.level === 1 ? 1320 : 990, 0.07, 0.12)];
    case 'shutter': return [note('noise', 2700, 900, 0.045, 0.26), note('noise', 1700, 450, 0.065, 0.2, 0.065)];
    // シャッターの2連が終わってから3音を鳴らす。
    case 'hint': return [660, 830, 1100].map((f, i) => note('sine', f, f, 0.13, 0.18, 0.18 + i * 0.16));
    case 'escape': return [note('triangle', 900, 140, 0.28, 0.16)];
    case 'resident': return [note('triangle', 420, 240, 0.18, 0.14, 0.15)];
    case 'ending': return [0, 0.8, 1.7, 2.7].map(delay => drop(delay));
    case 'call':
      switch (event.id) {
        case 'urasumi': return [0, 0.18].map(delay => note('triangle', 180, 110, 0.11, 0.2, delay));
        case 'haritsuki': return [0, 0.09, 0.18].map((delay, i) => note('square', 1500 + i * 180, 1250, 0.055, 0.08, delay));
        case 'dobunozoki': return [note('sine', 620, 170, 0.65, 0.23)];
        case 'noboriyurashi': return [0, 0.32].map(delay => ({ ...note('sine', 440, 380, 0.25, 0.19, delay), vibrato: { frequency: 9, depth: 32 } }));
        case 'kagebousi': return [note('noise', 1100, 350, 0.7, 0.13)];
        case 'tarejiri': return [drop()];
      }
  }
}
