// Specials and pickups. Every object has update(dt, game) -> done? and draw(ctx).
// Throwables (Grenade, Molotov) also support being held: obj.grab = {tx, ty}.
import { GROUND_Y, GRAVITY, SPECIALS } from './data.js';
import { HOUSE_HW } from './scenes.js';
import { sfx } from './audio.js';

const INK = '#1c1512';

// ---------- supply crate ----------
export class Crate {
  constructor(x, topY, kind) {
    this.x = x; this.y = Math.max(topY, -200) - 60;
    this.kind = kind;
    this.landed = false;
    this.life = 7;
    this.sway = Math.random() * 6;
  }
  hit(x, y) { return Math.hypot(x - this.x, y - (this.y - 10)) < 60; }
  update(dt) {
    this.sway += dt * 2;
    if (!this.landed) {
      this.y += 130 * dt;
      this.x += Math.sin(this.sway) * 18 * dt;
      if (this.y >= GROUND_Y - 22) { this.y = GROUND_Y - 22; this.landed = true; }
    } else this.life -= dt;
    return this.life <= 0;
  }
  draw(ctx) {
    if (this.landed && this.life < 2 && Math.floor(this.life * 8) % 2) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (!this.landed) {
      ctx.rotate(Math.sin(this.sway) * 0.15);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(-44, -78); ctx.moveTo(20, -18); ctx.lineTo(44, -78); ctx.moveTo(0, -18); ctx.lineTo(0, -92); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-50, -76); ctx.quadraticCurveTo(0, -130, 50, -76); ctx.quadraticCurveTo(0, -92, -50, -76);
      ctx.fillStyle = '#f2e9d8'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-18, -84); ctx.quadraticCurveTo(0, -122, 18, -84);
      ctx.fillStyle = '#d64a3a'; ctx.fill();
    }
    ctx.fillStyle = '#b07a3e';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-24, -24, 48, 48);
    ctx.beginPath(); ctx.moveTo(-24, -24); ctx.lineTo(24, 24); ctx.moveTo(24, -24); ctx.lineTo(-24, 24); ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(-16, -16); drawIcon(ctx, this.kind, 32, true); ctx.restore();
    ctx.restore();
  }
}

// ---------- throwables ----------
export class Grenade {
  constructor(x, y) {
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.r = 15;
    this.fuse = 3.6;
    this.grab = null;
    this.rot = 0;
  }
  hit(x, y) { return Math.hypot(x - this.x, y - this.y) < 60; }
  move(dt, game) {
    if (this.grab) {
      this.px = this.x; this.py = this.y;
      this.x += (this.grab.tx - this.x) * 0.6;
      this.y += (this.grab.ty - this.y) * 0.6;
      return false;
    }
    const vx = (this.x - this.px) * 0.995, vy = (this.y - this.py) * 0.995;
    this.px = this.x; this.py = this.y;
    this.x += vx; this.y += vy + GRAVITY * dt * dt;
    let landed = false;
    if (this.y > GROUND_Y - this.r) {
      landed = Math.abs(vy) / dt > 250;
      this.y = GROUND_Y - this.r;
      this.py = this.y + vy * 0.45;
      this.px = this.x - vx * 0.8;
    }
    const [w0, w1] = game.walls;
    if (this.x < w0 + this.r) { this.x = w0 + this.r; this.px = this.x + vx * 0.5; }
    if (this.x > w1 - this.r) { this.x = w1 - this.r; this.px = this.x + vx * 0.5; }
    return landed;
  }
  // Knock zombies around while flying fast. Returns true if something was hit.
  whack(dt, game) {
    const vx = (this.x - this.px) / dt, vy = (this.y - this.py) / dt;
    const sp = Math.hypot(vx, vy);
    this.rot += vx * dt * 0.05;
    if (sp < 450) return false;
    let hit = false;
    for (const z of game.zombies) {
      if (!z.alive || z.hitCooldown > 0) continue;
      for (const p of z.pts) {
        if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r + 4) {
          z.push(vx * 0.6, vy * 0.6 - 300, dt);
          z.hitCooldown = 0.25;
          game.damage(z, sp / 2600, { x: this.x, y: this.y, cause: 'whack' });
          sfx.thud(0.6);
          hit = true;
          break;
        }
      }
    }
    return hit;
  }
  update(dt, game) {
    this.fuse -= dt;
    this.move(dt, game);
    this.whack(dt, game);
    if (this.fuse <= 0) { game.explode(this.x, this.y, 210, 3); return true; }
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = '#4f7a3a';
    ctx.beginPath(); ctx.ellipse(0, 2, this.r, this.r * 1.1, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-this.r, 2); ctx.lineTo(this.r, 2); ctx.moveTo(0, -this.r + 2); ctx.lineTo(0, this.r + 4); ctx.stroke();
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(-6, -this.r - 6, 12, 8); ctx.strokeStyle = INK; ctx.strokeRect(-6, -this.r - 6, 12, 8);
    ctx.restore();
    const blink = this.fuse < 1.2 ? Math.floor(this.fuse * 10) % 2 : Math.floor(this.fuse * 3) % 2;
    if (blink) { ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(this.x, this.y - this.r - 10, 5, 0, 7); ctx.fill(); }
    label(ctx, Math.ceil(this.fuse).toString(), this.x, this.y - this.r - 26, 18);
  }
}

