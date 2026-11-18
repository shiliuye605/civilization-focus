import { ERA_ORDER, ERAS } from './eras.js';
import forestOgg from './assets/audio/forest.ogg';
import forestM4a from './assets/audio/forest.m4a';
import fieldOgg from './assets/audio/field.ogg';
import fieldM4a from './assets/audio/field.m4a';
import steamOgg from './assets/audio/steam.ogg';
import steamM4a from './assets/audio/steam.m4a';

export const BACKGROUNDS = [
  { id: 'galaxy', name: '银河星空', eraId: 'stone', available: true },
  { id: 'aurora', name: '极光天幕', eraId: 'tang', available: true },
  { id: 'nebula', name: '深空星云', eraId: 'steam', available: true }
];

export const AMBIENCES = [
  {
    id: 'forest',
    name: '森林鸟鸣',
    eraId: 'stone',
    available: true,
    files: { ogg: forestOgg, m4a: forestM4a }
  },
  {
    id: 'field',
    name: '田园流水',
    eraId: 'tang',
    available: true,
    files: { ogg: fieldOgg, m4a: fieldM4a }
  },
  {
    id: 'steam',
    name: '柔和蒸汽',
    eraId: 'steam',
    available: true,
    files: { ogg: steamOgg, m4a: steamM4a }
  }
];

export function isUnlocked(eraId, rounds) {
  const era = ERAS[eraId];
  return Boolean(era && era.available && rounds >= era.unlockRounds);
}

export function unlockedBackgrounds(rounds) {
  return BACKGROUNDS.filter((b) => b.available && isUnlocked(b.eraId, rounds));
}

export function unlockedAmbiences(rounds) {
  return AMBIENCES.filter((a) => a.available && a.files && isUnlocked(a.eraId, rounds));
}

export function backgroundForEra(eraId, rounds) {
  const list = unlockedBackgrounds(rounds);
  if (!list.length) return null;
  const exact = list.find((b) => b.eraId === eraId);
  if (exact) return exact;
  const eraIndex = ERA_ORDER.indexOf(eraId);
  const lower = list.filter((b) => ERA_ORDER.indexOf(b.eraId) <= eraIndex);
  return lower.length ? lower[lower.length - 1] : list[0];
}

export function ambienceById(id) {
  return AMBIENCES.find((a) => a.id === id) || null;
}