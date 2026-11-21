export function startLoop(update: (dt: number) => void, render: () => void): () => void {
  const step = 1 / 60;
  let previous = performance.now();
  let accumulator = 0;
  let frame = 0;
  let active = true;
  const tick = (now: number): void => {
    accumulator += Math.min((now - previous) / 1000, 0.1);
    previous = now;
    while (accumulator >= step) { update(step); accumulator -= step; }
    render();
    if (active) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { active = false; cancelAnimationFrame(frame); };
}
