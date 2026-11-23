import type { KohitoId } from '../game/state';

const atlasUrl = new URL('../assets/summer/kohitos.png', import.meta.url).href;
const townUrl = new URL('../assets/summer/town.webp', import.meta.url).href;

/** Lazy loading also keeps the existing vector-only path usable without a DOM. */
function localImage(url: string): () => HTMLImageElement | undefined {
  let image: HTMLImageElement | undefined;
  let failed = false;
  return () => {
    if (failed || typeof Image === 'undefined') return undefined;
    if (!image) {
      image = new Image();
      image.onerror = () => { failed = true; };
      image.src = url;
    }
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 ? image : undefined;
  };
}
const atlas = localImage(atlasUrl);
const town = localImage(townUrl);

// Destinations remain inside SUBJECT_BOUNDS; no scoring or occlusion changes.
const poses: Record<KohitoId, { row: number; x: number; y: number; w: number; h: number }> = {
  urasumi: { row: 0, x: -19, y: -9, w: 41, h: 24 },
  haritsuki: { row: 1, x: -10, y: -29, w: 20, h: 43 },
  dobunozoki: { row: 2, x: -14, y: -5, w: 28, h: 18 },
  noboriyurashi: { row: 3, x: -19, y: -29, w: 41, h: 44 },
  kagebousi: { row: 4, x: -19, y: -19, w: 38, h: 34 },
  tarejiri: { row: 5, x: -15, y: -37, w: 35, h: 62 },
};

/** Called after the same translation/bob used by the original vector drawing. */
export function drawSummerKohito(c: CanvasRenderingContext2D, id: KohitoId, special: boolean, hidden: boolean): boolean {
  const image = atlas();
  if (!image) return false;
  const pose = id === 'tarejiri' && hidden ? { row: 6, x: -5, y: -6, w: 25, h: 26 } : poses[id];
  c.drawImage(image, (special ? 256 : 0) + 4, pose.row * 256 + 4, 248, 248, pose.x, pose.y, pose.w, pose.h);
  return true;
}

export function drawSummerTitleImage(c: CanvasRenderingContext2D): boolean {
  const image = town();
  if (!image) return false;
  // Keep the complete composition (including the dry channel), with no UI overlap.
  c.drawImage(image, 12, 190, 336, 190);
  return true;
}
