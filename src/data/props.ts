import type { SpotId } from '../game/state';

export type PropKind = 'shutter' | 'sign' | 'bench' | 'bin' | 'line' | 'flyer' | 'drain' | 'leaves'
  | 'railing' | 'stones' | 'reeds' | 'crack' | 'silt' | 'puddle'
  | 'windows' | 'board' | 'bicycle' | 'hedge' | 'paving' | 'busStop' | 'clock' | 'crossing' | 'taxiLine' | 'gum';
export interface Prop { kind: PropKind; x: number; y: number; w: number; h: number; solid: boolean }

/** 見た目だけの配置。solidは通行判定ではなく「障害物に見える」ことを示す。 */
export const PROPS: Record<SpotId, Prop[]> = {
  shoutengai: [
    { kind: 'shutter', x: 68, y: 90, w: 128, h: 50, solid: true },
    { kind: 'sign', x: 400, y: 88, w: 104, h: 28, solid: true },
    { kind: 'shutter', x: 416, y: 226, w: 104, h: 58, solid: true },
    { kind: 'bench', x: 88, y: 456, w: 104, h: 26, solid: true },
    { kind: 'bin', x: 166, y: 626, w: 26, h: 38, solid: true },
    { kind: 'line', x: 252, y: 74, w: 12, h: 76, solid: false },
    { kind: 'flyer', x: 326, y: 122, w: 19, h: 14, solid: false },
    { kind: 'line', x: 414, y: 390, w: 72, h: 8, solid: false },
    { kind: 'flyer', x: 112, y: 354, w: 20, h: 14, solid: false },
    { kind: 'drain', x: 306, y: 534, w: 36, h: 24, solid: false },
    { kind: 'leaves', x: 414, y: 550, w: 50, h: 22, solid: false },
    { kind: 'line', x: 250, y: 676, w: 80, h: 8, solid: false },
  ],
  kawazoi: [
    { kind: 'railing', x: 70, y: 116, w: 124, h: 22, solid: true },
    { kind: 'stones', x: 405, y: 104, w: 60, h: 28, solid: true },
    { kind: 'reeds', x: 408, y: 184, w: 80, h: 32, solid: true },
    { kind: 'railing', x: 480, y: 374, w: 16, h: 110, solid: true },
    { kind: 'railing', x: 480, y: 554, w: 16, h: 108, solid: true },
    { kind: 'crack', x: 250, y: 106, w: 64, h: 24, solid: false },
    { kind: 'silt', x: 100, y: 328, w: 76, h: 24, solid: false },
    { kind: 'crack', x: 272, y: 486, w: 50, h: 24, solid: false },
    { kind: 'puddle', x: 310, y: 598, w: 72, h: 28, solid: false },
    { kind: 'stones', x: 112, y: 550, w: 66, h: 24, solid: true },
    { kind: 'crack', x: 108, y: 670, w: 70, h: 20, solid: false },
    { kind: 'silt', x: 270, y: 700, w: 100, h: 10, solid: false },
  ],
  danchi: [
    { kind: 'windows', x: 68, y: 68, w: 128, h: 44, solid: true },
    { kind: 'windows', x: 400, y: 68, w: 104, h: 50, solid: true },
    { kind: 'board', x: 116, y: 222, w: 60, h: 48, solid: true },
    { kind: 'bicycle', x: 414, y: 224, w: 98, h: 48, solid: true },
    { kind: 'hedge', x: 94, y: 426, w: 102, h: 28, solid: true },
    { kind: 'bicycle', x: 100, y: 612, w: 98, h: 42, solid: true },
    { kind: 'paving', x: 250, y: 130, w: 82, h: 46, solid: false },
    { kind: 'paving', x: 414, y: 346, w: 78, h: 42, solid: false },
    { kind: 'leaves', x: 108, y: 344, w: 40, h: 18, solid: false },
    { kind: 'paving', x: 272, y: 524, w: 48, h: 38, solid: false },
    { kind: 'leaves', x: 462, y: 564, w: 44, h: 22, solid: false },
    { kind: 'crack', x: 264, y: 680, w: 74, h: 18, solid: false },
  ],
  ekimae: [
    { kind: 'busStop', x: 88, y: 36, w: 30, h: 100, solid: true },
    { kind: 'clock', x: 160, y: 36, w: 30, h: 100, solid: true },
    { kind: 'sign', x: 400, y: 94, w: 102, h: 28, solid: true },
    { kind: 'bench', x: 398, y: 34, w: 106, h: 28, solid: true },
    { kind: 'hedge', x: 268, y: 510, w: 48, h: 32, solid: true },
    { kind: 'busStop', x: 324, y: 478, w: 30, h: 82, solid: true },
    { kind: 'crossing', x: 254, y: 100, w: 108, h: 40, solid: false },
    { kind: 'line', x: 412, y: 388, w: 98, h: 10, solid: false },
    { kind: 'taxiLine', x: 112, y: 338, w: 68, h: 22, solid: false },
    { kind: 'gum', x: 400, y: 522, w: 32, h: 18, solid: false },
    { kind: 'crossing', x: 250, y: 658, w: 116, h: 46, solid: false },
    { kind: 'line', x: 414, y: 570, w: 86, h: 10, solid: false },
  ],
};
