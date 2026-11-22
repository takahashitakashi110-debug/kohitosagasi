import { planSound } from './plan';
import type { SoundEvent } from './plan';
import { WebAudioPlayer } from './player';
import type { SoundPlayer } from './player';
import { browserStorage, readMuted, writeMuted } from './settings';
import type { StorageSource } from './settings';

export class SoundController {
  private isMuted: boolean;
  get muted(): boolean { return this.isMuted; }
  constructor(private readonly player: SoundPlayer = new WebAudioPlayer(), private readonly storage: StorageSource = browserStorage) {
    this.isMuted = readMuted(storage);
  }
  unlock(): void { this.player.unlock(); }
  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.isMuted) this.player.silence();
    writeMuted(this.isMuted, this.storage);
  }
  play(events: readonly SoundEvent[]): void {
    if (this.isMuted) return;
    for (const event of events) this.player.play(planSound(event));
  }
}
