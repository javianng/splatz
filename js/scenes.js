// Painted-cartoon scenery, drawn in code. Two scenes:
//  farm   - a lonely plank farmhouse under a blue moonlit night, windmill, pines
//  prison - a grimy concrete prison wall with razor wire and a watchtower, daytime
import { GROUND_Y, WORLD_H } from './data.js';

const INK = '#1c1512';
export const HOUSE_HW = 150;   // half-width of the building zombies attack

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function outline(ctx, w = 3) { ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(); }

let grainCanvas = null;
function grain(ctx, W, topY, alpha) {
  if (!grainCanvas) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainCanvas = c;
  }
  const grainPattern = ctx.createPattern(grainCanvas, 'repeat');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, topY, W, WORLD_H - topY);
  ctx.restore();
}
function vignette(ctx, W, topY, color) {
  const cx = W / 2, cy = (topY + WORLD_H) / 2;
  const R = Math.max(W, WORLD_H - topY) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, topY, W, WORLD_H - topY);
}

// Puffy outlined cloud with a lit top and shaded belly.
function paintCloud(ctx, x, y, s, light, mid, dark) {
  const puffs = [[0, 0, 60], [55, -18, 46], [-50, -8, 40], [100, 6, 36], [-92, 10, 30], [20, -42, 38]];
  ctx.save();
  ctx.beginPath();
  for (const [dx, dy, r] of puffs) { ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); }
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  const g = ctx.createLinearGradient(0, y - 80 * s, 0, y + 50 * s);
  g.addColorStop(0, light); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

// ---------- static layer (cached per resize) ----------
export function drawStatic(ctx, scene, W, topY) {
  ({ farm: farmStatic, prison: prisonStatic, grave: graveStatic, city: cityStatic, arctic: arcticStatic }[scene] || farmStatic)(ctx, W, topY);
}

