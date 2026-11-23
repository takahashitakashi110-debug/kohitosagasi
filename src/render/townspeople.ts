import { RESIDENT_IDS } from '../data/townspeople';
import type { ResidentId } from '../data/townspeople';
import { localImage, motionFrame } from './summerImages';
import { P } from './palette';

const sheet = localImage(new URL('../assets/motion/townspeople-motion.webp', import.meta.url).href);
export function drawResident(c: CanvasRenderingContext2D, id: ResidentId, x: number, y: number, elapsed: number): void {
  c.save(); c.translate(x, y);
  const image = sheet();
  if (image) c.drawImage(image, motionFrame(elapsed) * 256 + 4, RESIDENT_IDS.indexOf(id) * 256 + 4, 248, 248, -24, -55, 48, 64);
  else {
    // A recognizably human silhouette remains available without any decoded image.
    c.fillStyle = id === 'wind_angler' ? P.red : P.green;
    c.fillRect(-9, -30, 18, 27);
    c.fillStyle = P.sand; c.beginPath(); c.ellipse(0, -39, 8, 10, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = 4; c.beginPath();
    c.moveTo(-5, -3); c.lineTo(-6, 9); c.moveTo(5, -3); c.lineTo(6, 9);
    c.moveTo(-9, -25); c.lineTo(-17, -12); c.moveTo(9, -25); c.lineTo(17, -12); c.stroke();
  }
  c.restore();
}
