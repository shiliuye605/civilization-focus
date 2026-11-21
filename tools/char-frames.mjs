/* V0.6 分层母版：头帽 / 躯干 / 前后臂 / 腿 / 手持物 分层绘制，统一左上受光、三档明暗。
   坐标为 48x64 画格绝对坐标，脚底基线 y=58（鞋底 y57 + 轮廓 y58）。
   每个部件函数接受偏移 (dx,dy)，供动作帧以母版为底稿逐帧修整。 */

export const TANG_PAL = {
  o: '#241a12',
  strawL: '#f0d48a', strawM: '#d0a860', strawD: '#96703c', strawU: '#5f4526',
  hairM: '#3a2a1c', hairL: '#5a4028',
  skinL: '#f6d0a4', skinM: '#e4b488', skinD: '#c08c60', eye: '#2a1a10', cheek: '#ffe4bc',
  robeL: '#f2ead6', robeM: '#d8ccb0', robeD: '#a89878', seam: '#6a5a40',
  beltM: '#7a4632', beltL: '#96604a',
  indL: '#4a5c94', indM: '#36466e', indD: '#26324e',
  wrapM: '#8a7a5c', wrapD: '#6a5a40',
  shoeL: '#a87848', shoeM: '#7a5230', sole: '#2a1c10',
  woodM: '#8a6a4a', woodD: '#6b4f36', ironM: '#8a6a4a', ironD: '#5f4526'
};

export const STONE_PAL = {
  o: '#2b1d12',
  hairM: '#4a3222', hairL: '#6a4a30', hairD: '#332214',
  skinL: '#f6d0a4', skinM: '#e4b488', skinD: '#c08c60', eye: '#2a1a10', cheek: '#ffe4bc',
  hideL: '#c89868', hideM: '#a87848', hideD: '#7a5230',
  ropeM: '#b09468', ropeL: '#c8ae82', ropeD: '#8a7048',
  stoneL: '#a8b0b8', stoneM: '#7c848c', stoneD: '#565e66',
  shoeM: '#7a5230', shoeL: '#a87848', sole: '#2a1c10'
};

export const STEAM_PAL = {
  o: '#1a1410',
  capL: '#5a6470', capM: '#404854', capD: '#2a323c', capU: '#161e26',
  hairM: '#3a2a1c',
  skinL: '#f6d0a4', skinM: '#e4b488', skinD: '#c08c60', eye: '#2a1a10', cheek: '#ffe4bc',
  shirtL: '#e8e8e0', shirtM: '#c4c4bc', shirtD: '#94948c',
  vestL: '#6a5642', vestM: '#4e3e2e', vestD: '#362a1e',
  pantsL: '#4a4a54', pantsM: '#34343e', pantsD: '#22222a',
  bootM: '#3a2e22', bootL: '#6a5642', bootSole: '#14100c',
  brass: '#c9a05a', brassL: '#e0bc76',
  wrL: '#b8c0c8', wrM: '#8c949c', wrD: '#5c646c'
};

/* 画家工具：所有母版通过这些分层笔触绘制，便于逐层修改 */
export function painter(set, clear) {
  const px = (x, y, c) => set(x, y, c);
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) set(x + i, y + j, c); };
  const band = (x, y, w, h, L, M, D, litTop = true) => {
    rect(x, y, w, h, M);
    const lw = Math.max(1, Math.round(w * 0.25));
    const dw = Math.max(1, Math.round(w * 0.25));
    rect(x, y, lw, h, L);
    rect(x + w - dw, y, dw, h, D);
    if (litTop) rect(x, y, w, 1, L);
  };
  const dome = (cx, y0, widths, L, M, D) => {
    widths.forEach((w, i) => {
      const x = cx - Math.floor(w / 2);
      const lw = Math.max(1, Math.round(w * 0.3));
      const dw = Math.max(1, Math.round(w * 0.22));
      rect(x, y0 + i, w, 1, M);
      rect(x, y0 + i, lw, 1, L);
      rect(x + w - dw, y0 + i, dw, 1, D);
    });
    rect(cx - Math.floor(widths[0] / 2), y0, widths[0], 1, L);
  };
  const diag = (x0, y0, x1, y1, c, thick = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i += 1) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      rect(x, y, thick, 1, c);
    }
  };
  return { px, rect, band, dome, diag, clear };
}