export class Molotov extends Grenade {
  constructor(x, y) { super(x, y); this.r = 13; this.fuse = 8; this.flick = 0; this.thrown = false; }
  update(dt, game) {
    this.fuse -= dt;
    this.flick += dt;
    if (this.grab) this.thrown = true;
    const landed = this.move(dt, game);
    const hitZ = !this.grab && this.whack(dt, game);
    // wick embers
    if (Math.random() < 0.5) game.fx.add({ x: this.x, y: this.y - this.r - 14, vx: (Math.random() - 0.5) * 40, vy: -60, r: 3 + Math.random() * 3, color: '#ffb02a', life: 0.3, kind: 'fire', grow: 8 });
    if (!this.grab && this.thrown && (landed || hitZ || this.y >= GROUND_Y - this.r - 1) || this.fuse <= 0) {
      sfx.shatter(); sfx.fire();
      for (let i = 0; i < 14; i++) game.fx.add({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 500, vy: -Math.random() * 400, r: 2 + Math.random() * 3, color: '#bfe3c9', life: 0.8, kind: 'ice', rot: 0, vr: 10 });
      game.fx.explosion(this.x, this.y, 70, true);
      game.objects.push(new FirePool(this.x, game));
      return true;
    }
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = 'rgba(120,170,110,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 4, this.r, this.r * 1.2, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#e09a2a'; ctx.fillRect(-this.r + 3, 2, this.r * 2 - 6, this.r * 0.9);
    ctx.fillStyle = 'rgba(120,170,110,0.9)'; ctx.fillRect(-5, -this.r - 10, 10, 14); ctx.strokeRect(-5, -this.r - 10, 10, 14);
    ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.moveTo(-4, -this.r - 10); ctx.lineTo(3, -this.r - 20); ctx.lineTo(6, -this.r - 9); ctx.fill();
    ctx.restore();
  }
}

