/* V0.6 动作帧：以站姿母版为底稿派生 walk4 / work4 / sit2。
   劳动帧器具与手一起画入；walk 上下摆动 ≤1 素材像素；脚底基线 y=58 不变。 */
import {
  TANG_PAL, STONE_PAL, STEAM_PAL,
  tangLegsStand, tangLegsWalk, tangLegsSit, tangTorso, tangArmL, tangArmR, tangGripArm, tangHead, tangStand,
  stoneLegsStand, stoneLegsWalk, stoneLegsSit, stoneTorso, stoneArmLCore, stoneArmR, stoneHead, stoneStand,
  steamLegsStand, steamLegsWalk, steamLegsSit, steamTorso, steamArmL, steamArmR, steamGripArm, steamHead, steamStand
} from './char-frames.mjs';

const BOB = [0, -1, 0, -1];
const SWING = [1, 0, -1, 0];

/* ---------------- 唐代 ---------------- */

function tangWalk(P, pal, f) {
  tangLegsWalk(P, pal, f);
  const dy = BOB[f];
  tangTorso(P, pal, 0, dy);
  tangArmL(P, pal, 0, dy + SWING[f]);
  tangArmR(P, pal, 0, dy - SWING[f]);
  tangHead(P, pal, 0, dy);
}

const TANG_HOE = [
  { lean: [-1, 0], shaft: [26, 32, 40, 14], hands: [[31, 26], [35, 20]], blade: [38, 12] },
  { lean: [1, 1], shaft: [26, 28, 42, 48], hands: [[32, 35], [37, 41]], blade: [38, 48] },
  { lean: [2, 2], shaft: [26, 30, 40, 57], hands: [[30, 37], [34, 45]], blade: [36, 56] },
  { lean: [1, 1], shaft: [26, 26, 38, 44], hands: [[30, 32], [34, 38]], blade: [36, 44] }
];

function tangWork(P, pal, f) {
  const { lean, shaft, hands, blade } = TANG_HOE[f];
  const [dx, dy] = lean;
  tangLegsStand(P, pal);
  tangTorso(P, pal, dx, dy);
  P.diag(shaft[0] + dx, shaft[1] + dy, shaft[2] + dx, shaft[3] + dy, pal.woodM, 2);
  P.diag(shaft[0] + dx + 1, shaft[1] + dy, shaft[2] + dx + 1, shaft[3] + dy, pal.woodD, 1);
  tangGripArm(P, pal, 17 + dx, 29 + dy, hands[0][0] + dx, hands[0][1] + dy);
  tangGripArm(P, pal, 31 + dx, 30 + dy, hands[1][0] + dx, hands[1][1] + dy);
  P.rect(blade[0] + dx, blade[1] + dy, 7, 2, pal.ironM);
  P.rect(blade[0] + dx, blade[1] + dy + 2, 7, 1, pal.ironD);
  P.px(blade[0] + dx, blade[1] + dy, pal.strawL);
  if (f === 2) { P.px(43 + dx, 54 + dy, pal.woodM); P.px(37 + dx, 55 + dy, pal.woodD); }
  if (f === 3) P.px(blade[0] + dx + 3, blade[1] + dy + 3, pal.woodD);
  tangHead(P, pal, dx, dy);
}

function tangSit(P, pal, f) {
  tangLegsSit(P, pal);
  tangTorso(P, pal, 0, 3);
  const shift = f * 2;
  tangGripArm(P, pal, 17, 32, 28 + shift, 38);
  tangGripArm(P, pal, 31, 33, 32 + shift, 40);
  P.rect(28 + shift, 38, 5, 1, pal.woodM);
  tangHead(P, pal, 0, 3);
}

/* ---------------- 石器 ---------------- */

function stoneWalk(P, pal, f) {
  stoneLegsWalk(P, pal, f);
  const dy = BOB[f];
  stoneTorso(P, pal, 0, dy);
  stoneArmLCore(P, pal, 0, dy);
  stoneArmR(P, pal, 0, dy - SWING[f]);
  stoneHead(P, pal, 0, dy);
}

function stoneHammer(P, pal, x, y) {
  P.rect(x, y, 7, 5, pal.stoneM);
  P.px(x, y, pal.stoneL); P.px(x + 1, y, pal.stoneL); P.px(x, y + 1, pal.stoneL);
  P.rect(x + 4, y + 3, 3, 2, pal.stoneD);
}

function stoneWork(P, pal, f) {
  const dy = f === 2 ? 1 : 0;
  stoneLegsStand(P, pal);
  stoneTorso(P, pal, 0, dy);
  stoneArmLCore(P, pal, 0, dy);
  if (f === 0) {
    P.diag(33, 26, 34, 21, pal.skinM, 3);
    stoneHammer(P, pal, 30, 14);
    P.rect(33, 20, 4, 3, pal.skinM); P.px(33, 20, pal.skinL);
  } else if (f === 1) {
    P.diag(33, 26, 34, 26, pal.skinM, 3);
    stoneHammer(P, pal, 30, 20);
    P.rect(33, 26, 4, 3, pal.skinM); P.px(33, 26, pal.skinL);
  } else if (f === 2) {
    P.diag(33, 27, 25, 31, pal.skinM, 3);
    P.diag(33, 27, 25, 31, pal.skinL, 1);
    stoneHammer(P, pal, 16, 29);
    P.rect(22, 31, 4, 3, pal.skinM); P.px(22, 31, pal.skinL);
  } else {
    P.diag(33, 26, 32, 31, pal.skinM, 3);
    stoneHammer(P, pal, 28, 26);
    P.rect(31, 32, 4, 3, pal.skinM); P.px(31, 32, pal.skinL);
  }
  stoneHead(P, pal, 0, dy);
}

