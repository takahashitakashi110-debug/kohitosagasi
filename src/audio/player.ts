import { MASTER_VOLUME } from './plan';
import type { Note } from './plan';

export interface SoundPlayer {
  unlock(): void;
  play(notes: readonly Note[]): void;
  silence(): void;
}
interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[]; vibrato?: OscillatorNode }

/** AudioContextを所有する唯一の層。ユーザー操作前は作らず、使えない場合は無音にする。 */
export class WebAudioPlayer implements SoundPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly voices = new Set<Voice>();
  constructor(private readonly makeContext: () => AudioContext = () => new AudioContext()) {}

  unlock(): void {
    try {
      if (!this.context) {
        const context = this.makeContext();
        const master = context.createGain(); master.gain.value = MASTER_VOLUME;
        master.connect(context.destination); this.context = context; this.master = master;
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Web Audio非対応・利用不可でもゲームを止めない。 */ }
  }
  play(notes: readonly Note[]): void {
    const context = this.context; const master = this.master;
    if (!context || !master || context.state !== 'running') return;
    try {
      for (const note of notes) this.schedule(context, master, note);
    } catch { this.silence(); }
  }
  silence(): void {
    for (const voice of this.voices) {
      // まだ開始していない旋律の音も止め、ミュート解除後に持ち越さない。
      try { voice.source.stop(); } catch { /* 既に終了済み。 */ }
      try { voice.vibrato?.stop(); } catch { /* 同上。 */ }
      for (const node of voice.nodes) node.disconnect();
    }
    this.voices.clear();
  }
  private schedule(context: AudioContext, master: GainNode, note: Note): void {
    const start = context.currentTime + note.delay; const end = start + note.duration;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.volume, start + Math.min(0.008, note.duration / 5));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.gain.setValueAtTime(0, end); gain.connect(master);
    let source: OscillatorNode | AudioBufferSourceNode;
    const nodes: AudioNode[] = [gain]; let vibrato: OscillatorNode | undefined;
    if (note.wave === 'noise') {
      const noise = context.createBufferSource();
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * note.duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass';
      filter.frequency.setValueAtTime(note.frequency, start);
      filter.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
      noise.connect(filter); filter.connect(gain); nodes.push(filter); source = noise;
    } else {
      const oscillator = context.createOscillator(); oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
      oscillator.connect(gain); source = oscillator;
      if (note.vibrato) {
        vibrato = context.createOscillator(); vibrato.frequency.value = note.vibrato.frequency;
        const depth = context.createGain(); depth.gain.value = note.vibrato.depth;
        vibrato.connect(depth); depth.connect(oscillator.frequency); nodes.push(depth, vibrato);
      }
    }
    nodes.push(source); const voice: Voice = { source, nodes, vibrato }; this.voices.add(voice);
    source.onended = () => { for (const node of nodes) node.disconnect(); this.voices.delete(voice); };
    source.start(start); source.stop(end); vibrato?.start(start); vibrato?.stop(end);
  }
}
