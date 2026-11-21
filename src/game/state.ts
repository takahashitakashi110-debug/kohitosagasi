import type { ShotResult } from './photo';
import type { KohitoRuntime } from './kohito';
import type { Point } from '../engine/canvas';

export const SPOT_IDS = ['shoutengai', 'kawazoi', 'danchi', 'ekimae'] as const;
export const TIMES = ['morning', 'noon', 'evening', 'night'] as const;
export const KOHITO_IDS = ['urasumi', 'haritsuki', 'dobunozoki', 'noboriyurashi', 'kagebousi', 'tarejiri'] as const;
export type SpotId = typeof SPOT_IDS[number];
export type TimeSlot = typeof TIMES[number];
export type KohitoId = typeof KOHITO_IDS[number];
export type Scene = 'title' | 'map' | 'field' | 'camera' | 'album' | 'dayend' | 'ending';
export interface AlbumEntry {
  stage: 0 | 1 | 2 | 3;
  best: ShotResult;
  day: number;
  time: TimeSlot;
  spot: SpotId;
}
export interface SaveData {
  version: 1;
  day: number;
  time: TimeSlot;
  location: 'home' | SpotId;
  album: Record<KohitoId, AlbumEntry | undefined>;
  hints: KohitoId[];
  cleared: boolean;
  clearedDay: number | null;
}
export function freshSave(): SaveData {
  return { version: 1, day: 1, time: 'morning', location: 'home',
    album: { urasumi: undefined, haritsuki: undefined, dobunozoki: undefined, noboriyurashi: undefined, kagebousi: undefined, tarejiri: undefined },
    hints: [], cleared: false, clearedDay: null };
}
export function advanceLocation(save: SaveData, destination: SpotId | 'home'): 'field' | 'dayend' {
  if (destination === 'home' || (save.location !== 'home' && save.time === 'night' && destination !== save.location)) {
    save.location = 'home';
    return 'dayend';
  }
  if (save.location !== 'home' && save.location !== destination) save.time = TIMES[TIMES.indexOf(save.time) + 1] ?? 'morning';
  save.location = destination;
  return 'field';
}
export function nextDay(save: SaveData): void { save.day++; save.time = 'morning'; save.location = 'home'; }

export interface PhotoFeedback { id: KohitoId; shot: ShotResult; hintGained: boolean; hidden: boolean }
export interface GameState {
  scene: Scene; save: SaveData; hasSave: boolean; returnScene: 'map' | 'field' | 'ending' | 'dayend';
  player: Point; kohitos: KohitoRuntime[]; escaped: Set<KohitoId>; visitKey: string;
  elapsed: number; moving: boolean; sneaking: boolean; traces: Point[];
  cameraTarget: KohitoId | null; heldMs: number; pan: number; feedback: PhotoFeedback | null;
  albumTab: number; albumPage: number; endingTime: number; mapChoice: number;
}
export function createGame(save = freshSave(), hasSave = false): GameState {
  return { scene: 'title', save, hasSave, returnScene: 'map', player: { x: 288, y: 420 }, kohitos: [], escaped: new Set(), visitKey: '',
    elapsed: 0, moving: false, sneaking: false, traces: [], cameraTarget: null, heldMs: 0, pan: 0, feedback: null,
    albumTab: 0, albumPage: 0, endingTime: 0, mapChoice: 0 };
}