export class FirePool {
  constructor(x, game) {
    this.x = x; this.w = 180 * game.blast; this.life = 5.5; this.t = 0;
  }
  update(dt, game) {
    this.life -= dt; this.t += dt;
    const x0 = this.x - this.w / 2, x1 = this.x + this.w / 2;
    for (let i = 0; i < 3; i++) {
      game.fx.add({ x: x0 + Math.random() * this.w, y: GROUND_Y - 4, vx: (Math.random() - 0.5) * 30, vy: -80 - Math.random() * 120,
        r: 8 + Math.random() * 10, color: ['#fff2a8', '#ffc928', '#ff7a2a', '#d33a2c'][i % 4], life: 0.5 + Math.random() * 0.3, kind: 'fire', grow: 10 });
    }
    for (const z of game.zombies) {
      if (!z.alive) continue;
      const f1 = z.pts[8], f2 = z.pts[10];
      const inFire = [f1, f2, z.pelvis].some((p) => p.x > x0 && p.x < x1 && p.y > GROUND_Y - 60);
      if (inFire) {
        z.burn = 2;
        game.damage(z, 1.2 * game.blast * dt, { x: z.pelvis.x, y: z.pelvis.y, cause: 'fire', quiet: true });
      }
    }
    return this.life <= 0;
  }
  draw(ctx) {
    const a = Math.min(1, this.life);
    ctx.globalAlpha = a * 0.85;
    const g = ctx.createRadialGradient(this.x, GROUND_Y, 10, this.x, GROUND_Y, this.w * 0.6);
    g.addColorStop(0, 'rgba(255,200,80,0.9)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(this.x, GROUND_Y + 4, this.w * 0.6, 22, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- placed ----------
export class Boulder {
  constructor(fromLeft, game) {
    this.R = 68;
    this.dir = fromLeft ? 1 : -1;
    this.x = fromLeft ? game.walls[0] - this.R : game.walls[1] + this.R;
    this.y = GROUND_Y - this.R;
    this.vx = 820 * this.dir;
    this.rot = 0;
    this.stopX = game.centerX - (HOUSE_HW + this.R + 10) * this.dir;
    this.hitSet = new Set();
    sfx.rumble();
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.rot += (this.vx / this.R) * dt;
    this.y = GROUND_Y - this.R - Math.abs(Math.sin(this.rot * 2)) * 3;
    game.fx.shake = Math.max(game.fx.shake, 4);
    if (Math.random() < 0.5) game.fx.dust(this.x - this.dir * this.R * 0.6, 1);
    for (const z of game.zombies) {
      if (this.hitSet.has(z)) continue;
      const b = z.bounds();
      if (b.x1 > this.x - this.R && b.x0 < this.x + this.R && b.y1 > this.y - this.R) {
        this.hitSet.add(z);
        if (!z.alive) { z.push(this.vx * 0.8, -600, dt); continue; }
        z.push(this.vx * 1.4, -900 - Math.random() * 500, dt);
        game.damage(z, 4.5 * game.blast, { x: z.pelvis.x, y: z.pelvis.y, cause: 'boulder', crush: true });
        sfx.splat(0.8);
      }
    }
    if ((this.x - this.stopX) * this.dir >= 0) {
      for (let i = 0; i < 18; i++) {
        game.fx.add({ x: this.x + (Math.random() - 0.5) * this.R, y: this.y + (Math.random() - 0.5) * this.R,
          vx: (Math.random() - 0.5) * 500 - this.dir * 150, vy: -200 - Math.random() * 500,
          r: 6 + Math.random() * 10, color: i % 2 ? '#8a7a68' : '#6a5c4e', life: 1.2, kind: 'ice', rot: 0, vr: 5 });
      }
      game.fx.dust(this.x, 10);
      game.fx.shake = 14;
      sfx.boom();
      return true;
    }
    return false;
  }
  draw(ctx) { drawRock(ctx, this.x, this.y, this.R, this.rot); }
}

export class Mine {
  constructor(x) { this.x = x; this.t = 0; this.armed = false; sfx.beep(); }
  update(dt, game) {
    this.t += dt;
    if (!this.armed && this.t > 0.6) { this.armed = true; sfx.beep(); }
    if (!this.armed) return false;
    for (const z of game.zombies) {
      if (!z.alive) continue;
      for (const p of [z.pts[8], z.pts[10], z.pelvis]) {
        if (Math.abs(p.x - this.x) < 30 && p.y > GROUND_Y - 50) {
          game.explode(this.x, GROUND_Y - 10, 175, 3.4);
          return true;
        }
      }
    }
    return false;
  }
  draw(ctx) {
    ctx.fillStyle = '#4a4a3c';
    ctx.beginPath(); ctx.ellipse(this.x, GROUND_Y + 2, 24, 9, 0, Math.PI, 0); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#6a6a54'; ctx.fillRect(this.x - 6, GROUND_Y - 12, 12, 5);
    if (!this.armed || Math.floor(this.t * 3) % 2) {
      ctx.fillStyle = this.armed ? '#ff3a2a' : '#ffc928';
      ctx.beginPath(); ctx.arc(this.x, GROUND_Y - 14, 3.5, 0, 7); ctx.fill();
    }
  }
}

export class Anvil {
  constructor(x, game) {
    this.x = x; this.y = Math.max(game.topY, -250) - 60; this.vy = 300;
    this.landed = false; this.life = 3; this.hitSet = new Set();
    sfx.whoosh();
  }
  update(dt, game) {
    if (!this.landed) {
      this.vy += GRAVITY * 1.3 * dt;
      this.y += this.vy * dt;
      for (const z of game.zombies) {
        if (this.hitSet.has(z)) continue;
        const b = z.bounds();
        if (b.x1 > this.x - 50 && b.x0 < this.x + 50 && this.y + 30 > b.y0 - 20) {
          this.hitSet.add(z);
          z.push((z.pelvis.x - this.x) * 6, 400, dt);
          if (z.alive) game.damage(z, 8 * game.blast, { x: z.head.x, y: z.head.y, cause: 'anvil', crush: true });
        }
      }
      if (this.y >= GROUND_Y - 34) {
        this.y = GROUND_Y - 34; this.landed = true;
        sfx.clang(); game.fx.dust(this.x, 14); game.fx.shake = 16;
        for (const z of game.zombies) {
          if (!z.alive || this.hitSet.has(z)) continue;
          const d = Math.abs(z.pelvis.x - this.x);
          if (d < 120) { z.push(Math.sign(z.pelvis.x - this.x) * 600, -700, dt); game.damage(z, 1, { x: z.pelvis.x, y: z.pelvis.y }); }
        }
      }
    } else this.life -= dt;
    return this.life <= 0;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.life);
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#4a4f58';
    ctx.beginPath();
    ctx.moveTo(-60, -30); ctx.lineTo(42, -30); ctx.quadraticCurveTo(70, -28, 76, -14); ctx.lineTo(30, -12);
    ctx.lineTo(22, 6); ctx.lineTo(40, 34); ctx.lineTo(-40, 34); ctx.lineTo(-22, 6); ctx.lineTo(-30, -12); ctx.lineTo(-60, -12); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-56, -27, 96, 6);
    ctx.font = '900 16px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('1 TON', 0, 26);
    ctx.restore();
  }
}

// ---------- aimed ----------
export class Meteor {
  constructor(tx, game) {
    this.tx = tx;
    const side = tx < game.centerX ? -1 : 1;
    this.sx = tx + 500 * side;
    this.sy = Math.max(game.topY, -250) - 120;
    this.t = 0; this.dur = 0.75;
    this.x = this.sx; this.y = this.sy;
    sfx.whoosh();
  }
  update(dt, game) {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur), e = k * k;
    this.x = this.sx + (this.tx - this.sx) * e;
    this.y = this.sy + (GROUND_Y - 20 - this.sy) * e;
    for (let i = 0; i < 3; i++) {
      game.fx.add({ x: this.x + (Math.random() - 0.5) * 20, y: this.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 60, vy: -40,
        r: 12 + Math.random() * 10, color: ['#fff2a8', '#ffc928', '#ff7a2a'][i], life: 0.35, kind: 'fire', grow: 30 });
    }
    if (k >= 1) { game.explode(this.tx, GROUND_Y - 20, 240, 4); return true; }
    return false;
  }
  draw(ctx) {
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath(); ctx.arc(this.x, this.y, 30, 0, 7); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(this.x - 8, this.y - 6, 9, 0, 7); ctx.fill();
  }
}