function farmStatic(ctx, W, topY) {
  const r = rng(7);
  // deep blue night sky
  const g = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
  g.addColorStop(0, '#0b1630'); g.addColorStop(0.55, '#24406b'); g.addColorStop(1, '#4b6d9a');
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, GROUND_Y - topY);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(235,240,255,${0.25 + r() * 0.6})`;
    const sz = r() < 0.08 ? 2.6 : 1.3;
    ctx.fillRect(r() * W, topY + r() * (GROUND_Y - topY) * 0.65, sz, sz);
  }
  // moon
  const mx = W * 0.14, my = Math.max(topY + 120, 70);
  const mg = ctx.createRadialGradient(mx, my, 30, mx, my, 230);
  mg.addColorStop(0, 'rgba(220,235,255,0.5)'); mg.addColorStop(1, 'rgba(220,235,255,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 230, 0, 7); ctx.fill();
  ctx.fillStyle = '#f6f8ff'; ctx.beginPath(); ctx.arc(mx, my, 48, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(170,185,215,0.35)';
  [[-14, -10, 10], [16, 12, 8], [8, -22, 6], [-6, 20, 7]].forEach(([x, y, rr]) => { ctx.beginPath(); ctx.arc(mx + x, my + y, rr, 0, 7); ctx.fill(); });

  // a second, softer moon reflection cloud bank behind
  ctx.fillStyle = 'rgba(60,90,135,0.55)';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y - 160);
  for (let x = 0; x <= W + 60; x += 60) ctx.lineTo(x, GROUND_Y - 175 - Math.sin(x * 0.004) * 40 - Math.sin(x * 0.013 + 1) * 18);
  ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.fill();
  // far hills
  ctx.fillStyle = '#20345a';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, GROUND_Y - 105 - Math.sin(x * 0.005) * 36 - Math.sin(x * 0.019) * 12);
  ctx.lineTo(W, GROUND_Y); ctx.fill();
  // pines, darker toward the edges
  for (let i = 0; i < Math.ceil(W / 70); i++) {
    const x = i * 70 + r() * 40, h = 110 + r() * 110;
    if (Math.abs(x - W / 2) < HOUSE_HW + 60) continue;
    pine(ctx, x, GROUND_Y - 36, h, r() < 0.5 ? '#142441' : '#182b4c');
  }
  // wooden rail fence along the back
  const fenceY = GROUND_Y - 6;
  for (let x = 10; x < W; x += 54) {
    ctx.fillStyle = '#5f7392';
    ctx.beginPath(); ctx.rect(x, fenceY - 56, 10, 56); ctx.fill(); outline(ctx, 2.5);
  }
  ctx.fillStyle = '#6f84a4';
  for (const y of [fenceY - 46, fenceY - 24]) { ctx.beginPath(); ctx.rect(0, y, W, 8); ctx.fill(); outline(ctx, 2.5); }

  ground(ctx, W, '#46597a', '#212c3d', '#5d7396', r, false);
  vignette(ctx, W, topY, 'rgba(5,10,25,0.55)');
  grain(ctx, W, topY, 0.07);
}

function pine(ctx, x, base, h, col) {
  ctx.fillStyle = '#1a2233';
  ctx.fillRect(x - 5, base - 20, 10, 24);
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const w = (h * 0.42) * (1 - t * 0.2);
    const y0 = base - 14 - t * h * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - w, y0);
    ctx.lineTo(x, y0 - h * 0.38);
    ctx.lineTo(x + w, y0);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(10,14,24,0.9)'; ctx.stroke();
    // moonlit rim on the left side
    ctx.strokeStyle = 'rgba(120,150,200,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w + 4, y0 - 2); ctx.lineTo(x - 2, y0 - h * 0.36); ctx.stroke();
  }
}

function prisonStatic(ctx, W, topY) {
  const r = rng(11);
  const g = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
  g.addColorStop(0, '#7fb2df'); g.addColorStop(1, '#d7e6f0');
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, GROUND_Y - topY);
  // two layers of city
  const layer = (base, hMin, hMax, col, win) => {
    for (let x = -20; x < W; x += 50 + r() * 40) {
      const w = 50 + r() * 70, h = hMin + r() * (hMax - hMin);
      ctx.fillStyle = col;
      ctx.fillRect(x, base - h, w, h);
      if (r() < 0.4) ctx.fillRect(x + w * 0.3, base - h - 18, w * 0.15, 18); // roof box
      ctx.fillStyle = win;
      for (let wy = base - h + 10; wy < base - 10; wy += 18)
        for (let wx = x + 6; wx < x + w - 8; wx += 14) if (r() < 0.55) ctx.fillRect(wx, wy, 6, 9);
    }
  };
  const wallTop = GROUND_Y - 310;
  layer(wallTop + 40, 120, 300, '#b4c3d1', '#c9d5e0');
  layer(wallTop + 40, 60, 200, '#8e9fb0', '#a7b6c4');

  // concrete wall with panels and grime
  const wg = ctx.createLinearGradient(0, wallTop, 0, GROUND_Y);
  wg.addColorStop(0, '#d8d1c3'); wg.addColorStop(0.7, '#c4bcad'); wg.addColorStop(1, '#9f9787');
  ctx.fillStyle = wg; ctx.fillRect(0, wallTop, W, GROUND_Y - wallTop);
  ctx.fillStyle = '#b8b09f'; ctx.fillRect(0, wallTop, W, 16);
  ctx.strokeStyle = 'rgba(70,62,52,0.35)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 150) { ctx.beginPath(); ctx.moveTo(x, wallTop + 16); ctx.lineTo(x, GROUND_Y); ctx.stroke(); }
  ctx.fillStyle = '#5e7f4c'; ctx.fillRect(0, GROUND_Y - 125, W, 11);
  ctx.beginPath(); ctx.rect(0, wallTop, W, GROUND_Y - wallTop); outline(ctx, 3.5);
  // rust drips from the top and grime blooms
  for (let i = 0; i < W / 45; i++) {
    const x = r() * W;
    ctx.fillStyle = `rgba(110,80,50,${0.12 + r() * 0.15})`;
    const len = 40 + r() * 140;
    ctx.beginPath(); ctx.moveTo(x - 4, wallTop + 16); ctx.lineTo(x + 4, wallTop + 16); ctx.lineTo(x + 1, wallTop + 16 + len); ctx.lineTo(x - 1, wallTop + 16 + len); ctx.fill();
  }
  for (let i = 0; i < W / 70; i++) {
    const x = r() * W, y = wallTop + 60 + r() * 220;
    ctx.fillStyle = 'rgba(80,70,55,0.13)';
    ctx.beginPath(); ctx.ellipse(x, y, 25 + r() * 40, 45 + r() * 50, 0, 0, 7); ctx.fill();
    if (r() < 0.6) {
      ctx.fillStyle = '#5c5448';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60, 2.5 + r() * 2, 0, 7); ctx.fill(); }
    }
  }
  // cracks
  ctx.strokeStyle = 'rgba(40,35,30,0.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < W / 200; i++) {
    let x = r() * W, y = wallTop + 20 + r() * 80;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 34; y += 12 + r() * 18; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // blown-out hole near the right end
  const hx = W * 0.86, hy = GROUND_Y - 120;
  ctx.fillStyle = '#2d2924';
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, rr = 70 + r() * 30;
    const px = hx + Math.cos(a) * rr * 0.8, py = Math.min(GROUND_Y, hy + Math.sin(a) * rr);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill(); outline(ctx, 3);
  ctx.fillStyle = '#7d7466';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(hx - 80 + r() * 160, GROUND_Y - 6 - r() * 10, 10 + r() * 14, 6 + r() * 6, 0, 0, 7); ctx.fill(); outline(ctx, 2); }

  // target mural with a grinning skull
  const tx = W * 0.2, ty = GROUND_Y - 205;
  ctx.fillStyle = '#d24636'; ctx.beginPath(); ctx.arc(tx, ty, 66, 0, 7); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#efe6d3'; ctx.beginPath(); ctx.arc(tx, ty, 48, 0, 7); ctx.fill();
  ctx.fillStyle = '#d24636'; ctx.beginPath(); ctx.arc(tx, ty, 28, 0, 7); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(tx - 9, ty - 4, 5, 0, 7); ctx.arc(tx + 9, ty - 4, 5, 0, 7); ctx.fill();
  ctx.fillRect(tx - 10, ty + 8, 20, 4);
  // bloody hand prints
  for (let i = 0; i < 5; i++) handprint(ctx, W * (0.3 + r() * 0.5), GROUND_Y - 160 - r() * 90, r() - 0.5);
  ctx.save();
  ctx.translate(W * 0.05, GROUND_Y - 150); ctx.rotate(-0.12);
  ctx.font = '900 30px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = 'rgba(190,55,45,0.6)';
  ctx.fillText('KEEP OUT', 0, 0);
  ctx.restore();

  // razor wire on posts
  ctx.fillStyle = '#5c4c3d';
  for (let x = 30; x < W; x += 240) { ctx.beginPath(); ctx.rect(x, wallTop - 52, 8, 52); ctx.fill(); outline(ctx, 2); }
  ctx.strokeStyle = '#3e3e40'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.ellipse(x, wallTop - 18, 14, 15, 0, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, wallTop - 46); ctx.lineTo(W, wallTop - 46); ctx.stroke();

  // watchtower
  const wx = W * 0.8, base = wallTop;
  ctx.fillStyle = '#bdb5a5';
  ctx.beginPath(); ctx.moveTo(wx - 46, base); ctx.lineTo(wx - 36, base - 120); ctx.lineTo(wx + 36, base - 120); ctx.lineTo(wx + 46, base); ctx.closePath(); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#7f7768';
  ctx.beginPath(); ctx.rect(wx - 80, base - 200, 160, 82); ctx.fill(); outline(ctx);
  ctx.fillStyle = '#2b3542';
  ctx.fillRect(wx - 70, base - 190, 140, 50);
  ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(wx - 70 + i * 14, base - 190); ctx.lineTo(wx - 70 + i * 14, base - 140); ctx.stroke(); }
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(wx - 70, base - 190 + i * 12.5); ctx.lineTo(wx + 70, base - 190 + i * 12.5); ctx.stroke(); }
  ctx.fillStyle = '#9e9686'; ctx.beginPath(); ctx.rect(wx - 92, base - 124, 184, 10); ctx.fill(); outline(ctx, 2.5);
  ctx.fillStyle = '#56504a';
  ctx.beginPath(); ctx.moveTo(wx - 96, base - 200); ctx.lineTo(wx, base - 238); ctx.lineTo(wx + 96, base - 200); ctx.closePath(); ctx.fill(); outline(ctx);

  ground(ctx, W, '#b4ad9f', '#7f796c', '#cdc6b7', r, true);
  vignette(ctx, W, topY, 'rgba(40,30,20,0.35)');
  grain(ctx, W, topY, 0.06);
}

function handprint(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(140,25,25,0.55)';
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-9 + i * 6, -16 - (i === 1 || i === 2 ? 3 : 0), 2.6, 7, 0, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(12, -2, 3, 7, -0.8, 0, 7); ctx.fill();
  ctx.fillRect(-1, 10, 2, 16);
  ctx.restore();
}

function ground(ctx, W, top, bottom, light, r, paved = false) {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, GROUND_Y, W, WORLD_H - GROUND_Y);
  ctx.fillStyle = light; ctx.fillRect(0, GROUND_Y, W, 5);
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); outline(ctx, 3.5);
  if (paved) {
    ctx.strokeStyle = 'rgba(60,55,45,0.4)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 110) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 5); ctx.lineTo(x - 40, WORLD_H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 48); ctx.lineTo(W, GROUND_Y + 48); ctx.stroke();
    for (let i = 0; i < W / 60; i++) {
      const x = r() * W;
      ctx.strokeStyle = '#6e8a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 4); ctx.lineTo(x - 3, GROUND_Y - 6); ctx.moveTo(x, GROUND_Y + 4); ctx.lineTo(x + 3, GROUND_Y - 8); ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(20,28,45,0.35)';
    ctx.beginPath(); ctx.ellipse(W / 2, GROUND_Y + 50, W * 0.6, 26, 0, 0, 7); ctx.fill();
    for (let i = 0; i < W / 18; i++) {
      const x = r() * W, y = GROUND_Y + 4 + r() * 100;
      ctx.strokeStyle = r() < 0.5 ? '#5f789c' : '#3e5272'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 10); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 13); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 9);
      ctx.stroke();
    }
    for (let i = 0; i < W / 120; i++) {
      ctx.fillStyle = '#56698a';
      ctx.beginPath(); ctx.ellipse(r() * W, GROUND_Y + 20 + r() * 80, 6 + r() * 6, 3 + r() * 3, 0, 0, 7); ctx.fill(); outline(ctx, 1.5);
    }
  }
}

// ---------- animated layer ----------
export function drawAnimated(ctx, scene, W, topY, t) {
  if (scene === 'grave') return graveAnimated(ctx, W, topY, t);
  if (scene === 'city') return cityAnimated(ctx, W, topY, t);
  if (scene === 'arctic') return arcticAnimated(ctx, W, topY, t);
  if (scene === 'prison') {
    clouds(ctx, W, topY, t, '#ffffff', '#eef4fa', '#bccfe0');
    hazardFan(ctx, W * 0.5 - 30, GROUND_Y - 395, t);
    return;
  }
  clouds(ctx, W, topY, t, '#c7d5ec', '#8fa5c8', '#566f97');
  windmill(ctx, W * 0.5 - HOUSE_HW - 140, t);
}

function clouds(ctx, W, topY, t, light, mid, dark) {
  const skyTop = Math.max(topY + 70, -200);
  for (let i = 0; i < 5; i++) {
    const span = W + 500;
    const x = ((i * 433 + t * (6 + i * 2.5)) % span) - 250;
    const y = skyTop + 30 + (i % 3) * 70;
    const s = 0.55 + (i % 2) * 0.35;
    paintCloud(ctx, x, y, s, light, mid, dark);
  }
}

function windmill(ctx, x, t) {
  const top = GROUND_Y - 300;
  ctx.strokeStyle = INK; ctx.lineWidth = 9;
  const struts = () => {
    ctx.beginPath();
    ctx.moveTo(x - 44, GROUND_Y - 8); ctx.lineTo(x, top); ctx.lineTo(x + 44, GROUND_Y - 8);
    ctx.moveTo(x - 34, GROUND_Y - 100); ctx.lineTo(x + 34, GROUND_Y - 100);
    ctx.moveTo(x - 22, GROUND_Y - 190); ctx.lineTo(x + 22, GROUND_Y - 190);
    ctx.moveTo(x - 34, GROUND_Y - 100); ctx.lineTo(x + 22, GROUND_Y - 190);
    ctx.moveTo(x + 34, GROUND_Y - 100); ctx.lineTo(x - 22, GROUND_Y - 190);
    ctx.stroke();
  };
  struts();
  ctx.strokeStyle = '#5a6b86'; ctx.lineWidth = 4; struts();
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(t * 1.1);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    const g = ctx.createLinearGradient(0, -12, 0, 12);
    g.addColorStop(0, '#9aaac3'); g.addColorStop(1, '#55667f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(82, -13); ctx.lineTo(84, 9); ctx.lineTo(10, 3); ctx.closePath();
    ctx.fill(); outline(ctx, 2.5);
  }
  ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.strokeStyle = 'rgba(28,21,18,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#3a4659'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill(); outline(ctx, 2.5);
  ctx.restore();
  const g = ctx.createLinearGradient(0, top - 20, 0, top + 14);
  g.addColorStop(0, '#8090aa'); g.addColorStop(1, '#4a5a74');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x + 4, top - 4); ctx.lineTo(x + 72, top - 20); ctx.lineTo(x + 78, top + 14); ctx.lineTo(x + 4, top + 4); ctx.closePath();
  ctx.fill(); outline(ctx, 2.5);
}

function hazardFan(ctx, x, y, t) {
  ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.rect(x - 5, y, 10, 90); ctx.fill(); outline(ctx, 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 2.4);
  for (let i = 0; i < 10; i++) {
    ctx.rotate(Math.PI / 5);
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(62, -10); ctx.lineTo(62, 10); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc928'; ctx.fillRect(46, -10, 8, 20);
    ctx.fillStyle = INK; ctx.fillRect(54, -10, 4, 20);
    ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(62, -10); ctx.lineTo(62, 10); ctx.lineTo(8, 5); ctx.closePath(); outline(ctx, 1.5);
  }
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); outline(ctx, 2.5);
  ctx.restore();
}

// ---------- the building you defend ----------
export function drawBuilding(ctx, building, cx, hp, t, hurt) {
  ctx.save();
  if (hurt > 0) ctx.translate((Math.random() - 0.5) * hurt * 10, 0);
  ({ farmhouse, bunker, chapel, diner, cabin }[building] || farmhouse)(ctx, cx, hp, t);
  ctx.restore();
}

function farmhouse(ctx, cx, hp, t) {
  const hw = HOUSE_HW, wallTop = GROUND_Y - 180, peak = GROUND_Y - 310;
  // chimney
  ctx.fillStyle = '#5c4a48';
  ctx.beginPath(); ctx.rect(cx + 50, peak + 14, 42, 90); ctx.fill(); outline(ctx);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
  for (let y = peak + 26; y < peak + 100; y += 12) { ctx.beginPath(); ctx.moveTo(cx + 50, y); ctx.lineTo(cx + 92, y); ctx.stroke(); }
  ctx.fillStyle = '#3e3230'; ctx.beginPath(); ctx.rect(cx + 44, peak + 6, 54, 12); ctx.fill(); outline(ctx, 2.5);

  // plank walls, lit from the moon side
  const wg = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  wg.addColorStop(0, '#7a8fb0'); wg.addColorStop(0.5, '#5a6e90'); wg.addColorStop(1, '#43536f');
  ctx.fillStyle = wg;
  ctx.fillRect(cx - hw, wallTop, hw * 2, GROUND_Y - wallTop);
  for (let y = wallTop + 15, i = 0; y < GROUND_Y; y += 15, i++) {
    ctx.strokeStyle = 'rgba(15,20,35,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,215,240,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - hw, y + 2); ctx.lineTo(cx + hw, y + 2); ctx.stroke();
    // knots & plank ends
    ctx.fillStyle = 'rgba(20,25,40,0.35)';
    ctx.fillRect(cx - hw + ((i * 73) % (hw * 2 - 10)), y - 13, 2, 13);
  }
  ctx.beginPath(); ctx.rect(cx - hw, wallTop, hw * 2, GROUND_Y - wallTop); outline(ctx, 4);
  // corner posts
  ctx.fillStyle = '#3e4c66';
  for (const x of [cx - hw - 6, cx + hw - 6]) { ctx.beginPath(); ctx.rect(x, wallTop, 12, GROUND_Y - wallTop); ctx.fill(); outline(ctx, 2.5); }

  // shingle roof
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - hw - 34, wallTop + 8); ctx.lineTo(cx, peak); ctx.lineTo(cx + hw + 34, wallTop + 8); ctx.closePath();
  const rg = ctx.createLinearGradient(0, peak, 0, wallTop);
  rg.addColorStop(0, '#3b4860'); rg.addColorStop(1, '#232c3d');
  ctx.fillStyle = rg; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,14,24,0.55)'; ctx.lineWidth = 2;
  for (let y = peak + 14, row = 0; y < wallTop + 10; y += 14, row++) {
    ctx.beginPath(); ctx.moveTo(cx - hw - 40, y); ctx.lineTo(cx + hw + 40, y); ctx.stroke();
    for (let x = cx - hw - 40 + (row % 2) * 14; x < cx + hw + 40; x += 28) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke(); }
  }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(cx - hw - 34, wallTop + 8); ctx.lineTo(cx, peak); ctx.lineTo(cx + hw + 34, wallTop + 8); ctx.closePath(); outline(ctx, 4);
  ctx.strokeStyle = 'rgba(170,190,225,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - hw - 28, wallTop + 3); ctx.lineTo(cx - 4, peak + 6); ctx.stroke();

  // attic window
  const glow = 0.78 + Math.sin(t * 3) * 0.05;
  ctx.fillStyle = `rgba(255,212,120,${glow})`;
  ctx.beginPath(); ctx.arc(cx, peak + 64, 19, 0, 7); ctx.fill(); outline(ctx, 3);
  ctx.beginPath(); ctx.moveTo(cx - 19, peak + 64); ctx.lineTo(cx + 19, peak + 64); ctx.moveTo(cx, peak + 45); ctx.lineTo(cx, peak + 83); ctx.stroke();

  windowBox(ctx, cx - 112, wallTop + 44, 56, 52, hp < 0.66, glow);
  windowBox(ctx, cx + 56, wallTop + 44, 56, 52, hp < 0.4, glow);

  // porch roof + posts + door
  ctx.fillStyle = '#2c3648';
  ctx.beginPath(); ctx.moveTo(cx - 62, GROUND_Y - 116); ctx.lineTo(cx + 62, GROUND_Y - 116); ctx.lineTo(cx + 72, GROUND_Y - 100); ctx.lineTo(cx - 72, GROUND_Y - 100); ctx.closePath(); ctx.fill(); outline(ctx, 3);
  ctx.fillStyle = '#4b3424';
  ctx.beginPath(); ctx.rect(cx - 28, GROUND_Y - 96, 56, 96); ctx.fill(); outline(ctx, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(cx - 20, GROUND_Y - 86, 40, 34); ctx.strokeRect(cx - 20, GROUND_Y - 44, 40, 34);
  ctx.fillStyle = '#e0b040'; ctx.beginPath(); ctx.arc(cx + 18, GROUND_Y - 48, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#6f84a4';
  for (const x of [cx - 66, cx + 58]) { ctx.beginPath(); ctx.rect(x, GROUND_Y - 100, 8, 100); ctx.fill(); outline(ctx, 2.5); }
  ctx.fillStyle = '#556885'; ctx.beginPath(); ctx.rect(cx - 74, GROUND_Y - 10, 148, 10); ctx.fill(); outline(ctx, 2.5);

  // bunting
  const cols = ['#d4483a', '#f1ece0', '#3f6ac2', '#f1ece0'];
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - hw - 30, wallTop + 6);
  ctx.quadraticCurveTo(cx, wallTop + 40, cx + hw + 30, wallTop + 6); ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const k = (i + 0.5) / 11;
    const x0 = cx - hw - 30 + k * (hw * 2 + 60);
    const y0 = wallTop + 6 + 4 * k * (1 - k) * 34 * 1.0;
    ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.moveTo(x0 - 10, y0); ctx.lineTo(x0 + 10, y0); ctx.lineTo(x0, y0 + 20); ctx.closePath();
    ctx.fill(); outline(ctx, 1.5);
  }
  cracks(ctx, cx, wallTop, hp);
}

function windowBox(ctx, x, y, w, h, boarded, glow) {
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.8);
  g.addColorStop(0, `rgba(255,228,150,${glow})`); g.addColorStop(1, `rgba(220,150,60,${glow})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // curtains
  ctx.fillStyle = 'rgba(150,50,45,0.75)';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.25, y); ctx.quadraticCurveTo(x + w * 0.1, y + h * 0.5, x + w * 0.2, y + h); ctx.lineTo(x, y + h); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w * 0.75, y); ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.5, x + w * 0.8, y + h); ctx.lineTo(x + w, y + h); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#6f84a4'; ctx.fillRect(x - 6, y + h, w + 12, 7); ctx.strokeRect(x - 6, y + h, w + 12, 7);
  if (boarded) {
    ctx.fillStyle = '#8a6a48';
    ctx.save(); ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(0.35); ctx.fillRect(-w * 0.7, -6, w * 1.4, 12); ctx.strokeRect(-w * 0.7, -6, w * 1.4, 12);
    ctx.rotate(-0.7); ctx.fillRect(-w * 0.7, -6, w * 1.4, 12); ctx.strokeRect(-w * 0.7, -6, w * 1.4, 12);
    ctx.restore();
  }
}

