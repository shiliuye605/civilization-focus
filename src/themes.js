import { unlockedLevel } from './eras.js';

export const GLOBE_LAYOUT = {
  blobs: [
    { lon: 0.25, lat: 28, ru: 0.085, rl: 20 },
    { lon: 0.3, lat: 14, ru: 0.1, rl: 18 },
    { lon: 0.245, lat: 0, ru: 0.075, rl: 16 },
    { lon: 0.2, lat: 16, ru: 0.05, rl: 12 },
    { lon: 0.68, lat: -24, ru: 0.075, rl: 15 },
    { lon: 0.73, lat: -33, ru: 0.045, rl: 9 },
    { lon: 0.06, lat: 47, ru: 0.045, rl: 10 },
    { lon: 0.11, lat: -32, ru: 0.05, rl: 12 },
    { lon: 0.43, lat: 36, ru: 0.04, rl: 8 },
    { lon: 0.438, lat: 12, ru: 0.03, rl: 6 },
    { lon: 0.096, lat: -8, ru: 0.026, rl: 5 }
  ],
  river: [
    [0.215, 42],
    [0.235, 34],
    [0.225, 26],
    [0.245, 18],
    [0.235, 10],
    [0.255, 2],
    [0.245, -6],
    [0.26, -13],
    [0.255, -18]
  ],
  stone: {
    camp: { lon: 0.205, lat: 15.2 },
    huts: [
      { lon: 0.19, lat: 19.8, angle: 0.4, scale: 1 },
      { lon: 0.222, lat: 20.4, angle: 1.3, scale: 0.88 },
      { lon: 0.191, lat: 11.6, angle: 2.2, scale: 0.95 }
    ],
    campfire: { lon: 0.205, lat: 15.2 },
    menhir: { lon: 0.214, lat: 9.4, angle: 0.2 },
    trees3d: [
      [0.178, 31, 1.05, 'conifer'],
      [0.283, 29, 0.9, 'broadleaf'],
      [0.265, 17, 0.8, 'conifer'],
      [0.327, 21, 0.95, 'conifer'],
      [0.231, 33, 0.85, 'broadleaf'],
      [0.215, 5, 0.8, 'conifer'],
      [0.171, 18, 0.85, 'broadleaf'],
      [0.3, 8, 0.7, 'broadleaf'],
      [0.185, 24, 0.55, 'bush'],
      [0.225, 9, 0.5, 'bush'],
      [0.438, 12, 0.62, 'broadleaf'],
      [0.096, -8, 0.58, 'conifer'],
      [0.171, 27, 0.9, 'conifer'],
      [0.203, 29, 0.8, 'broadleaf'],
      [0.252, 24, 0.85, 'conifer'],
      [0.302, 17, 0.72, 'broadleaf'],
      [0.226, 3, 0.7, 'broadleaf']
    ],
    rocks: [
      [0.286, 25, 1.1],
      [0.176, 12, 0.8],
      [0.302, 30, 1.3],
      [0.258, 33, 0.9]
    ]
  },
  tang: {
    fields: { lon0: 0.258, lon1: 0.372, lat0: -2, lat1: 26 },
    canals: [20, 12, 4],
    waterwheel: { lon: 0.25, lat: 7.5 },
    villages: [
      { lon: 0.315, lat: 20.5, angle: 0.2, scale: 1 },
      { lon: 0.334, lat: 15.2, angle: 1.1, scale: 0.9 },
      { lon: 0.303, lat: 6.5, angle: 2.2, scale: 0.95 },
      { lon: 0.283, lat: 18, angle: 0.7, scale: 0.8 }
    ],
    pagoda: { lon: 0.34, lat: 24.2, angle: 0.3, scale: 1.12 },
    boat: { lon: 0.247, lat: -3.5, angle: 0.15 },
    trees3d: [
      [0.337, 28, 0.9, 'broadleaf'],
      [0.287, 30, 0.8, 'conifer'],
      [0.35, 10, 0.8, 'blossom'],
      [0.238, 27, 0.8, 'broadleaf'],
      [0.343, 19, 0.7, 'blossom'],
      [0.274, 23, 0.65, 'bush'],
      [0.247, -8, 0.8, 'broadleaf'],
      [0.438, 12, 0.55, 'broadleaf'],
      [0.096, -8, 0.5, 'broadleaf'],
      [0.268, 20, 0.7, 'blossom'],
      [0.322, 27, 0.8, 'conifer'],
      [0.236, 10, 0.72, 'broadleaf']
    ],
    rocks: [
      [0.33, 31, 1],
      [0.27, 28, 0.8]
    ]
  }
};

