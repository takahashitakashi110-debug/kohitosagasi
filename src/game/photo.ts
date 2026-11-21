export type Framing = 'miss' | 'partial' | 'half' | 'full';
export interface ShotInput {
  subject: { x: number; y: number; w: number; h: number };
  finder: { x: number; y: number; w: number; h: number };
  heldMs: number;
  distance: number;
  moment: boolean;
}
export interface ShotResult {
  framing: Framing; coverage: number; focus: number; distScore: number; moment: boolean; score: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D' | 'fail';
}
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export function scoreShot(input: ShotInput): ShotResult {
  const { subject: s, finder: f } = input;
  const area = s.w * s.h;
  const overlap = Math.max(0, Math.min(s.x + s.w, f.x + f.w) - Math.max(s.x, f.x)) * Math.max(0, Math.min(s.y + s.h, f.y + f.h) - Math.max(s.y, f.y));
  const coverage = area > 0 && s.w > 0 && s.h > 0 ? clamp(overlap / area, 0, 1) : 0;
  const framing: Framing = coverage >= 0.95 ? 'full' : coverage >= 0.5 ? 'half' : coverage > 0 ? 'partial' : 'miss';
  const focus = clamp(input.heldMs / 1200, 0, 1);
  const distScore = clamp((200 - input.distance) / 160, 0, 1);
  const weights = { full: 1, half: 0.6, partial: 0.25, miss: 0 };
  const score = framing === 'miss' ? 0 : Math.round(clamp(100 * (0.4 * weights[framing] + 0.3 * focus + 0.2 * distScore) + (input.moment ? 20 : 0), 0, 100));
  const rank = framing === 'miss' ? 'fail' : score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 25 ? 'C' : 'D';
  return { framing, coverage, focus, distScore, moment: input.moment, score, rank };
}
export function shotStage(shot: ShotResult): 0 | 1 | 2 | 3 {
  if (shot.framing === 'miss') return 0;
  if (shot.framing === 'full' && (shot.focus >= 0.9 || shot.moment)) return 3;
  if ((shot.framing === 'half' || shot.framing === 'full') && shot.focus >= 0.6) return 2;
  return 1;
}
