import { toLogical } from './canvas';
import type { Point } from './canvas';

export interface HitButton { x: number; y: number; w: number; h: number; action: string }
export class Input {
  readonly keys = new Set<string>();
  readonly commands: string[] = [];
  buttons: HitButton[] = [];
  stick: Point = { x: 0, y: 0 };
  stickPointer: number | null = null;
  private cameraPointers = new Set<number>();
  private suppressedCamera = false;
  fieldControls = false;
  constructor(canvas: HTMLCanvasElement) {
    const updateStick = (event: PointerEvent): void => {
      const point = toLogical(canvas, event.clientX, event.clientY);
      const x = point.x - 70;
      const y = point.y - 555;
      const divisor = Math.max(44, Math.hypot(x, y));
      this.stick = { x: x / divisor, y: y / divisor };
    };
    canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
      const point = toLogical(canvas, event.clientX, event.clientY);
      const hit = [...this.buttons].reverse().find(b => point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h);
      if (hit?.action === 'camera') this.cameraPointers.add(event.pointerId);
      else if (hit) this.commands.push(hit.action);
      else if (this.fieldControls && point.x < 135 && point.y > 485 && this.stickPointer === null) {
        this.stickPointer = event.pointerId;
        updateStick(event);
      }
    });
    canvas.addEventListener('pointermove', event => { if (event.pointerId === this.stickPointer) updateStick(event); });
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.stickPointer) { this.stickPointer = null; this.stick = { x: 0, y: 0 }; }
      this.cameraPointers.delete(event.pointerId);
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', event => { release(event); this.commands.push('cancel'); });
    window.addEventListener('keydown', event => {
      if (['Space', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (!event.repeat) {
        if (event.code === 'Tab') this.commands.push('album');
        if (event.code === 'Escape') this.commands.push('cancel');
        if (event.code === 'Enter') this.commands.push('primary');
        if (event.code === 'Space') this.commands.push('confirm');
        if (['KeyW', 'ArrowUp'].includes(event.code)) this.commands.push('nav:up');
        if (['KeyS', 'ArrowDown'].includes(event.code)) this.commands.push('nav:down');
        if (['KeyA', 'ArrowLeft'].includes(event.code)) this.commands.push('nav:left');
        if (['KeyD', 'ArrowRight'].includes(event.code)) this.commands.push('nav:right');
      }
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.cameraPointers.clear(); this.stickPointer = null; this.stick = { x: 0, y: 0 }; this.commands.push('cancel'); });
  }
  get cameraHeld(): boolean {
    const held = this.keys.has('Space') || this.cameraPointers.size > 0;
    if (!held) this.suppressedCamera = false;
    return held && !this.suppressedCamera;
  }
  suppressCamera(): void { this.suppressedCamera = true; }
  get movement(): Point & { sneaking: boolean; moving: boolean } {
    let x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    let y = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
    const keyboard = x !== 0 || y !== 0;
    if (!keyboard) { x = this.stick.x; y = this.stick.y; }
    const length = Math.hypot(x, y);
    return { x: length > 0 ? x / length : 0, y: length > 0 ? y / length : 0, moving: length > 0.04,
      sneaking: keyboard ? this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') : length <= 0.5 };
  }
  get pan(): number {
    return this.stick.x || Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
  }
}
