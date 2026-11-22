export interface ButtonRect { x: number; y: number; w: number; h: number; action: string }

/** Inputの当たり判定は端も含むため、辺が触れる場合も重複とする。 */
export function buttonsOverlap(a: ButtonRect, b: ButtonRect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w
    && a.y <= b.y + b.h && b.y <= a.y + a.h;
}
