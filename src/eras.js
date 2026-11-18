export const FORMAL_FOCUS_MS = 25 * 60 * 1000;
export const FORMAL_BREAK_MS = 5 * 60 * 1000;
export const DEMO_FOCUS_MS = 15 * 1000;
export const DEMO_BREAK_MS = 5 * 1000;

export const ERA_ORDER = ['stone', 'tang', 'steam'];

export const ERAS = {
  stone: {
    id: 'stone',
    name: '石器聚落',
    subtitle: '石器时代的采集与劳作',
    eraLabel: '石器时代',
    tagline: '“火光照亮荒野，专注留下最初的痕迹。”',
    unlockRounds: 0,
    available: true,
    palette: {
      land: '#577a48',
      landDark: '#3e5c37',
      landLight: '#729455',
      earth: '#a8895c',
      earthDark: '#8a6d47',
      forest: '#2c4a33',
      forestLight: '#3f6644',
      rock: '#767a70',
      rockDark: '#5b5f57',
      water: '#396c86',
      waterDeep: '#284f63',
      accent: '#f0a95f',
      glow: '#ffb066',
      path: '#bfa878',
      skin: '#d9a06b',
      cloth: '#b5563c'
    },
    mapLabel: '石器聚落像素地图：森林、河流、洞穴与篝火',
    codex: [
      {
        id: 'tools',
        title: '石器',
        tag: '石器时代',
        use: '切割、刮削与打制',
        text: '把河滩上的燧石敲出锋利边缘，用来处理猎物、削木与采集，是聚落最基础的工具。',
        x: 51.5,
        y: 46.5
      },
      {
        id: 'campfire',
        title: '篝火',
        tag: '石器时代',
        use: '取暖、照明与烤肉',
        text: '火堆让夜晚变得安全。人们围坐着打制石器、分享食物，火光也是聚落延续的记号。',
        x: 70,
        y: 65
      }
    ]
  },

  tang: {
    id: 'tang',
    name: '盛唐田园',
    subtitle: '唐朝的农耕与手工业',
    eraLabel: '唐朝',
    tagline: '“田畴沿河铺展，劳作连接村落。”',
    unlockRounds: 1,
    available: true,
    palette: {
      land: '#8ba86a',
      landDark: '#6e8c50',
      landLight: '#a6bd7f',
      earth: '#b49a6a',
      earthDark: '#947a4e',
      forest: '#3f6a44',
      forestLight: '#58834f',
      rock: '#8b877a',
      rockDark: '#6d6a5e',
      water: '#3d7ea3',
      waterDeep: '#2b5f7d',
      accent: '#e8b06a',
      glow: '#ffcf8f',
      field1: '#7d9c4f',
      field2: '#c9a854',
      field3: '#a8b463',
      field4: '#d9c27a',
      roof: '#a44f37',
      wall: '#c9a877',
      wood: '#79552f',
      skin: '#d9a06b',
      cloth: '#7f8fae'
    },
    mapLabel: '盛唐田园像素地图：田垄、水渠、村落与水车',
    codex: [
      {
        id: 'wheel',
        title: '水车',
        tag: '唐朝',
        use: '提水灌溉',
        text: '河流推动木轮，把水提升到渠中，再顺着田垄流进田里，是沿河农作的重要设施。',
        x: 74,
        y: 49
      },
      {
        id: 'field',
        title: '田垄',
        tag: '唐朝',
        use: '分区耕种',
        text: '整齐的田块沿着水渠排开，不同作物分畦种植，让收成与劳作更容易安排。',
        x: 34,
        y: 57
      }
    ]
  },

  steam: {
    id: 'steam',
    name: '蒸汽城镇',
    subtitle: '英国工业革命的生产与交通',
    eraLabel: '英国工业革命',
    tagline: '“蒸汽驱动机器，轨道连接远方。”',
    unlockRounds: 2,
    available: false,
    statusLabel: '后续版本开放'
  }
};

export function getEra(id) {
  return ERAS[id] || ERAS.stone;
}

export function unlockedLevel(completedRounds) {
  if (completedRounds >= 2) return 3;
  if (completedRounds >= 1) return 2;
  return 1;
}

export function isEraUnlocked(id, completedRounds) {
  const era = ERAS[id];
  if (!era) return false;
  return era.unlockRounds <= completedRounds;
}

export function canEnterEra(id, completedRounds) {
  const era = ERAS[id];
  if (!era || !era.available) return false;
  return isEraUnlocked(id, completedRounds);
}
