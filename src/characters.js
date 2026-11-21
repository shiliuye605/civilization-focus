import stoneUrl from './assets/characters/stone/craftsman.png';
import tangUrl from './assets/characters/tang/farmer.png';
import steamUrl from './assets/characters/steam/worker.png';

export const CHAR_CELL = { w: 48, h: 64 };
export const CHAR_ANCHOR = { x: 24, y: 58 };

export const CHAR_ACTIONS = {
  idle: { row: 0, frames: 1, fps: 1 },
  walk: { row: 1, frames: 4, fps: 5 },
  work: { row: 2, frames: 4, fps: 4 },
  sit: { row: 3, frames: 2, fps: 3 }
};

export const POSE_ACTION = {
  stand: 'idle',
  walk: 'walk',
  sit: 'sit',
  kneel: 'sit',
  pick: 'idle',
  fish: 'idle',
  hoe: 'work',
  operate: 'work',
  weave: 'sit'
};

/* 唐装衣襟为右衽，镜像会翻错衣襟方向，故不镜像；石器/蒸汽外观可镜像 */
export const CHAR_MIRROR = { stone: true, tang: false, steam: true };

export const CHAR_TOOL_GRIP = {
  stone: { x: 34, y: 38 },
  tang: { x: 34, y: 37 },
  steam: { x: 34, y: 37 }
};

export const CHAR_IMAGES = {};
for (const [id, url] of [['stone', stoneUrl], ['tang', tangUrl], ['steam', steamUrl]]) {
  const img = new Image();
  img.src = url;
  CHAR_IMAGES[id] = img;
}

export function charReady(id) {
  const img = CHAR_IMAGES[id];
  return Boolean(img && img.complete && img.naturalWidth > 0);
}