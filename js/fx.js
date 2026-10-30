// Visual effects: gore particles, ground splat decals, floating text, shake.
import { GROUND_Y, GRAVITY } from './data.js';

const MAX_PARTS = 500;
const MAX_DECALS = 90;

export class FX {
  constructor() {
    this.parts = [];
    this.decals = [];
    this.texts = [];
    this.shake = 0;
    this.flashes = [];
  }

  clear() {
    this.parts.length = 0;
    this.decals.length = 0;
    this.texts.length = 0;
    this.flashes.length = 0;
    this.shake = 0;
  }

  // Cartoon splat: red + zombie-green goo blobs flying out.
  splat(x, y, power = 1, { frozen = false } = {}) {
    const n = Math.floor(14 + power * 18);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const sp = (200 + Math.random() * 700) * (0.6 + power * 0.5);
      this.add({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 3 + Math.random() * 6 * (frozen ? 0.8 : 1),
        color: frozen ? (Math.random() < 0.5 ? '#dff6ff' : '#9fd8f5')
          : (Math.random() < 0.72 ? '#b81f24' : '#7fb53a'),
        life: 1.2 + Math.random() * 0.8,
        kind: frozen ? 'ice' : 'goo',
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20
      });
    }
    if (!frozen) this.decal(x, power);
  }

  spray(x, y, vx, vy, n = 6) {
    for (let i = 0; i < n; i++) {
      this.add({
        x, y,
        vx: vx * 0.3 + (Math.random() - 0.5) * 300,
        vy: -Math.random() * 400 - 60,
        r: 2 + Math.random() * 3,
        color: Math.random() < 0.8 ? '#b81f24' : '#7fb53a',
        life: 0.8, kind: 'goo'
      });
    }
  }

  dust(x, n = 6) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 30, y: GROUND_Y - 4,
        vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 120,
        r: 6 + Math.random() * 8, color: 'rgba(160,140,110,0.5)',
        life: 0.6, kind: 'smoke', grow: 30
      });
    }
  }

  explosion(x, y, radius = 200, small = false) {
    const n = small ? 12 : 28;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 500;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150,
        r: 10 + Math.random() * 18,
        color: ['#fff2a8', '#ffc928', '#ff7a2a', '#d33a2c'][i % 4],
        life: 0.45 + Math.random() * 0.3, kind: 'fire', grow: 40
      });
    }
    if (small) { this.shake = Math.max(this.shake, 5); return; }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({
        x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 120 - 120,
        r: 14 + Math.random() * 14, color: 'rgba(60,55,50,0.6)',
        life: 1.1, kind: 'smoke', grow: 50
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = -Math.random() * Math.PI;
      const sp = 400 + Math.random() * 600;
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 3 + Math.random() * 4, color: '#3a2f25', life: 1.4, kind: 'goo'
      });
    }
    this.flashes.push({ x, y, r: radius, t: 0.22, max: 0.22 });
    this.decal(x, 2.2, '#2a2420');
    this.shake = Math.max(this.shake, 18);
  }

  gas(x, y, radius = 150) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, r: 14 + Math.random() * 16,
        color: i % 3 ? 'rgba(150,190,60,0.55)' : 'rgba(110,150,40,0.6)', life: 1 + Math.random() * 0.6, kind: 'smoke', grow: 40 });
    }
    this.flashes.push({ x, y, r: radius, t: 0.18, max: 0.18, color: '190,230,90' });
    this.decal(x, 1.6, 'rgba(110,150,40,0.6)');
    this.shake = Math.max(this.shake, 8);
  }

  iceBurst(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 450;
      this.add({
        x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 80,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100,
        r: 4 + Math.random() * 6, color: i % 3 ? '#e6f8ff' : '#7fd4ff',
        life: 1, kind: 'ice', rot: Math.random() * 6, vr: (Math.random() - .5) * 20
      });
    }
  }

  decal(x, size = 1, color = null) {
    const blobs = [];
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      blobs.push({
        dx: (Math.random() - 0.5) * 70 * size,
        dy: (Math.random() - 0.3) * 10,
        rx: (8 + Math.random() * 22) * size,
        ry: (3 + Math.random() * 5) * Math.min(1.5, size)
      });
    }
    this.decals.push({
      x, blobs,
      color: color || (Math.random() < 0.75 ? 'rgba(150,20,25,0.75)' : 'rgba(110,160,50,0.7)')
    });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  text(x, y, str, { color = '#fff', size = 26, life = 1.1, rise = 70 } = {}) {
    this.texts.push({ x, y, str, color, size, life, max: life, rise });
  }

  add(p) {
    p.max = p.life;
    this.parts.push(p);
    if (this.parts.length > MAX_PARTS) this.parts.shift();
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 60);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (p.kind === 'smoke' || p.kind === 'fire') {
        p.vx *= 0.92; p.vy = p.vy * 0.92 - 40 * dt;
        p.r += (p.grow || 0) * dt;
      } else {
        p.vy += GRAVITY * 0.8 * dt;
        if (p.rot != null) p.rot += p.vr * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'goo' && p.y > GROUND_Y + 8) {
        // land as a tiny smear
        if (Math.random() < 0.15 && this.decals.length) {
          const d = this.decals[this.decals.length - 1];
          if (d.blobs.length < 14) d.blobs.push({ dx: p.x - d.x, dy: 4 + Math.random() * 8, rx: p.r * 1.4, ry: p.r * 0.5 });
        }
        this.parts.splice(i, 1);
      } else if (p.kind === 'ice' && p.y > GROUND_Y + 6) {
        p.y = GROUND_Y + 6; p.vy *= -0.3; p.vx *= 0.6;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= t.rise * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].t -= dt;
      if (this.flashes[i].t <= 0) this.flashes.splice(i, 1);
    }
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      for (const b of d.blobs) {
        ctx.moveTo(d.x + b.dx + b.rx, GROUND_Y + 10 + b.dy);
        ctx.ellipse(d.x + b.dx, GROUND_Y + 10 + b.dy, b.rx, b.ry, 0, 0, 7);
      }
      ctx.fill();
    }
  }

  drawParts(ctx) {
    for (const p of this.parts) {
      const a = Math.min(1, p.life / p.max * 1.5);
      ctx.globalAlpha = p.kind === 'smoke' || p.kind === 'fire' ? a : Math.min(1, a + 0.2);
      ctx.fillStyle = p.color;
      if (p.kind === 'ice') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.7, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.7, 0);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of this.flashes) {
      const k = f.t / f.max;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.4 - k * 0.4));
      g.addColorStop(0, `rgba(${f.color || '255,245,200'},${0.9 * k})`);
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.4, 0, 7); ctx.fill();
    }
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${Math.round(t.size * pop)}px "Arial Black", Impact, sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = '#1a1410';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