function bunker(ctx, cx, hp) {
  const hw = HOUSE_HW, top = GROUND_Y - 225;
  const g = ctx.createLinearGradient(0, top, 0, GROUND_Y);
  g.addColorStop(0, '#ddd6c8'); g.addColorStop(1, '#a9a191');
  ctx.fillStyle = g;
  ctx.fillRect(cx - hw, top, hw * 2, GROUND_Y - top);
  ctx.fillStyle = '#c4bcad';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.rect(cx - hw + i * 52, top - 24, 32, 26); ctx.fill(); outline(ctx, 3); }
  ctx.beginPath(); ctx.rect(cx - hw, top, hw * 2, GROUND_Y - top); outline(ctx, 4);
  // grime
  ctx.fillStyle = 'rgba(80,70,55,0.15)';
  ctx.beginPath(); ctx.ellipse(cx - 90, GROUND_Y - 40, 50, 60, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 100, top + 70, 40, 50, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = i % 2 ? '#ffc928' : INK;
    ctx.beginPath(); ctx.moveTo(cx - hw + i * 20, top + 10); ctx.lineTo(cx - hw + i * 20 + 20, top + 10); ctx.lineTo(cx - hw + i * 20 + 14, top + 24); ctx.lineTo(cx - hw + i * 20 - 6, top + 24); ctx.fill();
  }
  ctx.beginPath(); ctx.rect(cx - hw, top + 10, hw * 2, 14); outline(ctx, 2);
  // steel door
  const dg = ctx.createLinearGradient(cx - 42, 0, cx + 42, 0);
  dg.addColorStop(0, '#94a3b0'); dg.addColorStop(1, '#617180');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.rect(cx - 42, GROUND_Y - 126, 84, 126); ctx.fill(); outline(ctx, 3.5);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, GROUND_Y - 126); ctx.lineTo(cx, GROUND_Y); ctx.stroke();
  ctx.fillStyle = '#333';
  for (const [x, y] of [[-34, -118], [34, -118], [-34, -8], [34, -8]]) { ctx.beginPath(); ctx.arc(cx + x, GROUND_Y + y, 2.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffc928';
  ctx.beginPath(); ctx.moveTo(cx, GROUND_Y - 112); ctx.lineTo(cx + 15, GROUND_Y - 86); ctx.lineTo(cx - 15, GROUND_Y - 86); ctx.closePath();
  ctx.fill(); outline(ctx, 2);
  ctx.fillStyle = INK; ctx.fillRect(cx - 1.5, GROUND_Y - 106, 3, 11); ctx.fillRect(cx - 1.5, GROUND_Y - 92, 3, 3);
  // barred slit windows
  for (const x of [cx - 122, cx + 72]) {
    ctx.fillStyle = '#26303b'; ctx.fillRect(x, top + 50, 50, 18);
    ctx.strokeStyle = '#a0a8b0'; ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, top + 50); ctx.lineTo(x + i * 10, top + 68); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x, top + 50, 50, 18);
  }
  cracks(ctx, cx, top, hp);
}