function stoneSit(P, pal, f) {
  stoneLegsSit(P, pal);
  stoneTorso(P, pal, 0, 4);
  /* 托石手与石芯：两帧稳定在膝上 */
  P.diag(13, 30, 20, 46, pal.skinM, 3);
  P.rect(20, 44, 7, 5, pal.stoneM);
  P.px(20, 44, pal.stoneL); P.px(21, 44, pal.stoneL); P.px(20, 45, pal.stoneL);
  P.rect(24, 47, 3, 2, pal.stoneD);
  P.rect(20, 48, 4, 2, pal.skinM); P.px(20, 48, pal.skinL);
  if (f === 0) {
    P.diag(33, 30, 34, 25, pal.skinM, 3);
    stoneHammer(P, pal, 30, 18);
    P.rect(33, 24, 4, 3, pal.skinM); P.px(33, 24, pal.skinL);
  } else {
    P.diag(33, 31, 27, 41, pal.skinM, 3);
    P.diag(33, 31, 27, 41, pal.skinL, 1);
    P.rect(21, 40, 7, 4, pal.stoneM);
    P.px(21, 40, pal.stoneL); P.px(22, 40, pal.stoneL);
    P.rect(25, 42, 3, 2, pal.stoneD);
    P.rect(25, 41, 4, 3, pal.skinM); P.px(25, 41, pal.skinL);
  }
  stoneHead(P, pal, 0, 4);
}

/* ---------------- 工业 ---------------- */

function steamWalk(P, pal, f) {
  steamLegsWalk(P, pal, f);
  const dy = BOB[f];
  steamTorso(P, pal, 0, dy);
  steamArmL(P, pal, 0, dy + SWING[f]);
  steamArmR(P, pal, 0, dy - SWING[f]);
  steamHead(P, pal, 0, dy);
}

function steamJaw(P, pal, x, y) {
  P.rect(x, y, 5, 6, pal.wrM);
  P.clear(x + 2, y, 2, 3);
  P.px(x, y, pal.wrL); P.px(x, y + 1, pal.wrL);
  P.rect(x + 4, y + 3, 1, 3, pal.wrD);
}

const STEAM_WRENCH_FR = [
  { lean: [0, 0], hand: [35, 27], jaw: [40, 20], handle: [42, 25] },
  { lean: [0, 1], hand: [35, 32], jaw: [40, 20], handle: [42, 25] },
  { lean: [1, 2], hand: [34, 36], jaw: [40, 20], handle: [42, 25] },
  { lean: [0, 0], hand: [35, 40], jaw: [36, 32], handle: [38, 37] }
];

function steamWork(P, pal, f) {
  const { lean, hand, jaw, handle } = STEAM_WRENCH_FR[f];
  const [dx, dy] = lean;
  steamLegsStand(P, pal);
  steamTorso(P, pal, dx, dy);
  steamArmL(P, pal, dx, dy);
  P.diag(handle[0], handle[1], hand[0] + 1, hand[1], pal.wrM, 2);
  P.px(handle[0], handle[1], pal.wrL);
  steamJaw(P, pal, jaw[0], jaw[1]);
  steamGripArm(P, pal, 33 + dx, 26 + dy, hand[0], hand[1]);
  steamHead(P, pal, dx, dy);
}

function steamSit(P, pal, f) {
  steamLegsSit(P, pal);
  steamTorso(P, pal, 0, 3);
  steamArmL(P, pal, 0, 3);
  const jy = f ? 40 : 42;
  P.rect(26, 44 - f, 8, 2, pal.wrM); P.px(26, 44 - f, pal.wrL);
  steamJaw(P, pal, 33, jy);
  steamGripArm(P, pal, 33, 29, 34, 43 - f);
  steamHead(P, pal, 0, 3);
}

/* ---------------- 组图 ---------------- */

export function buildFinal({ Sheet, CELL_W, CELL_H }) {
  const eras = [
    ['stone', 'craftsman', STONE_PAL, stoneStand, stoneWalk, stoneWork, stoneSit],
    ['tang', 'farmer', TANG_PAL, tangStand, tangWalk, tangWork, tangSit],
    ['steam', 'worker', STEAM_PAL, steamStand, steamWalk, steamWork, steamSit]
  ];
  for (const [dir, name, pal, stand, walk, work, sit] of eras) {
    const sheet = new Sheet(4, 4);
    const put = (col, row, fn) => {
      fn(sheet.cellPainter(col, row, pal), pal);
      sheet.outline(col * CELL_W, row * CELL_H, pal.o);
    };
    put(0, 0, stand);
    for (let f = 0; f < 4; f += 1) put(f, 1, (P, p) => walk(P, p, f));
    for (let f = 0; f < 4; f += 1) put(f, 2, (P, p) => work(P, p, f));
    for (let f = 0; f < 2; f += 1) put(f, 3, (P, p) => sit(P, p, f));
    sheet.save(`src/assets/characters/${dir}/${name}.png`);
    sheet.saveZoom(`tools/char-preview-${dir}.png`, 3);
  }
}