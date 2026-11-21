export const WIDTH = 360;
export const HEIGHT = 640;
export interface Point { x: number; y: number }

export function toLogical(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) * WIDTH / rect.width, y: (clientY - rect.top) * HEIGHT / rect.height };
}

export function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  const resize = (): void => {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();
  return context;
}