function cracks(ctx, cx, top, hp) {
  if (hp > 0.8) return;
  const r = rng(99);
  const n = Math.floor((1 - hp) * 9);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  for (let i = 0; i < n; i++) {
    let x = cx - HOUSE_HW + r() * HOUSE_HW * 2, y = top + 10 + r() * 60;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 34; y += 14 + r() * 18; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  if (hp < 0.35) {
    ctx.fillStyle = 'rgba(30,25,20,0.5)';
    ctx.beginPath(); ctx.ellipse(cx - HOUSE_HW + 30, GROUND_Y - 60, 26, 36, 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + HOUSE_HW - 34, GROUND_Y - 90, 22, 28, -0.3, 0, 7); ctx.fill();
  }
}

export function drawFence(ctx, x, hpRatio, scene, side) {
  if (hpRatio <= 0) return;
  const h = 70;
  ctx.save();
  ctx.translate(x, GROUND_Y);
  ctx.rotate((1 - hpRatio) * 0.14 * side);
  const wood = scene === 'prison' || scene === 'city' ? '#7d8c99' : scene === 'arctic' ? '#9a8a76' : '#8f7656';
  for (let i = -2; i <= 2; i++) {
    if (hpRatio < 0.5 && i === 2) continue;
    if (hpRatio < 0.3 && i === -2) continue;
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(i * 12 - 5, 0); ctx.lineTo(i * 12 - 5, -h + Math.abs(i) * 6);
    ctx.lineTo(i * 12, -h - 8 + Math.abs(i) * 6); ctx.lineTo(i * 12 + 5, -h + Math.abs(i) * 6); ctx.lineTo(i * 12 + 5, 0);
    ctx.closePath(); ctx.fill(); outline(ctx, 2.5);
  }
  ctx.fillStyle = wood;
  ctx.fillRect(-32, -50, 64, 9); ctx.strokeRect(-32, -50, 64, 9);
  ctx.fillRect(-32, -22, 64, 9); ctx.strokeRect(-32, -22, 64, 9);
  ctx.restore();
}

// =====================================================================
// Hollow Hill Cemetery: dusky violet sky, tombstones, dead trees, chapel
// =====================================================================
function graveStatic(ctx, W, topY) {
  const r = rng(23);
  const g = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
  g.addColorStop(0, '#1b1530'); g.addColorStop(0.5, '#3b2d55'); g.addColorStop(0.85, '#7a5a78'); g.addColorStop(1, '#a8798a');
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, GROUND_Y - topY);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,240,250,${0.2 + r() * 0.5})`;
    ctx.fillRect(r() * W, topY + r() * (GROUND_Y - topY) * 0.5, 1.4, 1.4);
  }
  // big low moon
  const mx = W * 0.78, my = Math.max(topY + 160, 140);
  const mg = ctx.createRadialGradient(mx, my, 40, mx, my, 260);
  mg.addColorStop(0, 'rgba(255,220,190,0.45)'); mg.addColorStop(1, 'rgba(255,220,190,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 260, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe6cc'; ctx.beginPath(); ctx.arc(mx, my, 78, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(220,170,150,0.35)';
  [[-22, -14, 14], [26, 18, 11], [10, -34, 8], [-14, 30, 9]].forEach(([x, y, rr]) => { ctx.beginPath(); ctx.arc(mx + x, my + y, rr, 0, 7); ctx.fill(); });
  // hills
  ctx.fillStyle = '#2c2342';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, GROUND_Y - 120 - Math.sin(x * 0.004 + 2) * 50 - Math.sin(x * 0.015) * 14);
  ctx.lineTo(W, GROUND_Y); ctx.fill();
  // dead trees
  for (let i = 0; i < Math.ceil(W / 260); i++) {
    const x = i * 260 + r() * 120;
    if (Math.abs(x - W / 2) < HOUSE_HW + 80) continue;
    deadTree(ctx, x, GROUND_Y - 20, 140 + r() * 90, r);
  }
  // iron fence
  ctx.strokeStyle = '#1a1424'; ctx.lineWidth = 4;
  for (let x = 8; x < W; x += 22) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 4); ctx.lineTo(x, GROUND_Y - 70); ctx.stroke();
    ctx.fillStyle = '#1a1424'; ctx.beginPath(); ctx.moveTo(x - 5, GROUND_Y - 70); ctx.lineTo(x, GROUND_Y - 82); ctx.lineTo(x + 5, GROUND_Y - 70); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y - 60); ctx.lineTo(W, GROUND_Y - 60); ctx.moveTo(0, GROUND_Y - 22); ctx.lineTo(W, GROUND_Y - 22); ctx.stroke();
  // tombstones
  for (let i = 0; i < W / 70; i++) {
    const x = r() * W;
    if (Math.abs(x - W / 2) < HOUSE_HW + 40) continue;
    tomb(ctx, x, GROUND_Y + 2, 0.7 + r() * 0.5, Math.floor(r() * 3), (r() - 0.5) * 0.2);
  }
  ground(ctx, W, '#4a3e52', '#211a29', '#5e5068', r, false);
  // open graves
  for (let i = 0; i < 4; i++) {
    const x = r() * W;
    if (Math.abs(x - W / 2) < HOUSE_HW + 60) continue;
    ctx.fillStyle = '#1a1220'; ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 30, 40, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a4636'; ctx.beginPath(); ctx.ellipse(x + 50, GROUND_Y + 24, 26, 10, 0, Math.PI, 0); ctx.fill(); outline(ctx, 2);
  }
  vignette(ctx, W, topY, 'rgba(15,5,25,0.6)');
  grain(ctx, W, topY, 0.07);
}

function deadTree(ctx, x, base, h, r) {
  ctx.strokeStyle = '#1a1424'; ctx.lineCap = 'round';
  const branch = (x0, y0, a, len, w, depth) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (depth <= 0) return;
    branch(x1, y1, a - 0.5 - r() * 0.3, len * 0.68, w * 0.62, depth - 1);
    branch(x1, y1, a + 0.4 + r() * 0.3, len * 0.62, w * 0.6, depth - 1);
  };
  branch(x, base, -Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.45, 12, 4);
}

function tomb(ctx, x, base, s, kind, rot) {
  ctx.save();
  ctx.translate(x, base); ctx.rotate(rot); ctx.scale(s, s);
  const g = ctx.createLinearGradient(-20, 0, 20, 0);
  g.addColorStop(0, '#8d8798'); g.addColorStop(1, '#5c5768');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (kind === 0) { ctx.moveTo(-20, 0); ctx.lineTo(-20, -44); ctx.arc(0, -44, 20, Math.PI, 0); ctx.lineTo(20, 0); }
  else if (kind === 1) { ctx.rect(-6, -70, 12, 70); ctx.rect(-22, -54, 44, 12); }
  else { ctx.moveTo(-24, 0); ctx.lineTo(-22, -40); ctx.lineTo(22, -40); ctx.lineTo(24, 0); }
  ctx.closePath(); ctx.fill(); outline(ctx, 3);
  if (kind !== 1) {
    ctx.strokeStyle = 'rgba(30,25,40,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(10, -30); ctx.moveTo(-8, -22); ctx.lineTo(8, -22); ctx.stroke();
    ctx.fillStyle = 'rgba(90,120,70,0.5)'; ctx.beginPath(); ctx.ellipse(-12, -2, 10, 5, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function graveAnimated(ctx, W, topY, t) {
  clouds(ctx, W, topY, t * 0.7, '#8a7aa8', '#5e4f7e', '#3a2f55');
  // bats on looping flight paths
  ctx.fillStyle = '#120c1c';
  for (let i = 0; i < 6; i++) {
    const k = t * (0.12 + i * 0.02) + i * 1.7;
    const x = ((k * 400) % (W + 200)) - 100;
    const y = Math.max(topY + 80, 40) + 60 + Math.sin(k * 3 + i) * 50 + i * 22;
    const flap = Math.sin(t * 18 + i * 2) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 10, y - 8 - flap, x - 22, y - 2 - flap);
    ctx.quadraticCurveTo(x - 12, y + 2, x, y + 4);
    ctx.quadraticCurveTo(x + 12, y + 2, x + 22, y - 2 - flap);
    ctx.quadraticCurveTo(x + 10, y - 8 - flap, x, y);
    ctx.fill();
  }
}

function chapel(ctx, cx, hp) {
  const hw = HOUSE_HW, top = GROUND_Y - 190;
  // bell tower
  const tx = cx + 70;
  const sg = ctx.createLinearGradient(tx - 36, 0, tx + 36, 0);
  sg.addColorStop(0, '#9b93a6'); sg.addColorStop(1, '#5e5868');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.rect(tx - 36, top - 130, 72, 140); ctx.fill(); outline(ctx, 3.5);
  ctx.fillStyle = '#1e1828'; ctx.beginPath(); ctx.moveTo(tx - 18, top - 70); ctx.lineTo(tx - 18, top - 100); ctx.arc(tx, top - 100, 18, Math.PI, 0); ctx.lineTo(tx + 18, top - 70); ctx.fill(); outline(ctx, 2.5);
  ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.moveTo(tx - 10, top - 76); ctx.quadraticCurveTo(tx, top - 104, tx + 10, top - 76); ctx.fill(); outline(ctx, 2);
  ctx.fillStyle = '#3a3048'; ctx.beginPath(); ctx.moveTo(tx - 46, top - 128); ctx.lineTo(tx, top - 210); ctx.lineTo(tx + 46, top - 128); ctx.closePath(); ctx.fill(); outline(ctx, 3.5);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx, top - 210); ctx.lineTo(tx, top - 246); ctx.moveTo(tx - 12, top - 234); ctx.lineTo(tx + 12, top - 234); ctx.stroke();
  ctx.strokeStyle = '#b0a8bc'; ctx.lineWidth = 3; ctx.stroke();
  // nave walls, stone blocks
  const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  g.addColorStop(0, '#a29aae'); g.addColorStop(1, '#5b5566');
  ctx.fillStyle = g; ctx.fillRect(cx - hw, top, hw * 2, GROUND_Y - top);
  ctx.strokeStyle = 'rgba(30,25,40,0.35)'; ctx.lineWidth = 2;
  for (let y = top + 22, row = 0; y < GROUND_Y; y += 22, row++) {
    ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.stroke();
    for (let x = cx - hw + (row % 2) * 24; x < cx + hw; x += 48) { ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.beginPath(); ctx.rect(cx - hw, top, hw * 2, GROUND_Y - top); outline(ctx, 4);
  // roof
  ctx.fillStyle = '#3a3048';
  ctx.beginPath(); ctx.moveTo(cx - hw - 24, top + 6); ctx.lineTo(cx - hw + 60, top - 70); ctx.lineTo(cx + 34, top - 70); ctx.lineTo(cx + 34, top + 6); ctx.closePath(); ctx.fill(); outline(ctx, 3.5);
  // stained-glass windows, glowing
  for (const wx of [cx - 105, cx - 40]) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(wx - 15, top + 100); ctx.lineTo(wx - 15, top + 50); ctx.arc(wx, top + 50, 15, Math.PI, 0); ctx.lineTo(wx + 15, top + 100); ctx.closePath();
    ctx.clip();
    const cols = ['#d4483a', '#3f6ac2', '#ffc928', '#5aa04a'];
    for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(wx - 15 + (i % 2) * 15, top + 32 + Math.floor(i / 2) * 18, 15, 18); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(wx - 15, top + 100); ctx.lineTo(wx - 15, top + 50); ctx.arc(wx, top + 50, 15, Math.PI, 0); ctx.lineTo(wx + 15, top + 100); ctx.closePath(); outline(ctx, 3);
  }
  // arched wooden door
  ctx.fillStyle = '#4a3020';
  ctx.beginPath(); ctx.moveTo(cx + 30, GROUND_Y); ctx.lineTo(cx + 30, GROUND_Y - 70); ctx.arc(cx + 62, GROUND_Y - 70, 32, Math.PI, 0); ctx.lineTo(cx + 94, GROUND_Y); ctx.closePath(); ctx.fill(); outline(ctx, 3.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
  for (const x of [cx + 46, cx + 62, cx + 78]) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 96); ctx.stroke(); }
  ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.arc(cx + 84, GROUND_Y - 48, 4, 0, 7); ctx.fill();
  // ivy
  ctx.fillStyle = '#3e5a3a';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(cx - hw + 10 + (i % 3) * 8, GROUND_Y - 20 - i * 9, 7, 5, i, 0, 7); ctx.fill(); }
  cracks(ctx, cx, top, hp);
}

// =====================================================================
// Downtown Sundown: sunset skyline, street lamps, burning car, diner
// =====================================================================
function cityStatic(ctx, W, topY) {
  const r = rng(31);
  const g = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
  g.addColorStop(0, '#2a2a5a'); g.addColorStop(0.45, '#a8476a'); g.addColorStop(0.75, '#f08a4a'); g.addColorStop(1, '#ffc46a');
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, GROUND_Y - topY);
  // sun
  const sx = W * 0.3, sy = GROUND_Y - 190;
  const sg = ctx.createRadialGradient(sx, sy, 30, sx, sy, 300);
  sg.addColorStop(0, 'rgba(255,230,160,0.8)'); sg.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 300, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe7a0'; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, 7); ctx.fill();
  // skyline silhouettes, two depths
  const sky = (base, hMin, hMax, col, lit) => {
    for (let x = -20; x < W; x += 40 + r() * 50) {
      const w = 50 + r() * 80, h = hMin + r() * (hMax - hMin);
      ctx.fillStyle = col; ctx.fillRect(x, base - h, w, h);
      if (r() < 0.3) { ctx.fillRect(x + w / 2 - 2, base - h - 40, 4, 40); }
      if (lit) {
        ctx.fillStyle = 'rgba(255,210,120,0.75)';
        for (let wy = base - h + 12; wy < base - 12; wy += 16)
          for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < 0.22) ctx.fillRect(wx, wy, 5, 8);
      }
    }
  };
  sky(GROUND_Y - 40, 160, 380, '#6a3a5e', false);
  sky(GROUND_Y - 20, 80, 240, '#3a2240', true);
  // wrecked cars
  for (const [x, flip] of [[W * 0.12, 1], [W * 0.88, -1]]) car(ctx, x, GROUND_Y + 2, flip, r() < 2);
  // street lamps
  for (let x = 120; x < W; x += 380) {
    if (Math.abs(x - W / 2) < HOUSE_HW + 40) continue;
    ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.rect(x - 4, GROUND_Y - 220, 8, 220); ctx.fill(); outline(ctx, 2);
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 220); ctx.quadraticCurveTo(x + 4, GROUND_Y - 250, x + 34, GROUND_Y - 244); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(x + 34, GROUND_Y - 238, 12, 6, 0, 0, 7); ctx.fill(); outline(ctx, 2);
  }
  // asphalt + curb
  const ag = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
  ag.addColorStop(0, '#5a5060'); ag.addColorStop(1, '#2a2430');
  ctx.fillStyle = ag; ctx.fillRect(0, GROUND_Y, W, WORLD_H - GROUND_Y);
  ctx.fillStyle = '#8a7e88'; ctx.fillRect(0, GROUND_Y, W, 12);
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.moveTo(0, GROUND_Y + 12); ctx.lineTo(W, GROUND_Y + 12); outline(ctx, 3);
  ctx.fillStyle = '#e8c04a';
  for (let x = 0; x < W; x += 90) ctx.fillRect(x, GROUND_Y + 62, 50, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < W / 150; i++) { ctx.beginPath(); ctx.ellipse(r() * W, GROUND_Y + 40 + r() * 60, 20 + r() * 30, 4, 0, 0, 7); ctx.fill(); }
  vignette(ctx, W, topY, 'rgba(40,10,30,0.45)');
  grain(ctx, W, topY, 0.06);
}

function car(ctx, x, base, flip, burnt) {
  ctx.save();
  ctx.translate(x, base); ctx.scale(flip, 1); ctx.rotate(-0.04);
  ctx.fillStyle = burnt ? '#4a3a3a' : '#7a3a3a';
  ctx.beginPath(); ctx.moveTo(-90, -14); ctx.lineTo(-86, -44); ctx.lineTo(-40, -50); ctx.lineTo(-20, -80); ctx.lineTo(40, -80); ctx.lineTo(60, -50); ctx.lineTo(92, -44); ctx.lineTo(94, -14); ctx.closePath();
  ctx.fill(); outline(ctx, 3.5);
  ctx.fillStyle = '#2a2430';
  ctx.beginPath(); ctx.moveTo(-14, -74); ctx.lineTo(16, -74); ctx.lineTo(16, -52); ctx.lineTo(-30, -52); ctx.closePath(); ctx.fill(); outline(ctx, 2);
  ctx.beginPath(); ctx.moveTo(22, -74); ctx.lineTo(38, -74); ctx.lineTo(52, -52); ctx.lineTo(22, -52); ctx.closePath(); ctx.fill(); outline(ctx, 2);
  for (const wx of [-56, 58]) { ctx.fillStyle = '#1a1620'; ctx.beginPath(); ctx.arc(wx, -12, 17, 0, 7); ctx.fill(); outline(ctx, 3); ctx.fillStyle = '#6a6070'; ctx.beginPath(); ctx.arc(wx, -12, 6, 0, 7); ctx.fill(); }
  ctx.restore();
}

function cityAnimated(ctx, W, topY, t) {
  clouds(ctx, W, topY, t * 0.6, '#ffc3a0', '#e07a7a', '#8a4a6a');
  // smoke and flames from the wrecks
  for (const x of [W * 0.12, W * 0.88]) {
    for (let i = 0; i < 7; i++) {
      const k = (t * 0.35 + i / 7) % 1;
      const px = x + Math.sin(t + i * 2) * 14 + k * 50, py = GROUND_Y - 80 - k * 260;
      ctx.fillStyle = `rgba(40,30,40,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(px, py, 18 + k * 40, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const fl = Math.sin(t * 12 + i * 3) * 6;
      ctx.fillStyle = i % 2 ? '#ffc928' : '#ff7a2a';
      ctx.beginPath(); ctx.moveTo(x - 30 + i * 16, GROUND_Y - 78); ctx.quadraticCurveTo(x - 24 + i * 16, GROUND_Y - 120 - fl, x - 18 + i * 16, GROUND_Y - 78); ctx.fill();
    }
  }
}