/* ---------------- 唐代农人 · 分层部件 ---------------- */

export function tangLegsStand(P, pal, dx = 0, dy = 0) {
  P.band(18 + dx, 44 + dy, 6, 10, pal.indL, pal.indM, pal.indD);
  P.band(25 + dx, 44 + dy, 6, 4, pal.indL, pal.indM, pal.indD);
  P.band(26 + dx, 48 + dy, 5, 6, pal.indL, pal.indM, pal.indD);
  P.rect(26 + dx, 48 + dy, 5, 1, pal.indD);
  P.rect(18 + dx, 51 + dy, 6, 3, pal.wrapM); P.px(19 + dx, 52 + dy, pal.wrapD); P.px(22 + dx, 52 + dy, pal.wrapD);
  P.rect(26 + dx, 51 + dy, 5, 3, pal.wrapM); P.px(27 + dx, 52 + dy, pal.wrapD); P.px(29 + dx, 52 + dy, pal.wrapD);
  P.rect(16 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(16 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(16 + dx, 57 + dy, 8, 1, pal.sole);
  P.rect(26 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(26 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(26 + dx, 57 + dy, 8, 1, pal.sole);
}

export function tangLegsWalk(P, pal, f) {
  const stride = [3, 0, -3, 0][f];
  const lift = [0, 1, 0, 1][f];
  /* 前脚 */
  P.band(18 - stride, 44, 6, 10 - (stride > 0 ? 0 : 0), pal.indL, pal.indM, pal.indD);
  P.rect(18 - stride, 51, 6, 3, pal.wrapM); P.px(19 - stride, 52, pal.wrapD);
  P.rect(16 - stride, 55, 8, 2, pal.shoeM); P.rect(16 - stride, 55, 2, 1, pal.shoeL); P.rect(16 - stride, 57, 8, 1, pal.sole);
  /* 后脚 */
  P.band(25 + stride, 44, 6, 8, pal.indL, pal.indM, pal.indD);
  P.rect(26 + stride, 48, 5, 4 - lift, pal.indM);
  P.rect(26 + stride, 51 - lift, 5, 3, pal.wrapM); P.px(27 + stride, 52 - lift, pal.wrapD);
  P.rect(26 + stride, 55 - lift, 8, 2, pal.shoeM); P.rect(26 + stride, 55 - lift, 2, 1, pal.shoeL); P.rect(26 + stride, 57 - lift, 8, 1, pal.sole);
}

export function tangLegsSit(P, pal, dx = 0, dy = 0) {
  P.rect(18 + dx, 46 + dy, 13, 4, pal.indM);
  P.rect(18 + dx, 46 + dy, 13, 1, pal.indL);
  P.band(20 + dx, 50 + dy, 5, 5, pal.indL, pal.indM, pal.indD);
  P.band(27 + dx, 50 + dy, 5, 5, pal.indL, pal.indM, pal.indD);
  P.rect(20 + dx, 52 + dy, 5, 2, pal.wrapM); P.rect(27 + dx, 52 + dy, 5, 2, pal.wrapM);
  P.rect(18 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(18 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(18 + dx, 57 + dy, 8, 1, pal.sole);
  P.rect(27 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(27 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(27 + dx, 57 + dy, 8, 1, pal.sole);
}

export function tangTorso(P, pal, dx = 0, dy = 0) {
  P.rect(17 + dx, 41 + dy, 7, 3, pal.robeM); P.rect(24 + dx, 41 + dy, 7, 3, pal.robeD); P.rect(24 + dx, 41 + dy, 1, 3, pal.seam);
  P.rect(16 + dx, 38 + dy, 16, 3, pal.beltM); P.rect(16 + dx, 38 + dy, 16, 1, pal.beltL);
  P.rect(17 + dx, 39 + dy, 3, 3, pal.beltL); P.px(18 + dx, 40 + dy, pal.beltM);
  P.rect(16 + dx, 28 + dy, 16, 10, pal.robeM);
  P.rect(16 + dx, 28 + dy, 3, 10, pal.robeL);
  P.rect(29 + dx, 28 + dy, 3, 10, pal.robeD);
  P.rect(16 + dx, 27 + dy, 8, 1, pal.robeL);
  P.rect(24 + dx, 28 + dy, 8, 1, pal.robeM);
  P.px(24 + dx, 28 + dy, pal.robeL);
  P.diag(20 + dx, 28 + dy, 28 + dx, 37 + dy, pal.robeL, 2);
  P.diag(22 + dx, 28 + dy, 30 + dx, 37 + dy, pal.seam, 1);
}

export function tangArmL(P, pal, dx = 0, dy = 0) {
  P.band(11 + dx, 28 + dy, 5, 9, pal.robeL, pal.robeM, pal.robeD);
  P.rect(16 + dx, 28 + dy, 1, 9, pal.seam);
  P.rect(11 + dx, 37 + dy, 5, 2, pal.robeD); P.px(11 + dx, 37 + dy, pal.robeM);
  P.band(12 + dx, 39 + dy, 3, 3, pal.skinL, pal.skinM, pal.skinD);
}

export function tangArmR(P, pal, dx = 0, dy = 0) {
  P.band(32 + dx, 29 + dy, 5, 9, pal.robeL, pal.robeM, pal.robeD);
  P.rect(31 + dx, 29 + dy, 1, 9, pal.seam);
  P.rect(32 + dx, 38 + dy, 5, 2, pal.robeD); P.px(32 + dx, 38 + dy, pal.robeM);
  P.band(33 + dx, 40 + dy, 3, 3, pal.skinL, pal.skinM, pal.skinD);
}

/* 劳动臂：袖沿肩到握点斜出，袖口收口，手掌覆盖柄一小段 */
export function tangGripArm(P, pal, sx, sy, hx, hy) {
  P.diag(sx, sy, hx - 1, hy - 2, pal.robeM, 4);
  P.diag(sx, sy, hx - 1, hy - 2, pal.robeL, 1);
  P.rect(hx - 2, hy - 2, 4, 2, pal.robeD);
  P.rect(hx - 1, hy - 1, 3, 3, pal.skinM);
  P.px(hx - 1, hy - 1, pal.skinL);
}

export function tangHead(P, pal, dx = 0, dy = 0) {
  P.rect(16 + dx, 18 + dy, 3, 8, pal.hairM); P.rect(29 + dx, 18 + dy, 3, 8, pal.hairM);
  P.px(16 + dx, 18 + dy, pal.hairL); P.px(31 + dx, 20 + dy, pal.hairL);
  P.band(19 + dx, 18 + dy, 10, 8, pal.skinL, pal.skinM, pal.skinD);
  P.px(21 + dx, 21 + dy, pal.eye); P.px(26 + dx, 21 + dy, pal.eye);
  P.px(21 + dx, 20 + dy, pal.skinD); P.px(26 + dx, 20 + dy, pal.skinD);
  P.px(23 + dx, 22 + dy, pal.cheek); P.px(20 + dx, 23 + dy, pal.cheek);
  P.rect(20 + dx, 25 + dy, 8, 1, pal.skinD);
  P.dome(24 + dx, 6 + dy, [8, 12, 14, 16, 18, 20], pal.strawL, pal.strawM, pal.strawD);
  P.rect(11 + dx, 12 + dy, 26, 1, pal.strawL); P.rect(9 + dx, 13 + dy, 30, 1, pal.strawM); P.rect(9 + dx, 14 + dy, 30, 1, pal.strawM);
  P.rect(10 + dx, 15 + dy, 28, 1, pal.strawM);
  P.rect(33 + dx, 13 + dy, 6, 3, pal.strawD);
  P.rect(9 + dx, 13 + dy, 3, 1, pal.strawL);
  P.rect(10 + dx, 16 + dy, 28, 1, pal.strawU); P.rect(12 + dx, 17 + dy, 24, 1, pal.strawU);
}

export function tangStand(P, pal) {
  tangLegsStand(P, pal);
  tangTorso(P, pal);
  tangArmL(P, pal);
  tangArmR(P, pal);
  tangHead(P, pal);
}

/* ---------------- 石器工匠 · 分层部件 ---------------- */

export function stoneLegsStand(P, pal, dx = 0, dy = 0) {
  P.band(18 + dx, 46 + dy, 6, 8, pal.skinL, pal.skinM, pal.skinD);
  P.band(25 + dx, 46 + dy, 6, 8, pal.skinL, pal.skinM, pal.skinD);
  P.rect(18 + dx, 48 + dy, 6, 1, pal.skinD); P.rect(25 + dx, 48 + dy, 6, 1, pal.skinD);
  P.rect(16 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(16 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(16 + dx, 57 + dy, 8, 1, pal.sole);
  P.rect(26 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(26 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(26 + dx, 57 + dy, 8, 1, pal.sole);
}

export function stoneLegsWalk(P, pal, f) {
  const stride = [3, 0, -3, 0][f];
  const lift = [0, 1, 0, 1][f];
  P.band(18 - stride, 46, 6, 8, pal.skinL, pal.skinM, pal.skinD);
  P.rect(18 - stride, 48, 6, 1, pal.skinD);
  P.rect(16 - stride, 55, 8, 2, pal.shoeM); P.rect(16 - stride, 55, 2, 1, pal.shoeL); P.rect(16 - stride, 57, 8, 1, pal.sole);
  P.band(25 + stride, 46, 6, 8 - lift, pal.skinL, pal.skinM, pal.skinD);
  P.rect(26 + stride, 55 - lift, 8, 2, pal.shoeM); P.rect(26 + stride, 55 - lift, 2, 1, pal.shoeL); P.rect(26 + stride, 57 - lift, 8, 1, pal.sole);
}

export function stoneLegsSit(P, pal, dx = 0, dy = 0) {
  P.rect(18 + dx, 48 + dy, 13, 4, pal.skinM);
  P.rect(18 + dx, 48 + dy, 13, 1, pal.skinL);
  P.rect(16 + dx, 52 + dy, 7, 3, pal.skinD);
  P.rect(26 + dx, 52 + dy, 7, 3, pal.skinD);
  P.rect(16 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(16 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(16 + dx, 57 + dy, 8, 1, pal.sole);
  P.rect(26 + dx, 55 + dy, 8, 2, pal.shoeM); P.rect(26 + dx, 55 + dy, 2, 1, pal.shoeL); P.rect(26 + dx, 57 + dy, 8, 1, pal.sole);
}

export function stoneTorso(P, pal, dx = 0, dy = 0) {
  P.rect(17 + dx, 38 + dy, 14, 3, pal.hideM);
  P.rect(17 + dx, 38 + dy, 4, 3, pal.hideL); P.rect(28 + dx, 38 + dy, 3, 3, pal.hideD);
  P.clear(19 + dx, 41 + dy); P.clear(23 + dx, 41 + dy); P.clear(27 + dx, 41 + dy);
  P.rect(18 + dx, 42 + dy, 6, 4, pal.skinM); P.rect(25 + dx, 42 + dy, 6, 4, pal.skinM);
  P.rect(18 + dx, 44 + dy, 6, 1, pal.skinD); P.rect(25 + dx, 44 + dy, 6, 1, pal.skinD);
  P.rect(16 + dx, 35 + dy, 16, 2, pal.ropeM);
  for (let x = 16; x < 32; x += 2) P.px(x + dx, 35 + dy, pal.ropeL);
  for (let x = 17; x < 32; x += 2) P.px(x + dx, 36 + dy, pal.ropeD);
  P.px(18 + dx, 36 + dy, pal.ropeL); P.px(19 + dx, 37 + dy, pal.ropeL);
  P.rect(16 + dx, 24 + dy, 16, 11, pal.hideM);
  P.rect(29 + dx, 24 + dy, 3, 11, pal.hideD);
  P.rect(14 + dx, 24 + dy, 5, 4, pal.skinM); P.rect(14 + dx, 24 + dy, 5, 1, pal.skinL);
  P.diag(29 + dx, 24 + dy, 17 + dx, 34 + dy, pal.hideL, 3);
  P.diag(29 + dx, 27 + dy, 19 + dx, 35 + dy, pal.hideD, 1);
  P.clear(16 + dx, 29 + dy); P.clear(31 + dx, 31 + dy); P.clear(17 + dx, 33 + dy);
}

export function stoneArmLCore(P, pal, dx = 0, dy = 0) {
  P.band(11 + dx, 26 + dy, 4, 10, pal.skinL, pal.skinM, pal.skinD);
  P.rect(14 + dx, 33 + dy, 6, 5, pal.stoneM);
  P.px(14 + dx, 33 + dy, pal.stoneL); P.px(15 + dx, 33 + dy, pal.stoneL); P.px(14 + dx, 34 + dy, pal.stoneL);
  P.rect(17 + dx, 36 + dy, 3, 2, pal.stoneD);
  P.rect(15 + dx, 37 + dy, 4, 2, pal.skinM); P.px(15 + dx, 37 + dy, pal.skinL);
}

export function stoneArmR(P, pal, dx = 0, dy = 0) {
  P.band(32 + dx, 26 + dy, 4, 8, pal.skinL, pal.skinM, pal.skinD);
  P.rect(31 + dx, 30 + dy, 6, 5, pal.stoneM);
  P.px(31 + dx, 30 + dy, pal.stoneL); P.px(32 + dx, 30 + dy, pal.stoneL); P.px(31 + dx, 31 + dy, pal.stoneL);
  P.rect(34 + dx, 33 + dy, 3, 2, pal.stoneD);
  P.rect(32 + dx, 34 + dy, 4, 3, pal.skinM); P.px(32 + dx, 34 + dy, pal.skinL);
}

export function stoneHead(P, pal, dx = 0, dy = 0) {
  P.rect(21 + dx, 22 + dy, 6, 2, pal.skinD);
  P.band(19 + dx, 13 + dy, 10, 9, pal.skinL, pal.skinM, pal.skinD);
  P.px(21 + dx, 16 + dy, pal.eye); P.px(26 + dx, 16 + dy, pal.eye);
  P.px(21 + dx, 15 + dy, pal.skinD); P.px(26 + dx, 15 + dy, pal.skinD);
  P.px(23 + dx, 17 + dy, pal.cheek); P.px(20 + dx, 18 + dy, pal.cheek);
  P.rect(20 + dx, 21 + dy, 8, 1, pal.skinD);
  P.dome(24 + dx, 5 + dy, [10, 14, 16, 16, 14, 12], pal.hairL, pal.hairM, pal.hairD);
  P.px(15 + dx, 8 + dy, pal.hairM); P.px(32 + dx, 9 + dy, pal.hairM); P.px(14 + dx, 10 + dy, pal.hairD); P.px(33 + dx, 11 + dy, pal.hairD);
  P.rect(19 + dx, 12 + dy, 10, 1, pal.skinD);
  P.rect(16 + dx, 13 + dy, 3, 6, pal.hairM); P.rect(29 + dx, 13 + dy, 3, 6, pal.hairM);
}

export function stoneStand(P, pal) {
  stoneLegsStand(P, pal);
  stoneTorso(P, pal);
  stoneArmLCore(P, pal);
  stoneArmR(P, pal);
  stoneHead(P, pal);
}

/* ---------------- 工业工人 · 分层部件 ---------------- */

export function steamLegsStand(P, pal, dx = 0, dy = 0) {
  P.band(17 + dx, 41 + dy, 7, 11, pal.pantsL, pal.pantsM, pal.pantsD);
  P.band(25 + dx, 41 + dy, 7, 4, pal.pantsL, pal.pantsM, pal.pantsD);
  P.band(26 + dx, 45 + dy, 7, 7, pal.pantsL, pal.pantsM, pal.pantsD);
  P.rect(15 + dx, 53 + dy, 9, 3, pal.bootM); P.rect(15 + dx, 53 + dy, 2, 1, pal.bootL); P.rect(15 + dx, 56 + dy, 9, 2, pal.bootSole);
  P.rect(26 + dx, 53 + dy, 9, 3, pal.bootM); P.rect(26 + dx, 53 + dy, 2, 1, pal.bootL); P.rect(26 + dx, 56 + dy, 9, 2, pal.bootSole);
}

export function steamLegsWalk(P, pal, f) {
  const stride = [3, 0, -3, 0][f];
  const lift = [0, 1, 0, 1][f];
  P.band(17 - stride, 41, 7, 11, pal.pantsL, pal.pantsM, pal.pantsD);
  P.rect(15 - stride, 53, 9, 3, pal.bootM); P.rect(15 - stride, 53, 2, 1, pal.bootL); P.rect(15 - stride, 56, 9, 2, pal.bootSole);
  P.band(25 + stride, 41, 7, 11 - lift, pal.pantsL, pal.pantsM, pal.pantsD);
  P.rect(26 + stride, 53 - lift, 9, 3, pal.bootM); P.rect(26 + stride, 53 - lift, 2, 1, pal.bootL); P.rect(26 + stride, 56 - lift, 9, 2, pal.bootSole);
}

export function steamLegsSit(P, pal, dx = 0, dy = 0) {
  P.rect(17 + dx, 46 + dy, 15, 4, pal.pantsM);
  P.rect(17 + dx, 46 + dy, 15, 1, pal.pantsL);
  P.band(19 + dx, 50 + dy, 6, 5, pal.pantsL, pal.pantsM, pal.pantsD);
  P.band(26 + dx, 50 + dy, 6, 5, pal.pantsL, pal.pantsM, pal.pantsD);
  P.rect(17 + dx, 55 + dy, 9, 2, pal.bootM); P.rect(17 + dx, 55 + dy, 2, 1, pal.bootL); P.rect(17 + dx, 57 + dy, 9, 1, pal.bootSole);
  P.rect(26 + dx, 55 + dy, 9, 2, pal.bootM); P.rect(26 + dx, 55 + dy, 2, 1, pal.bootL); P.rect(26 + dx, 57 + dy, 9, 1, pal.bootSole);
}

export function steamTorso(P, pal, dx = 0, dy = 0) {
  P.rect(15 + dx, 39 + dy, 18, 2, pal.pantsD);
  P.px(23 + dx, 39 + dy, pal.brass); P.px(24 + dx, 39 + dy, pal.brassL);
  P.rect(15 + dx, 25 + dy, 18, 14, pal.shirtM);
  P.rect(15 + dx, 25 + dy, 3, 14, pal.shirtL);
  P.rect(30 + dx, 25 + dy, 3, 14, pal.shirtD);
  P.rect(15 + dx, 24 + dy, 9, 1, pal.shirtL);
  P.rect(24 + dx, 25 + dy, 9, 1, pal.shirtM);
  P.rect(18 + dx, 26 + dy, 12, 13, pal.vestM);
  P.rect(18 + dx, 26 + dy, 1, 13, pal.vestL);
  P.rect(29 + dx, 26 + dy, 1, 13, pal.vestD);
  P.px(23 + dx, 26 + dy, pal.shirtL); P.px(24 + dx, 26 + dy, pal.shirtL);
  P.px(23 + dx, 27 + dy, pal.shirtM); P.px(24 + dx, 27 + dy, pal.shirtM);
  P.px(24 + dx, 28 + dy, pal.shirtM);
}

export function steamArmL(P, pal, dx = 0, dy = 0) {
  P.band(10 + dx, 25 + dy, 5, 6, pal.shirtL, pal.shirtM, pal.shirtD);
  P.rect(10 + dx, 31 + dy, 5, 2, pal.shirtL); P.px(14 + dx, 32 + dy, pal.shirtD);
  P.band(11 + dx, 33 + dy, 4, 6, pal.skinL, pal.skinM, pal.skinD);
  P.band(11 + dx, 39 + dy, 4, 3, pal.skinL, pal.skinM, pal.skinD);
}

export function steamArmR(P, pal, dx = 0, dy = 0) {
  P.band(33 + dx, 26 + dy, 5, 6, pal.shirtL, pal.shirtM, pal.shirtD);
  P.rect(33 + dx, 32 + dy, 5, 2, pal.shirtL); P.px(37 + dx, 33 + dy, pal.shirtD);
  P.band(34 + dx, 34 + dy, 4, 6, pal.skinL, pal.skinM, pal.skinD);
  P.band(34 + dx, 40 + dy, 4, 3, pal.skinL, pal.skinM, pal.skinD);
  P.rect(36 + dx, 42 + dy, 2, 8, pal.wrM); P.px(36 + dx, 42 + dy, pal.wrL);
  P.rect(34 + dx, 49 + dy, 6, 3, pal.wrM); P.clear(36 + dx, 49 + dy); P.px(34 + dx, 49 + dy, pal.wrL);
}

/* 劳动臂：卷袖 + 亮前臂斜出到握点 */
export function steamGripArm(P, pal, sx, sy, hx, hy) {
  P.diag(sx, sy, sx + 2, sy + 3, pal.shirtM, 4);
  P.rect(sx + 1, sy + 4, 4, 2, pal.shirtL);
  P.diag(sx + 2, sy + 6, hx - 1, hy - 1, pal.skinM, 3);
  P.diag(sx + 2, sy + 6, hx - 1, hy - 1, pal.skinL, 1);
  P.rect(hx - 1, hy - 1, 4, 3, pal.skinM);
  P.px(hx - 1, hy - 1, pal.skinL);
}

export function steamHead(P, pal, dx = 0, dy = 0) {
  P.rect(21 + dx, 23 + dy, 6, 2, pal.skinD);
  P.rect(19 + dx, 15 + dy, 10, 1, pal.skinD);
  P.band(19 + dx, 16 + dy, 10, 7, pal.skinL, pal.skinM, pal.skinD);
  P.px(21 + dx, 18 + dy, pal.eye); P.px(26 + dx, 18 + dy, pal.eye);
  P.px(23 + dx, 19 + dy, pal.cheek); P.px(20 + dx, 20 + dy, pal.cheek);
  P.rect(20 + dx, 22 + dy, 8, 1, pal.skinD);
  P.rect(17 + dx, 15 + dy, 2, 6, pal.hairM);
  P.dome(24 + dx, 8 + dy, [10, 14, 16, 16], pal.capL, pal.capM, pal.capD);
  P.px(24 + dx, 7 + dy, pal.capL);
  P.rect(24 + dx, 12 + dy, 10, 2, pal.capM); P.rect(24 + dx, 12 + dy, 10, 1, pal.capL);
  P.rect(24 + dx, 14 + dy, 10, 1, pal.capU);
  P.rect(14 + dx, 12 + dy, 10, 1, pal.capD);
}

export function steamStand(P, pal) {
  steamLegsStand(P, pal);
  steamTorso(P, pal);
  steamArmL(P, pal);
  steamArmR(P, pal);
  steamHead(P, pal);
}