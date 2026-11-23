import type { SoundEvent } from './plan';

export const SAMPLE_URLS = {
  shutter: new URL('../assets/sound/shutter.mp3', import.meta.url).href,
  hint: new URL('../assets/sound/hint.mp3', import.meta.url).href,
  resident: new URL('../assets/sound/resident.mp3', import.meta.url).href,
  ending: new URL('../assets/sound/ending.mp3', import.meta.url).href,
};
export type SampleKey = keyof typeof SAMPLE_URLS;
export function sampleFor(event: SoundEvent): SampleKey | undefined {
  return event.type === 'shutter' || event.type === 'hint' || event.type === 'resident' || event.type === 'ending' ? event.type : undefined;
}