function diner(ctx, cx, hp, t) {
  const hw = HOUSE_HW, top = GROUND_Y - 170;
  // tall sign pole with flickering neon
  const px = cx - hw + 20;
  ctx.fillStyle = '#3a3040'; ctx.beginPath(); ctx.rect(px - 5, top - 140, 10, 140); ctx.fill(); outline(ctx, 2.5);
  const on = Math.sin(t * 7) > -0.85 || Math.sin(t * 31) > 0.5;
  ctx.fillStyle = '#2a2034'; ctx.beginPath(); ctx.roundRect(px - 70, top - 200, 140, 64, 14); ctx.fill(); outline(ctx, 3.5);
  ctx.font = '900 30px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = on ? '#ff5a8a' : '#6a3a4a';
  if (on) { ctx.shadowColor = '#ff5a8a'; ctx.shadowBlur = 16; }
  ctx.fillText('EATS', px, top - 156);
  ctx.shadowBlur = 0;
  ctx.fillStyle = on ? '#6ae0ff' : '#2a5060'; ctx.font = '900 13px "Arial Black", Impact, sans-serif';
  ctx.fillText('OPEN 24 HRS', px, top - 142);
  // chrome-and-teal body
  const g = ctx.createLinearGradient(0, top, 0, GROUND_Y);
  g.addColorStop(0, '#d9e4e6'); g.addColorStop(0.45, '#9fb7bc'); g.addColorStop(1, '#6e8a90');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - hw, top, hw * 2, GROUND_Y - top, [40, 40, 0, 0]); ctx.fill(); outline(ctx, 4);
  ctx.fillStyle = '#2fa6a0'; ctx.fillRect(cx - hw, GROUND_Y - 70, hw * 2, 18);
  ctx.fillStyle = '#d4483a'; ctx.fillRect(cx - hw, top + 18, hw * 2, 12);
  ctx.beginPath(); ctx.rect(cx - hw, GROUND_Y - 70, hw * 2, 18); ctx.rect(cx - hw, top + 18, hw * 2, 12); outline(ctx, 2);
  // big windows with warm light
  for (let i = 0; i < 4; i++) {
    const wx = cx - hw + 16 + i * 70;
    if (i === 2) continue;
    ctx.fillStyle = 'rgba(255,214,140,0.85)'; ctx.fillRect(wx, top + 44, 56, 46);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(wx, top + 44, 56, 46);
    if (hp < 0.5 && i % 2 === 0) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wx + 10, top + 50); ctx.lineTo(wx + 30, top + 70); ctx.lineTo(wx + 22, top + 86); ctx.moveTo(wx + 30, top + 70); ctx.lineTo(wx + 50, top + 64); ctx.stroke(); }
  }
  // door
  const dx = cx - hw + 156;
  ctx.fillStyle = '#7fb8c0'; ctx.beginPath(); ctx.rect(dx, GROUND_Y - 110, 48, 110); ctx.fill(); outline(ctx, 3);
  ctx.fillStyle = 'rgba(255,214,140,0.8)'; ctx.fillRect(dx + 8, GROUND_Y - 100, 32, 50);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(dx + 8, GROUND_Y - 100, 32, 50);
  cracks(ctx, cx, top, hp);
}