export class Airstrike {
  constructor(tx, game) {
    this.tx = tx;
    this.dir = tx < game.centerX ? 1 : -1;
    this.x = this.dir > 0 ? -200 : game.W + 200;
    this.y = Math.max(game.topY + 90, 70);
    this.speed = 950;
    this.drops = [-180, -90, 0, 90, 180].map((o) => tx + o * this.dir - 120 * this.dir); // lead the target
    this.bombs = [];
    this.W = game.W;
    sfx.plane();
  }
  update(dt, game) {
    this.x += this.speed * this.dir * dt;
    while (this.drops.length && (this.x - this.drops[0]) * this.dir >= 0) {
      this.drops.shift();
      this.bombs.push({ x: this.x, y: this.y + 20, vx: this.speed * 0.25 * this.dir, vy: 0 });
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.vy += GRAVITY * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y >= GROUND_Y - 12) { game.explode(b.x, GROUND_Y - 12, 135, 2.4); this.bombs.splice(i, 1); }
    }
    const gone = this.dir > 0 ? this.x > this.W + 250 : this.x < -250;
    return gone && !this.bombs.length && !this.drops.length;
  }
  draw(ctx) {
    for (const b of this.bombs) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
      ctx.fillStyle = '#3a3f2e'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 14, 0, 0, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillRect(-7, -16, 14, 4);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK;
    ctx.fillStyle = '#5c6a44';
    ctx.beginPath(); ctx.moveTo(-90, -6); ctx.lineTo(-110, -34); ctx.lineTo(-92, -34); ctx.lineTo(-70, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 100, 18, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4c5a36';
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(30, 0); ctx.lineTo(-10, 46); ctx.lineTo(-40, 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fc6e0'; ctx.beginPath(); ctx.ellipse(66, -8, 18, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1ece0'; ctx.beginPath(); ctx.arc(-30, 0, 8, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d4483a'; ctx.beginPath(); ctx.arc(-30, 0, 3.5, 0, 7); ctx.fill();
    ctx.restore();
  }
}

export class Bolt {
  constructor(points) { this.life = 0.35; this.paths = points.map(([a, b]) => jag(a, b)); }
  update(dt) { this.life -= dt; return this.life <= 0; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.life * 4);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of this.paths) {
      for (const [w, c] of [[12, 'rgba(160,200,255,0.4)'], [5, '#fff6b0'], [2, '#ffffff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function jag(a, b) {
  const pts = [a];
  const n = 8;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([a[0] + (b[0] - a[0]) * k + (Math.random() - 0.5) * 40, a[1] + (b[1] - a[1]) * k + (Math.random() - 0.5) * 20]);
  }
  pts.push(b);
  return pts;
}

export class Vortex {
  constructor(x, y) {
    this.x = x; this.y = Math.min(GROUND_Y - 90, Math.max(GROUND_Y - 280, y));
    this.t = 0; this.dur = 3.2; this.R = 420;
    sfx.vortex();
  }
  update(dt, game) {
    this.t += dt;
    const ending = this.t >= this.dur;
    for (const z of game.zombies) {
      const c = z.pelvis;
      const dx = this.x - c.x, dy = this.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d > this.R) continue;
      if (ending) {
        const a = Math.atan2(-dy, -dx);
        z.push(Math.cos(a) * 1600, Math.sin(a) * 1600 - 800, dt);
        if (z.alive) game.damage(z, 1.6 * game.blast, { x: c.x, y: c.y, cause: 'vortex' });
        continue;
      }
      if (z.alive && z.state !== 'ragdoll') z.toRagdoll();
      const pull = (4200 / Math.max(1, z.mass * 0.6)) * (1 - d / this.R * 0.5);
      const swirl = 2600;
      const ax = (dx / (d || 1)) * pull + (-dy / (d || 1)) * swirl;
      const ay = (dy / (d || 1)) * pull + (dx / (d || 1)) * swirl - 2600 * 0.9; // cancel most gravity
      for (const p of z.pts) {
        let vx = p.vx + ax * dt * dt, vy = p.vy + ay * dt * dt;
        const sp = Math.hypot(vx, vy), max = 900 * dt;
        if (sp > max) { vx *= max / sp; vy *= max / sp; }
        p.setVel(vx, vy);
      }
      if (z.alive) game.damage(z, 0.7 * game.blast * dt, { x: c.x, y: c.y, cause: 'vortex', quiet: true });
    }
    if (ending) { game.fx.shake = 12; sfx.boom(); }
    return ending;
  }
  draw(ctx) {
    const k = Math.min(1, this.t * 3) * Math.min(1, (this.dur - this.t) * 3 + 0.2);
    ctx.save();
    ctx.translate(this.x, this.y);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(this.t * 4 + i);
      ctx.strokeStyle = `rgba(${160 + i * 15},${90 + i * 10},255,${0.55 * k})`;
      ctx.lineWidth = 8 - i;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.2) {
        const r = (20 + a * 26) * k;
        a ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.6);
      }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(30,10,50,${0.8 * k})`;
    ctx.beginPath(); ctx.arc(0, 0, 18 * k, 0, 7); ctx.fill();
    ctx.restore();
  }
}

// ---------- helpers ----------
function label(ctx, txt, x, y, size) {
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = INK;
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y);
}

function drawRock(ctx, x, y, R, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#8a7a68';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = R * (0.92 + ((i * 37) % 10) / 100);
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#6a5c4e';
  ctx.beginPath(); ctx.ellipse(-R * 0.26, -R * 0.2, R * 0.24, R * 0.15, 0.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(R * 0.32, R * 0.26, R * 0.18, R * 0.12, -0.3, 0, 7); ctx.fill();
  ctx.restore();
}

// Ghost preview drawn while dragging a placed/aimed special out of its slot.
export function drawAimPreview(ctx, kind, x, y, game, t) {
  const use = SPECIALS[kind].use;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  if (kind === 'boulder') {
    const left = x < game.centerX;
    const sx = left ? 60 : game.W - 60;
    ctx.beginPath(); ctx.moveTo(sx, GROUND_Y - 68); ctx.lineTo(game.centerX + (left ? -HOUSE_HW - 80 : HOUSE_HW + 80), GROUND_Y - 68); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.75;
    drawRock(ctx, sx, GROUND_Y - 68, 68, 0);
    ctx.globalAlpha = 1;
    label(ctx, left ? 'Roll left side →' : '← Roll right side', game.centerX + (left ? -300 : 300), GROUND_Y - 160, 22);
  } else if (use === 'place') {
    ctx.beginPath(); ctx.moveTo(x, Math.max(game.topY, -250)); ctx.lineTo(x, GROUND_Y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 4, kind === 'anvil' ? 60 : 28, 9, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.save(); ctx.translate(x - 26, GROUND_Y - 70); drawIcon(ctx, kind, 52, true); ctx.restore();
  } else {
    const r = kind === 'airstrike' ? 220 : kind === 'vortex' ? 140 : kind === 'meteor' ? 120 : 70;
    const yy = kind === 'lightning' || kind === 'vortex' ? y : GROUND_Y - 10;
    ctx.strokeStyle = '#ff5a3a';
    ctx.beginPath(); ctx.ellipse(x, yy, r, kind === 'airstrike' || kind === 'meteor' ? 24 : r, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    const s = 22 + Math.sin(t * 8) * 3;
    ctx.beginPath(); ctx.moveTo(x - s, yy); ctx.lineTo(x + s, yy); ctx.moveTo(x, yy - s); ctx.lineTo(x, yy + s); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, yy, s * 0.6, 0, 7); ctx.stroke();
  }
  ctx.restore();
  label(ctx, 'Release to ' + (use === 'aim' ? 'fire' : 'drop'), x, Math.min(y, GROUND_Y - 120) - 50, 18);
}

// Draw a special's icon in a square of size S (origin top-left).
export function drawIcon(ctx, kind, S, noClear = false) {
  if (!noClear) ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.scale(S / 64, S / 64);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  switch (kind) {
    case 'grenade':
      ctx.fillStyle = '#4f7a3a';
      ctx.beginPath(); ctx.ellipse(0, 4, 15, 17, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(-6, -18, 12, 8); ctx.strokeRect(-6, -18, 12, 8);
      ctx.beginPath(); ctx.arc(10, -16, 6, 0, 7); ctx.stroke();
      break;
    case 'freeze':
      ctx.fillStyle = '#dff6ff'; ctx.fillRect(-10, -16, 20, 32); ctx.strokeRect(-10, -16, 20, 32);
      ctx.fillStyle = '#7fd4ff'; ctx.fillRect(-10, -2, 20, 18);
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(-5, -24, 10, 8); ctx.strokeRect(-5, -24, 10, 8);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(18, -10 + i * 10); ctx.lineTo(26, -14 + i * 10); ctx.stroke(); }
      break;
    case 'molotov':
      ctx.fillStyle = '#88b47a'; ctx.beginPath(); ctx.ellipse(0, 8, 13, 16, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e09a2a'; ctx.fillRect(-11, 6, 22, 12);
      ctx.fillStyle = '#88b47a'; ctx.fillRect(-5, -16, 10, 12); ctx.strokeRect(-5, -16, 10, 12);
      ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.moveTo(-4, -16); ctx.quadraticCurveTo(-8, -30, 2, -32); ctx.quadraticCurveTo(10, -24, 4, -16); ctx.fill();
      ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.moveTo(-1, -17); ctx.quadraticCurveTo(-3, -25, 2, -26); ctx.quadraticCurveTo(6, -22, 3, -17); ctx.fill();
      break;
    case 'boulder':
      ctx.fillStyle = '#8a7a68'; ctx.beginPath(); ctx.arc(0, 2, 20, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6a5c4e'; ctx.beginPath(); ctx.ellipse(-6, -4, 7, 4, 0.4, 0, 7); ctx.fill();
      break;
    case 'landmine':
      ctx.fillStyle = '#5a5a48'; ctx.beginPath(); ctx.ellipse(0, 8, 22, 10, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a7a62'; ctx.fillRect(-6, -6, 12, 6); ctx.strokeRect(-6, -6, 12, 6);
      ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(0, -10, 4, 0, 7); ctx.fill();
      break;
    case 'meteor':
      ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.moveTo(-24, -24); ctx.lineTo(4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(6, 6, 14, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(2, 2, 5, 0, 7); ctx.fill();
      break;
    case 'lightning':
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.moveTo(6, -26); ctx.lineTo(-12, 4); ctx.lineTo(0, 4); ctx.lineTo(-6, 26); ctx.lineTo(14, -6); ctx.lineTo(2, -6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    case 'anvil':
      ctx.fillStyle = '#4a4f58';
      ctx.beginPath(); ctx.moveTo(-24, -12); ctx.lineTo(16, -12); ctx.quadraticCurveTo(26, -10, 28, -4); ctx.lineTo(10, -4);
      ctx.lineTo(8, 4); ctx.lineTo(16, 16); ctx.lineTo(-16, 16); ctx.lineTo(-8, 4); ctx.lineTo(-12, -4); ctx.lineTo(-24, -4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    case 'airstrike':
      ctx.fillStyle = '#5c6a44';
      ctx.beginPath(); ctx.ellipse(0, -6, 26, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(8, -6); ctx.lineTo(-2, 8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a3f2e';
      for (const bx of [-12, 2, 16]) { ctx.beginPath(); ctx.ellipse(bx, 18, 3.5, 6, 0, 0, 7); ctx.fill(); }
      break;
    case 'vortex':
      ctx.strokeStyle = '#9a5aff'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) { const r = 2 + a * 1.9; a ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); }
      ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.stroke();
      break;
  }
  ctx.restore();
}