export const THEMES = {
  stone: {
    id: 'stone',
    eraId: 'stone',
    available: true,
    clockStyle: 'stone',
    accent: '#f0a95f',
    aria: '石器时代地球：森林、河流、原始营地与篝火，点击进入计时',
    palette: {
      oceanDeep: '#0a2735',
      ocean: '#143f50',
      oceanLight: '#1d5669',
      shelf: '#2f7f8d',
      foam: '#a8d3d2',
      sand: '#b7a06d',
      grass1: '#4f703f',
      grass2: '#5f8147',
      grass3: '#719451',
      forest1: '#274832',
      forest2: '#365a3c',
      forest3: '#487045',
      highland: '#5a6347',
      rock: '#6d7061',
      rockLight: '#888773',
      rockDark: '#4f5245',
      earth: '#a08255',
      earthDark: '#795e3f',
      wood: '#60462c',
      woodLight: '#7c5c3a',
      river: '#3c7f9c',
      riverDeep: '#285c72',
      riverLight: '#93c9d6',
      fire: '#ff9f57',
      glow: '#ffcf8f',
      forestWet: 0.42,
      dirtCliff: '#8a6a44',
      hutWall: '#9a8058',
      hutRoof: '#c7a66e',
      stoneWall: '#9c9787',
      stoneDark: '#6f6d61'
    }
  },

  tang: {
    id: 'tang',
    eraId: 'tang',
    available: true,
    clockStyle: 'wood',
    accent: '#e0a95e',
    aria: '盛唐田园地球：农田、水渠、村落与水车，点击进入计时',
    palette: {
      oceanDeep: '#0c2f3f',
      ocean: '#174b5f',
      oceanLight: '#246a7f',
      shelf: '#3d8f9d',
      foam: '#b7dcda',
      sand: '#c6ad78',
      grass1: '#7f9f5e',
      grass2: '#8fb06a',
      grass3: '#a1bf78',
      forest1: '#3a6340',
      forest2: '#4a7750',
      forest3: '#5c8a56',
      highland: '#73775b',
      rock: '#868378',
      rockLight: '#9b9783',
      rockDark: '#626054',
      earth: '#b29362',
      earthDark: '#8a7046',
      wood: '#6e4e2f',
      woodLight: '#8b6a42',
      river: '#3d7ea3',
      riverDeep: '#2b5f7d',
      riverLight: '#a3d1e4',
      field1: '#7fa14f',
      field2: '#d2ad57',
      field3: '#a9b964',
      field4: '#e0c982',
      canal: '#4f93b5',
      plaster: '#e2c99a',
      roof: '#9b4534',
      roofDark: '#6a2d21',
      stoneWall: '#a9a394',
      pagodaRoof: '#8e3d2d',
      pagodaWall: '#e6cfa4',
      blossom: '#c98f7a',
      blossomLight: '#dda890',
      forestWet: 0.62,
      dirtCliff: '#9a7c4c',
      glow: '#ffcf8f'
    }
  },

  steam: {
    id: 'steam',
    eraId: 'steam',
    available: false,
    reserved: true,
    clockStyle: 'industrial',
    accent: '#c98b62',
    aria: '蒸汽城镇地球',
    // V0.3 预留：金属机械时钟、砖砌厂房、烟囱、铁路与蒸汽设施在此接入。
    palette: null
  }
};

export function resolveTheme(progress) {
  const level = unlockedLevel(progress.completedRounds);
  const desired = level >= 3 ? THEMES.steam : level >= 2 ? THEMES.tang : THEMES.stone;
  if (desired.available) return desired;
  return THEMES.tang;
}