// =====================================================================
// Frostbite Outpost: aurora, snowy peaks, research cabin, falling snow
// =====================================================================
function arcticStatic(ctx, W, topY) {
  const r = rng(41);
  const g = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
  g.addColorStop(0, '#071423'); g.addColorStop(0.6, '#163550'); g.addColorStop(1, '#3a6a86');
  ctx.fillStyle = g; ctx.fillRect(0, topY, W, GROUND_Y - topY);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(230,245,255,${0.25 + r() * 0.6})`;
    ctx.fillRect(r() * W, topY + r() * (GROUND_Y - topY) * 0.6, 1.4, 1.4);
  }
  // snowy peaks, two ranges
  const range = (base, amp, col, snow) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
    const pts = [];
    for (let x = -100; x <= W + 200; x += 160 + r() * 120) { const y = base - amp * (0.5 + r() * 0.5); pts.push([x, y]); ctx.lineTo(x, y); ctx.lineTo(x + 80, base - amp * 0.2); }
    ctx.lineTo(W, GROUND_Y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = snow;
    for (const [x, y] of pts) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 30, y + 50); ctx.lineTo(x - 10, y + 40); ctx.lineTo(x + 6, y + 56); ctx.lineTo(x + 30, y + 44); ctx.closePath(); ctx.fill(); }
  };
  range(GROUND_Y - 60, 300, '#24425e', '#c9deeb');
  range(GROUND_Y - 30, 180, '#335a76', '#e6f2f8');
  // snowy pines
  for (let i = 0; i < Math.ceil(W / 90); i++) {
    const x = i * 90 + r() * 50, h = 90 + r() * 90;
    if (Math.abs(x - W / 2) < HOUSE_HW + 70) continue;
    pine(ctx, x, GROUND_Y - 20, h, '#1c3a48');
    ctx.fillStyle = '#eaf4fa';
    for (let k = 0; k < 4; k++) { const y0 = GROUND_Y - 34 - k * h * 0.22, w = h * 0.42 * (1 - k * 0.2); ctx.beginPath(); ctx.ellipse(x - w * 0.3, y0 - 6, w * 0.45, 5, -0.4, 0, 7); ctx.fill(); }
  }
  // snow ground with drifts
  const sg = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
  sg.addColorStop(0, '#eef6fb'); sg.addColorStop(1, '#a9c4d6');
  ctx.fillStyle = sg; ctx.fillRect(0, GROUND_Y, W, WORLD_H - GROUND_Y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 2);
  for (let x = 0; x <= W; x += 60) ctx.quadraticCurveTo(x + 30, GROUND_Y - 10 - r() * 8, x + 60, GROUND_Y + 2);
  ctx.lineTo(W, GROUND_Y + 8); ctx.lineTo(0, GROUND_Y + 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); outline(ctx, 3);
  ctx.fillStyle = 'rgba(120,160,190,0.35)';
  for (let i = 0; i < W / 80; i++) { ctx.beginPath(); ctx.ellipse(r() * W, GROUND_Y + 30 + r() * 80, 30 + r() * 40, 5, 0, 0, 7); ctx.fill(); }
  vignette(ctx, W, topY, 'rgba(0,10,25,0.5)');
  grain(ctx, W, topY, 0.06);
}

function arcticAnimated(ctx, W, topY, t) {
  // aurora ribbons
  const top = Math.max(topY + 40, -200);
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 30) {
      const y = top + 80 + b * 40 + Math.sin(x * 0.004 + t * 0.4 + b) * 40 + Math.sin(x * 0.011 + t * 0.7) * 15;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = ['rgba(90,255,170,0.22)', 'rgba(120,200,255,0.18)', 'rgba(190,120,255,0.14)'][b];
    ctx.lineWidth = 40 - b * 8;
    ctx.stroke();
  }
  // falling snow
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const H = GROUND_Y - top + 60;
  for (let i = 0; i < 90; i++) {
    const sp = 30 + (i % 4) * 18;
    const x = ((i * 137 + t * 25 + Math.sin(t + i) * 20) % (W + 40) + W + 40) % (W + 40) - 20;
    const y = top + ((i * 71 + t * sp) % H);
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, 7); ctx.fill();
  }
}

function cabin(ctx, cx, hp) {
  const hw = HOUSE_HW, top = GROUND_Y - 170;
  // radio mast + satellite dish
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx + 90, top - 30); ctx.lineTo(cx + 90, top - 200); ctx.stroke();
  ctx.strokeStyle = '#c9d6df'; ctx.lineWidth = 2.5; ctx.stroke();
  for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#c9d6df'; ctx.beginPath(); ctx.moveTo(cx + 82, top - 40 - i * 32); ctx.lineTo(cx + 98, top - 56 - i * 32); ctx.stroke(); }
  ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(cx + 90, top - 204, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9e3ea'; ctx.beginPath(); ctx.ellipse(cx - 70, top - 34, 34, 18, -0.5, 0, Math.PI); ctx.fill(); outline(ctx, 3);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 70, top - 30); ctx.lineTo(cx - 60, top - 2); ctx.stroke();
  // log/panel walls in red
  const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
  g.addColorStop(0, '#c4553e'); g.addColorStop(1, '#7e2e24');
  ctx.fillStyle = g; ctx.fillRect(cx - hw, top, hw * 2, GROUND_Y - top);
  ctx.strokeStyle = 'rgba(40,10,10,0.4)'; ctx.lineWidth = 2;
  for (let x = cx - hw + 24; x < cx + hw; x += 24) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, GROUND_Y); ctx.stroke(); }
  ctx.beginPath(); ctx.rect(cx - hw, top, hw * 2, GROUND_Y - top); outline(ctx, 4);
  // snow-heavy roof
  ctx.fillStyle = '#4a4a52';
  ctx.beginPath(); ctx.moveTo(cx - hw - 26, top + 4); ctx.lineTo(cx - hw + 10, top - 50); ctx.lineTo(cx + hw - 10, top - 50); ctx.lineTo(cx + hw + 26, top + 4); ctx.closePath(); ctx.fill(); outline(ctx, 3.5);
  ctx.fillStyle = '#f4faff';
  ctx.beginPath(); ctx.moveTo(cx - hw - 30, top - 4); ctx.quadraticCurveTo(cx - hw, top - 70, cx - hw + 20, top - 56);
  ctx.lineTo(cx + hw - 20, top - 56); ctx.quadraticCurveTo(cx + hw, top - 70, cx + hw + 30, top - 4);
  ctx.quadraticCurveTo(cx, top - 30, cx - hw - 30, top - 4); ctx.fill(); outline(ctx, 3);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = '#dff0fa'; ctx.beginPath(); ctx.moveTo(cx - hw - 10 + i * 42, top + 2); ctx.lineTo(cx - hw - 4 + i * 42, top + 18 + (i % 3) * 6); ctx.lineTo(cx - hw + 2 + i * 42, top + 2); ctx.fill(); }
  // windows + door
  for (const wx of [cx - 112, cx + 56]) {
    ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.fillRect(wx, top + 40, 56, 44);
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.strokeRect(wx, top + 40, 56, 44);
    ctx.beginPath(); ctx.moveTo(wx + 28, top + 40); ctx.lineTo(wx + 28, top + 84); ctx.stroke();
    ctx.fillStyle = '#f4faff'; ctx.fillRect(wx - 4, top + 84, 64, 8); ctx.strokeRect(wx - 4, top + 84, 64, 8);
  }
  ctx.fillStyle = '#d9e3ea'; ctx.beginPath(); ctx.rect(cx - 28, GROUND_Y - 100, 56, 100); ctx.fill(); outline(ctx, 3.5);
  ctx.fillStyle = '#2a5a8a'; ctx.beginPath(); ctx.arc(cx, GROUND_Y - 70, 12, 0, 7); ctx.fill(); outline(ctx, 2);
  ctx.fillStyle = '#f4faff'; ctx.beginPath(); ctx.ellipse(cx, GROUND_Y - 2, 60, 10, 0, Math.PI, 0); ctx.fill();
  cracks(ctx, cx, top, hp);
}

// Drifting fog banks, densest at the edges where zombies arrive.
export function drawFog(ctx, W, topY, t, k, scene) {
  const col = scene === 'arctic' ? '230,240,248' : scene === 'grave' ? '170,155,190' : '200,205,215';
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : W;
    const g = ctx.createLinearGradient(x0, 0, W / 2 + side * (HOUSE_HW + 140), 0);
    g.addColorStop(0, `rgba(${col},${0.92 * k})`);
    g.addColorStop(0.55, `rgba(${col},${0.55 * k})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(side < 0 ? 0 : W / 2 + HOUSE_HW + 140, topY, W / 2 - HOUSE_HW - 140, WORLD_H - topY);
  }
  ctx.fillStyle = `rgba(${col},${0.25 * k + 0.1})`;
  for (let i = 0; i < 8; i++) {
    const x = ((i * 260 + t * (18 + i * 4)) % (W + 400)) - 200;
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y - 20 - (i % 3) * 30, 180, 36, 0, 0, 7); ctx.fill();
  }
}
