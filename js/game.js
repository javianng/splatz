// Core gameplay: spawning, input (multi-touch grab & flick, drag specials out
// of their slots), damage, combos, level modifiers, win/lose.
import { Zombie, P } from './zombie.js';
import { FX } from './fx.js';
import { ZOMBIES, SPECIALS, MAPS, DIFFS, GROUND_Y, WORLD_H, levelSpec, TOTAL_LEVELS } from './data.js';
import { drawStatic, drawAnimated, drawBuilding, drawFence, drawFog, HOUSE_HW } from './scenes.js';
import { Crate, Grenade, Molotov, FirePool, Boulder, Meteor, Mine, Anvil, Airstrike, Bolt, Vortex, drawAimPreview } from './specials.js';
import { sfx } from './audio.js';
import { store } from './save.js';

export const STEP = 1 / 120;
const PICK_R = 85;
const MAX_THROW = 3400;
const HUD_ZONE = 110; // world px below the top edge that count as "back in the slot bar"

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.fx = new FX();
    this.W = 1280;
    this.topY = 0;
    this.scene = 'farm';
    this.building = 'farmhouse';
    this.staticCache = null;
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.acc = 0;
    this.zombies = [];
    this.objects = [];
    this.crates = [];
    this.pointers = new Map();
    this.chains = new Map();
    this.chainSeq = 1;
    this.blast = 1;
    this.houseHp = this.houseMax = 100;
  }

  get centerX() { return this.W / 2; }
  get walls() { return [0, this.W]; }

  // ---------- setup ----------
  resize(W, topY, pixelW, pixelH, scale) {
    this.W = W; this.topY = topY;
    this.view = { scale, pixelW, pixelH };
    this.buildCache();
  }

  buildCache() {
    if (!this.view) return;
    const { pixelW, pixelH, scale } = this.view;
    const c = this.staticCache || document.createElement('canvas');
    c.width = pixelW; c.height = pixelH;
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, -this.topY * scale);
    drawStatic(g, this.scene, this.W, this.topY);
    this.staticCache = c;
  }

  setScene(scene, building) {
    this.building = building;
    if (this.scene === scene && this.staticCache) return;
    this.scene = scene;
    this.buildCache();
  }

  // opts: { mode: 'campaign'|'endless', map, day, diff, loadout }
  start(opts) {
    this.opts = opts;
    this.mode = opts.mode;
    const map = MAPS[opts.map];
    this.map = map;
    this.diff = DIFFS[opts.diff ?? 1];
    if (this.mode === 'campaign') this.cfg = levelSpec(opts.map, opts.day);
    else this.cfg = { scene: map.scene, building: map.building, crates: true, mix: endlessMix(opts.map), mod: null, name: 'Endless Siege' };
    this.setScene(this.cfg.scene, this.cfg.building);

    this.zombies = []; this.objects = []; this.crates = [];
    this.pointers.clear(); this.chains.clear();
    this.fx.clear();
    this.time = 0; this.acc = 0;
    this.starsEarned = 0;
    this.killed = 0;
    this.spawned = 0;
    this.hurt = 0;
    this.over = false;
    this.endTimer = 0;
    this.firstKill = false;
    this.freezeFlash = 0;
    this.bestCombo = 0;

    this.houseMax = 150 * (1 + 0.25 * store.level('armor'));
    this.houseHp = this.houseMax;
    const fl = store.level('fence');
    const fMax = fl ? 25 + fl * 20 : 0;
    this.fences = { L: { hp: fMax, max: fMax }, R: { hp: fMax, max: fMax } };
    this.armMult = 1 + 0.3 * store.level('arm');
    this.blast = 1 + 0.2 * store.level('blast');

    this.slots = new Array(2 + store.level('slots')).fill(null);
    const unlocked = Object.keys(SPECIALS).filter((k) => SPECIALS[k].unlock <= store.get().unlocked);
    this.loadout = (opts.loadout && opts.loadout.length ? opts.loadout : unlocked).filter((k) => unlocked.includes(k));
    if (store.level('starter') && this.loadout.length) this.slots[0] = this.pick(this.loadout);
    if (this.cfg.mod === 'nograb') this.slots.forEach((_, i) => { if (!this.slots[i] && this.loadout.length) this.slots[i] = this.pick(this.loadout); });

    if (this.mode === 'campaign') {
      this.queue = this.buildQueue(this.cfg);
      this.total = this.cfg.mod === 'timer' ? Infinity : this.queue.length;
    } else {
      this.queue = null;
      this.total = Infinity;
    }
    this.spawnTimer = 1.2;
    this.crateTimer = this.nextCrateTime() * 0.5;
    this.lastSide = 1;
    this.running = true;
    this.paused = false;

    let title, sub = '';
    if (this.mode === 'endless') { title = 'Endless Siege'; sub = `${map.name} · ${this.diff.name}`; }
    else {
      title = this.cfg.name;
      sub = this.cfg.mod === 'timer' ? `Survive ${this.cfg.time} seconds` :
        this.cfg.mod ? (this.cfg.mod === 'boss' ? 'Something BIG is coming…' : MODS_TEXT[this.cfg.mod]) :
        (this.cfg.idx === 0 ? 'Grab a zombie and flick it up!' : `${map.name} · Level ${this.cfg.day + 1}`);
    }
    this.ui.banner(title, sub, 2400);
    this.pushHud(true);
  }

  buildQueue(cfg) {
    const q = [];
    const entries = Object.entries(cfg.mix);
    const sum = entries.reduce((a, [, w]) => a + w, 0);
    const count = Math.round(cfg.count * this.diff.count);
    for (let i = 0; i < count; i++) {
      let r = Math.random() * sum;
      for (const [k, w] of entries) { if ((r -= w) <= 0) { q.push({ type: k }); break; } }
    }
    for (let i = 0; i < Math.min(3, q.length); i++) q[i] = { type: cfg.mix.walker ? 'walker' : entries[0][0] };
    if (cfg.boss) q.push({ type: 'giant', boss: true });
    return q;
  }

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  nextCrateTime() {
    const base = this.cfg.mod === 'nograb' ? 3 + Math.random() * 2.5 : 8 + Math.random() * 6;
    return base / (1 + 0.3 * store.level('luck'));
  }

  // ---------- main update ----------
  update(frameDt) {
    if (!this.running || this.paused) return;
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= STEP) {
      this.tick(STEP);
      this.acc -= STEP;
    }
  }

  tick(dt) {
    this.time += dt;
    this.hurt = Math.max(0, this.hurt - dt * 2);
    this.freezeFlash = Math.max(0, this.freezeFlash - dt);
    if (!this.over) this.spawnLogic(dt);

    for (const z of this.zombies) {
      const hit = z.step(dt, this);
      if (hit && hit.impact > 0 && z.state === 'ragdoll') this.onImpact(z, hit);
      if (z.alive && z.state === 'attack') this.onAttack(z, dt);
      if (z.alive && z.state === 'walk' && Math.random() < dt * 0.08) sfx.groan();
      if (z.burn > 0) {
        z.burn -= dt;
        if (z.alive) this.damage(z, 0.5 * this.blast * dt, { x: z.pelvis.x, y: z.pelvis.y, cause: 'fire', quiet: true });
        if (Math.random() < 0.35) {
          const p = z.pts[Math.floor(Math.random() * 11)];
          this.fx.add({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 40, vy: -90, r: 5 + Math.random() * 6, color: Math.random() < 0.5 ? '#ffc928' : '#ff7a2a', life: 0.35, kind: 'fire', grow: 12 });
        }
      }
    }
    this.zombieCollisions(dt);
    this.zombies = this.zombies.filter((z) => z.alpha > 0);
    let dead = 0;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (!z.alive && ++dead > 28 && !z.grab && z.deadTime < 9) z.deadTime = 9;
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (o.update(dt, this)) { this.objects.splice(i, 1); this.releasePointerFor(o); }
    }
    for (let i = this.crates.length - 1; i >= 0; i--) if (this.crates[i].update(dt, this)) this.crates.splice(i, 1);
    this.fx.update(dt);

    if (!this.over) {
      if (this.houseHp <= 0) this.finish(false);
      else if (this.mode === 'campaign') {
        if (this.cfg.mod === 'timer') {
          if (this.time >= this.cfg.time) this.finish(true);
        } else if (this.spawned >= this.total && !this.zombies.some((z) => z.alive)) {
          this.endTimer += dt;
          if (this.endTimer > 1.2) this.finish(true);
        }
      }
    }
    if (Math.floor(this.time * 10) !== Math.floor((this.time - dt) * 10)) this.pushHud();
  }

  spawnLogic(dt) {
    if (this.cfg.crates && this.loadout.length) {
      this.crateTimer -= dt;
      if (this.crateTimer <= 0) {
        this.crateTimer = this.nextCrateTime();
        const x = this.centerX + (Math.random() < 0.5 ? -1 : 1) * (HOUSE_HW + 60 + Math.random() * (this.W / 2 - HOUSE_HW - 140));
        this.crates.push(new Crate(x, this.topY, this.pick(this.loadout)));
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const alive = this.zombies.reduce((n, z) => n + (z.alive ? 1 : 0), 0);
    if (alive >= this.diff.cap) { this.spawnTimer = 0.3; return; }

    let entry;
    const d = this.diff;
    if (this.mode === 'campaign') {
      const timer = this.cfg.mod === 'timer';
      if (!timer && this.spawned >= this.total) return;
      if (timer && this.time > this.cfg.time - 3) return;
      entry = timer ? this.randomEntry(this.cfg.mix) : this.queue[this.spawned];
      const [a, b] = this.cfg.gap;
      const k = 1 / Math.sqrt(d.count) * (timer ? 0.85 : 1);
      this.spawnTimer = Math.random() < (this.cfg.burst || 0) ? 0.25 + Math.random() * 0.3 : (a + Math.random() * (b - a)) * k;
    } else {
      const m = this.time / 60;
      const mix = { ...this.cfg.mix };
      if (this.time < 20) for (const k of Object.keys(mix)) if (k !== 'walker') delete mix[k];
      if (this.time < 90) delete mix.giant;
      entry = this.randomEntry(Object.keys(mix).length ? mix : { walker: 1 });
      this.spawnTimer = Math.random() < 0.3 ? 0.3 : Math.max(0.3, 1.6 - m * 0.35) * (0.7 + Math.random() * 0.6) / Math.sqrt(d.count);
    }
    let side;
    if (this.mode === 'campaign' && this.cfg.idx === 0 && this.spawned < 4) side = -1;
    else side = Math.random() < (this.lastSide < 0 ? 0.62 : 0.38) ? 1 : -1;
    this.lastSide = side;
    const x = side < 0 ? -50 : this.W + 50;
    const def = ZOMBIES[entry.type];
    const opts = entry.boss ? { scale: 2.3, hp: this.cfg.bossHp * d.hp, mass: 6, boss: true } : { hp: def.hp * d.hp };
    const z = new Zombie(entry.type, x, -side, opts);
    z.speed *= d.speed;
    if (entry.boss) z.speed = 18 * d.speed;
    this.zombies.push(z);
    this.spawned++;
    if (entry.boss) this.ui.banner('BOSS!', 'Slam it again and again', 1800);
  }

  randomEntry(mix) {
    const e = Object.entries(mix);
    let r = Math.random() * e.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of e) if ((r -= w) <= 0) return { type: k };
    return { type: e[0][0] };
  }

  stopX(z) {
    const f = z.dir > 0 ? this.fences.L : this.fences.R;
    let edge = HOUSE_HW + 6;
    if (f.hp > 0) edge = HOUSE_HW + 80 + 26;
    edge += 12 * z.s;
    return this.centerX - edge * z.dir;
  }

  onAttack(z, dt) {
    const f = z.dir > 0 ? this.fences.L : this.fences.R;
    if (z.def.dynamite) {
      z.kill();
      z.alpha = 0;
      this.explode(z.pelvis.x, z.pelvis.y, 160, 2, { noStars: true });
      if (f.hp > 0) f.hp = Math.max(0, f.hp - f.max * 0.8);
      else this.damageHouse(14 * this.diff.dmg);
      return;
    }
    z.attackCd -= dt;
    if (z.attackCd > 0) return;
    z.attackCd = 0.5;
    const dmg = z.def.dps * 0.5 * (z.boss ? 3 : 1) * this.diff.dmg;
    if (f.hp > 0) {
      f.hp = Math.max(0, f.hp - dmg);
      if (Math.random() < 0.4) sfx.thud(0.2);
      if (f.hp <= 0) { this.fx.dust(this.centerX - (HOUSE_HW + 80) * z.dir, 8); sfx.boom(); }
    } else this.damageHouse(dmg);
  }

  damageHouse(amt) {
    this.houseHp = Math.max(0, this.houseHp - amt);
    this.hurt = Math.min(1, this.hurt + 0.35);
    sfx.hurt();
  }

  onImpact(z, hit) {
    const thr = 650 - 40 * store.level('arm');
    if (z.frozen > 0) {
      if (hit.impact > 260) this.damage(z, 99, { x: z.pelvis.x, y: z.pelvis.y, cause: 'shatter' });
      return;
    }
    if (hit.impact < thr * 0.6 || z.hitCooldown > 0) return;
    const p = z.pts[hit.impactIdx];
    z.hitCooldown = 0.18;
    const power = Math.min(1, (hit.impact - thr * 0.6) / 1400);
    sfx.thud(power);
    if (hit.impact < thr) { this.fx.dust(p.x, 2); return; }
    let dmg = ((hit.impact - thr) / 1050) * this.armMult;
    if (hit.impactIdx === P.HEAD) dmg *= z.def.helmet ? 0.45 : 1.3;
    if (z.def.sturdy) dmg *= 0.8;
    this.fx.spray(p.x, p.y, 0, 0, 4 + Math.floor(power * 8));
    this.fx.shake = Math.max(this.fx.shake, power * 8);
    if (power > 0.5) buzz(15);
    this.damage(z, dmg, { x: p.x, y: p.y, cause: 'slam' });
    if (z.alive && dmg > 0.3) this.fx.decal(p.x, 0.6);
  }

  zombieCollisions(dt) {
    for (const a of this.zombies) {
      if (a.state !== 'ragdoll' && a.state !== 'dead') continue;
      if (a.alpha < 0.3 || a.hitCooldown > 0) continue;
      let fp = null, v = 0;
      for (const p of a.pts) {
        const sp = Math.hypot(p.vx, p.vy) / dt;
        if (sp > v) { v = sp; fp = p; }
      }
      if (v < (a.alive ? 650 : 900)) continue;
      const ba = a.alive ? a.bounds() : { x0: fp.x - fp.r, x1: fp.x + fp.r, y0: fp.y - fp.r, y1: fp.y + fp.r };
      for (const b of this.zombies) {
        if (b === a || !b.alive || b.state === 'ragdoll' || b.hitCooldown > 0) continue;
        const bb = b.bounds();
        if (ba.x1 < bb.x0 - 6 || ba.x0 > bb.x1 + 6 || ba.y1 < bb.y0 - 30 || ba.y0 > bb.y1) continue;
        const sturdy = b.def.sturdy;
        const vx = fp.vx / dt, vy = fp.vy / dt;
        b.hitCooldown = 0.25;
        const part = a.alive ? 1 : 0.6;
        if (sturdy && v < 1400) {
          this.damage(b, (v / 4000) * part, { x: fp.x, y: fp.y, cause: 'bowl' });
          sfx.thud(0.3);
        } else {
          b.push(vx * 0.7 * part, Math.min(vy * 0.5, 0) - 450 * part, dt);
          b.thrownBy = a.thrownBy || this.newChain();
          a.thrownBy = b.thrownBy;
          this.damage(b, (v / 2600) * (sturdy ? 0.5 : 1) * part * this.armMult, { x: b.pelvis.x, y: b.pelvis.y, cause: 'bowl' });
          sfx.thud(0.7);
        }
        for (const p of a.pts) p.setVel(p.vx * 0.7, p.vy * 0.7);
        a.hitCooldown = 0.08;
        this.fx.spray(b.pelvis.x, b.pelvis.y, vx, vy, 6);
      }
    }
  }

  newChain() {
    const id = this.chainSeq++;
    this.chains.set(id, { count: 0 });
    return id;
  }

  damage(z, amt, info = {}) {
    if (!z.alive) return;
    z.hp -= amt;
    if (!info.quiet) z.flash = 0.15;
    z.barShow = 2.5;
    if (z.hp <= 0) this.killZombie(z, info);
  }

  killZombie(z, info) {
    const wasFrozen = z.frozen > 0;
    const hx = z.head.x, hy = z.head.y;
    z.kill();
    this.killed++;
    this.firstKill = true;
    if (wasFrozen) {
      this.fx.iceBurst(z.pelvis.x, z.pelvis.y - 30);
      sfx.shatter();
      z.alpha = 0;
    } else {
      this.fx.splat(hx, hy, z.boss ? 2.8 : z.big ? 2 : (info.crush ? 1.6 : 1));
      sfx.splat(1);
      if (z.lostHead) z.head.setVel(z.head.vx + (Math.random() - 0.5) * 6, z.head.vy - 8);
    }
    let mult = 1;
    if (z.thrownBy && this.chains.has(z.thrownBy)) {
      const ch = this.chains.get(z.thrownBy);
      ch.count++;
      mult = ch.count;
      this.bestCombo = Math.max(this.bestCombo, ch.count);
      if (ch.count >= 2) this.fx.text(hx, hy - 70, `COMBO x${ch.count}`, { color: '#ffc928', size: 30 });
    }
    if (!info.noStars) {
      const stars = Math.round(z.def.stars * mult * (z.boss ? 6 : 1));
      this.starsEarned += stars;
      this.fx.text(hx, hy - 30, `+${stars}★`, { color: '#fff', size: 24 });
      sfx.star();
    }
    if (z.def.dynamite) setTimeout(() => { if (this.running) this.explode(z.pelvis.x, z.pelvis.y, 170, 2.5); }, 60);
    if (z.def.gas) setTimeout(() => { if (this.running) this.gasBurst(z.pelvis.x, z.pelvis.y); }, 40);
    this.pushHud();
  }

  explode(x, y, radius, power, opts = {}) {
    radius *= this.blast; power *= this.blast;
    sfx.boom();
    buzz(30);
    this.fx.explosion(x, y, radius);
    const chain = this.newChain();
    for (const z of this.zombies) {
      let best = Infinity;
      for (const p of z.pts) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
      if (best > radius * 1.3) continue;
      const k = Math.max(0, 1 - best / (radius * 1.3));
      const c = z.pelvis;
      const ang = Math.atan2(c.y - y - 40, c.x - x);
      const force = 1800 * k * (power / 3 + 0.5);
      if (z.alive) z.thrownBy = chain;
      z.push(Math.cos(ang) * force, Math.sin(ang) * force - 900 * k, STEP);
      if (z.alive) this.damage(z, power * k * 1.5 + (best < radius * 0.55 ? 2.5 : 0), { x: c.x, y: c.y, cause: 'explosion', noStars: opts.noStars });
    }
    for (const o of this.objects) if (o instanceof Grenade && !(o instanceof Molotov) && Math.hypot(o.x - x, o.y - y) < radius) o.fuse = Math.min(o.fuse, 0.1);
  }

  // Bloaters burst into a cloud that hurts nearby zombies (not you).
  gasBurst(x, y) {
    sfx.gas();
    this.fx.gas(x, y);
    const chain = this.newChain();
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(z.pelvis.x - x, z.pelvis.y - y);
      if (d > 170) continue;
      z.thrownBy = chain;
      z.push(Math.sign(z.pelvis.x - x || 1) * 700, -500, STEP);
      this.damage(z, 2.2 * (1 - d / 220), { x: z.pelvis.x, y: z.pelvis.y, cause: 'gas' });
    }
  }

  lightning(x, y) {
    const pool = this.zombies.filter((z) => z.alive);
    let cur = null, bd = 260;
    for (const z of pool) { const d = Math.hypot(z.head.x - x, z.head.y - y); if (d < bd) { bd = d; cur = z; } }
    const segs = [];
    const top = [x + (Math.random() - 0.5) * 80, Math.max(this.topY, -250)];
    if (!cur) segs.push([top, [x, GROUND_Y]]);
    let from = top;
    const targets = [];
    const chain = this.newChain();
    while (cur && targets.length < 6) {
      targets.push(cur);
      const to = [cur.head.x, cur.head.y];
      segs.push([from, to]);
      from = to;
      let next = null, nd = 240;
      for (const z of pool) {
        if (targets.includes(z)) continue;
        const d = Math.hypot(z.head.x - to[0], z.head.y - to[1]);
        if (d < nd) { nd = d; next = z; }
      }
      cur = next;
    }
    this.objects.push(new Bolt(segs));
    sfx.zap();
    buzz(40);
    this.fx.flashes.push({ x, y: (this.topY + GROUND_Y) / 2, r: this.W, t: 0.12, max: 0.12, color: '220,235,255' });
    targets.forEach((z, i) => {
      z.thrownBy = chain;
      z.push((Math.random() - 0.5) * 400, -900, STEP);
      z.burn = Math.max(z.burn || 0, 0.8);
      this.damage(z, (3.2 - i * 0.25) * this.blast, { x: z.head.x, y: z.head.y, cause: 'lightning' });
    });
  }

  freezeAll() {
    sfx.freeze();
    this.freezeFlash = 0.5;
    for (const z of this.zombies) if (z.alive && z.pelvis.x > 0 && z.pelvis.x < this.W && !z.def.frostImmune) z.freeze(5);
    if (this.zombies.some((z) => z.alive && z.def.frostImmune)) this.fx.text(this.centerX, GROUND_Y - 300, 'Frostbites are immune!', { color: '#bfe9ff', size: 24 });
  }

  fireSpecial(kind, x, y) {
    switch (kind) {
      case 'freeze': this.freezeAll(); break;
      case 'boulder': this.objects.push(new Boulder(x < this.centerX, this)); break;
      case 'landmine': this.objects.push(new Mine(clamp(x, 40, this.W - 40))); break;
      case 'anvil': this.objects.push(new Anvil(clamp(x, 60, this.W - 60), this)); break;
      case 'meteor': this.objects.push(new Meteor(x, this)); break;
      case 'airstrike': this.objects.push(new Airstrike(x, this)); break;
      case 'lightning': this.lightning(x, y); break;
      case 'vortex': this.objects.push(new Vortex(x, y)); break;
    }
  }

  finish(won) {
    this.over = true;
    this.running = false;
    this.cancelPointers();
    const s = store.get();
    const out = { won, mode: this.mode, map: this.opts.map, day: this.opts.day, diff: this.opts.diff, kills: this.killed, stars: Math.round(this.starsEarned * this.diff.stars), bestCombo: this.bestCombo };
    let bonus = 0;
    if (this.mode === 'campaign' && won) {
      const idx = this.cfg.idx;
      out.perfect = this.houseHp >= this.houseMax;
      bonus = Math.round((60 + idx * 15 + (out.perfect ? 100 : 0)) * this.diff.stars);
      const medals = { ...s.medals };
      out.newMedal = (medals[idx] ?? -1) < this.opts.diff;
      medals[idx] = Math.max(medals[idx] ?? -1, this.opts.diff);
      const unlocked = Math.min(TOTAL_LEVELS - 1, Math.max(s.unlocked, idx + 1));
      out.unlocks = Object.entries(SPECIALS).filter(([, v]) => v.unlock > s.unlocked && v.unlock <= unlocked).map(([k, v]) => ({ kind: k, name: v.name }));
      out.newMap = unlocked > s.unlocked && unlocked % 6 === 0 && idx + 1 === unlocked ? MAPS[unlocked / 6]?.name : null;
      out.finale = idx === TOTAL_LEVELS - 1;
      store.set({ medals, unlocked });
    }
    if (this.mode === 'endless') {
      const best = { ...s.bestEndless };
      out.best = Math.max(best[this.map.id] || 0, this.killed);
      out.newBest = this.killed > (best[this.map.id] || 0);
      best[this.map.id] = out.best;
      store.set({ bestEndless: best });
    }
    out.bonus = bonus;
    store.set({ stars: store.get().stars + out.stars + bonus });
    won ? sfx.win() : sfx.lose();
    setTimeout(() => this.ui.result(out), won ? 600 : 1200);
  }

  // ---------- slots ----------
  // Pointer pressed on a slot: tap specials fire now, others get dragged out.
  slotDown(i, id, x, y, t) {
    if (!this.running || this.paused) return;
    const kind = this.slots[i];
    if (!kind) return;
    const use = SPECIALS[kind].use;
    if (use === 'tap') {
      this.slots[i] = null;
      sfx.click();
      this.fireSpecial(kind, x, y);
      this.pushHud();
      return;
    }
    sfx.grab();
    this.slots[i] = null;
    const entry = { slot: i, kind, sx: x, sy: y, hist: [{ x, y, t }], moved: 0 };
    if (use === 'throw') {
      const o = kind === 'molotov' ? new Molotov(x, y) : new Grenade(x, y);
      o.grab = { pointerId: id, tx: x, ty: y };
      this.objects.push(o);
      entry.target = o;
      entry.type = 'object';
    } else {
      entry.type = 'aim';
      entry.target = { x, y, grab: { tx: x, ty: y } };
    }
    this.pointers.set(id, entry);
    this.pushHud();
  }

  // Keyboard shortcut: throw/aim at the zombie closest to the building.
  useSlotAuto(i) {
    if (!this.running || this.paused) return;
    const kind = this.slots[i];
    if (!kind) return;
    let tz = null, bd = Infinity;
    for (const z of this.zombies) if (z.alive) { const d = Math.abs(z.pelvis.x - this.centerX); if (d < bd) { bd = d; tz = z; } }
    const tx = tz ? tz.pelvis.x : this.centerX + (Math.random() < 0.5 ? -400 : 400);
    const ty = tz ? tz.head.y : GROUND_Y - 100;
    this.slots[i] = null;
    if (SPECIALS[kind].use === 'throw') {
      const o = kind === 'molotov' ? new Molotov(this.centerX, GROUND_Y - 360) : new Grenade(this.centerX, GROUND_Y - 360);
      o.thrown = true;
      const T = 0.9, vx = (tx - o.x) / T, vy = (GROUND_Y - 20 - o.y - 0.5 * 2600 * T * T) / T;
      o.px = o.x - vx * STEP; o.py = o.y - vy * STEP;
      this.objects.push(o);
    } else this.fireSpecial(kind, tx, ty);
    sfx.click();
    this.pushHud();
  }

  releasePointerFor(o) {
    for (const [id, p] of this.pointers) if (p.target === o) this.pointers.delete(id);
  }

  // ---------- input ----------
  pointerDown(id, x, y, t) {
    if (!this.running || this.paused) return;
    for (let i = 0; i < this.crates.length; i++) {
      const c = this.crates[i];
      if (c.hit(x, y)) {
        const slot = this.slots.indexOf(null);
        if (slot >= 0) {
          this.slots[slot] = c.kind;
          this.crates.splice(i, 1);
          sfx.pickup();
          this.fx.text(c.x, c.y - 40, SPECIALS[c.kind].name + '!', { color: '#ffc928', size: 22 });
          this.pushHud();
        } else this.fx.text(c.x, c.y - 40, 'Slots full', { color: '#fff', size: 18 });
        return;
      }
    }
    for (const o of this.objects) {
      if (o instanceof Grenade && !o.grab && o.hit(x, y)) {
        o.grab = { pointerId: id, tx: x, ty: y };
        this.pointers.set(id, { target: o, type: 'object', hist: [{ x, y, t }] });
        return;
      }
    }
    const noGrab = this.cfg.mod === 'nograb';
    let best = null;
    for (const z of this.zombies) {
      if (z.grab || z.alpha < 0.3) continue;
      if (noGrab && z.alive) continue;
      const n = z.nearest(x, y);
      const reach = PICK_R + (z.s - 1) * 30 + (z.alive ? 0 : -20);
      const score = n.dist - (z.alive ? 15 : 0);
      if (n.dist < reach && (!best || score < best.score)) best = { z, idx: n.idx, score };
    }
    if (best) {
      const z = best.z;
      if (z.alive && z.state !== 'ragdoll') z.toRagdoll();
      z.grab = { idx: best.idx, pointerId: id, tx: x, ty: y };
      z.thrownBy = 0;
      if (!z.alive) z.deadTime = Math.min(z.deadTime, 2);
      this.pointers.set(id, { target: z, type: 'zombie', hist: [{ x, y, t }] });
      sfx.grab();
    } else if (noGrab && this.zombies.some((z) => z.alive && z.nearest(x, y).dist < PICK_R)) {
      this.fx.text(x, y - 30, 'Hands off! Use specials', { color: '#fff', size: 18, life: 0.8 });
    }
  }

  pointerMove(id, x, y, t) {
    const p = this.pointers.get(id);
    if (!p) return;
    if (!p.target.grab) { this.pointers.delete(id); return; }
    p.target.grab.tx = x;
    p.target.grab.ty = y;
    if (p.type === 'aim') { p.target.x = x; p.target.y = y; }
    if (p.sx != null) p.moved = Math.max(p.moved, Math.hypot(x - p.sx, y - p.sy));
    p.hist.push({ x, y, t });
    while (p.hist.length > 2 && t - p.hist[0].t > 90) p.hist.shift();
  }

  pointerUp(id, x, y, t) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    const target = p.target;
    const fromSlot = p.slot != null;
    const backInBar = fromSlot && (p.moved < 25 || y < this.topY + HUD_ZONE);
    if (backInBar) {
      if (p.type === 'object') { const k = this.objects.indexOf(target); if (k >= 0) this.objects.splice(k, 1); }
      const slot = this.slots[p.slot] == null ? p.slot : this.slots.indexOf(null);
      if (slot >= 0) this.slots[slot] = p.kind;
      if (p.moved < 25) this.ui.banner(SPECIALS[p.kind].use === 'throw' ? 'Drag it out and throw!' : 'Drag it onto the field', '', 900);
      this.pushHud();
      return;
    }
    if (p.type === 'aim') {
      this.fireSpecial(p.kind, x, y);
      return;
    }
    const heldIdx = target.grab ? target.grab.idx : -1;
    target.grab = null;
    const h = p.hist;
    let vx = 0, vy = 0;
    if (h.length >= 2) {
      const a = h[0], b = h[h.length - 1];
      const dt = Math.max(16, b.t - a.t) / 1000;
      if (t - b.t < 120) { vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
    }
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_THROW) { vx *= MAX_THROW / sp; vy *= MAX_THROW / sp; }
    if (p.type === 'object') {
      target.px = target.x - vx * STEP;
      target.py = target.y - vy * STEP;
      target.thrown = true;
      if (sp > 600) sfx.whoosh();
      return;
    }
    const z = target;
    const k = z.alive ? 1 / Math.max(1, z.mass * 0.6) : 1;
    const piece = z.alive ? null : z.group(heldIdx);
    z.pts.forEach((pt, i) => {
      if (piece && !piece.has(i)) return;
      const f = (i === heldIdx ? 1 : 0.85) * k;
      pt.setVel(vx * STEP * f + pt.vx * 0.2, vy * STEP * f + pt.vy * 0.2);
    });
    if (sp > 900) { sfx.whoosh(); z.thrownBy = this.newChain(); z.hitCooldown = 0; }
  }

  cancelPointers() {
    for (const [, p] of this.pointers) {
      if (p.slot != null) {
        if (p.type === 'object') { const k = this.objects.indexOf(p.target); if (k >= 0) this.objects.splice(k, 1); }
        const slot = this.slots[p.slot] == null ? p.slot : this.slots.indexOf(null);
        if (slot >= 0) this.slots[slot] = p.kind;
      } else if (p.target.grab) p.target.grab = null;
    }
    this.pointers.clear();
    if (this.slots) this.pushHud();
  }

  // ---------- HUD ----------
  pushHud(force) {
    if (!this.cfg) return;
    let wave, label = '';
    if (this.mode === 'campaign') {
      if (this.cfg.mod === 'timer') {
        wave = this.time / this.cfg.time;
        label = `${Math.max(0, Math.ceil(this.cfg.time - this.time))}s left`;
      } else wave = this.killed / this.total;
    } else wave = Math.min(1, this.time / 180);
    this.ui.hud({
      stars: Math.round(this.starsEarned * this.diff.stars),
      hp: this.houseHp / this.houseMax,
      wave, label,
      slots: this.slots,
      kills: this.killed,
      endless: this.mode === 'endless',
      force
    });
  }

  // ---------- drawing ----------
  draw(ctx) {
    const v = this.view;
    if (!v) return;
    const sx = (Math.random() - 0.5) * this.fx.shake * v.scale * 0.5;
    const sy = (Math.random() - 0.5) * this.fx.shake * v.scale * 0.5;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.staticCache) ctx.drawImage(this.staticCache, sx, sy);
    ctx.setTransform(v.scale, 0, 0, v.scale, sx, -this.topY * v.scale + sy);
    const now = performance.now() / 1000;

    drawAnimated(ctx, this.scene, this.W, this.topY, now);
    drawBuilding(ctx, this.building, this.centerX, this.houseHp / (this.houseMax || 1), now, this.hurt);
    this.fx.drawDecals(ctx);
    if (this.fences) {
      const fx = HOUSE_HW + 80;
      drawFence(ctx, this.centerX - fx, this.fences.L.max ? this.fences.L.hp / this.fences.L.max : 0, this.scene, 1);
      drawFence(ctx, this.centerX + fx, this.fences.R.max ? this.fences.R.hp / this.fences.R.max : 0, this.scene, -1);
    }
    const ground = (o) => o instanceof Mine || o instanceof FirePool;
    for (const o of this.objects) if (ground(o)) o.draw(ctx);
    for (const c of this.crates) c.draw(ctx);
    const order = this.zombies.slice().sort((a, b) => rank(a) - rank(b));
    for (const z of order) z.draw(ctx);
    for (const o of this.objects) if (!ground(o)) o.draw(ctx);
    this.fx.drawParts(ctx);
    if (this.cfg && (this.cfg.mod === 'fog' || this.scene === 'grave')) drawFog(ctx, this.W, this.topY, now, this.cfg.mod === 'fog' ? 1 : 0.35, this.scene);
    for (const z of order) z.drawBar(ctx);
    this.fx.drawTexts(ctx);

    for (const [, p] of this.pointers) if (p.type === 'aim') drawAimPreview(ctx, p.kind, p.target.x, p.target.y, this, now);

    if (this.running && this.mode === 'campaign' && this.cfg.idx === 0 && !this.firstKill) {
      const z = this.zombies.find((q) => q.alive && q.pelvis.x > 40 && q.pelvis.x < this.W - 40);
      if (z) hint(ctx, z.head.x, z.head.y - 60, this.time);
    }
    if (this.freezeFlash > 0) {
      ctx.fillStyle = `rgba(190,235,255,${this.freezeFlash})`;
      ctx.fillRect(0, this.topY, this.W, WORLD_H - this.topY);
    }
    if (this.hurt > 0.05) {
      const g = ctx.createRadialGradient(this.centerX, 360, 200, this.centerX, 360, this.W * 0.7);
      g.addColorStop(0, 'rgba(200,30,30,0)');
      g.addColorStop(1, `rgba(200,30,30,${this.hurt * 0.35})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, this.topY, this.W, WORLD_H - this.topY);
    }
  }
}

const MODS_TEXT = {
  rush: 'Stampede! Runners incoming',
  nograb: 'Hands off: specials only',
  fog: 'Thick fog tonight',
  giants: 'Giants are coming'
};

// Endless mixes draw from the map's whole roster.
function endlessMix(mapIdx) {
  const mix = {};
  for (const [, m] of MAPS[mapIdx].levels) for (const [k, w] of Object.entries(m)) mix[k] = Math.max(mix[k] || 0, w);
  mix.giant = Math.min(mix.giant || 0.3, 0.6);
  return mix;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function buzz(ms) { try { if (navigator.vibrate && store.get().sound) navigator.vibrate(ms); } catch (_) {} }

function rank(z) {
  if (!z.alive) return 0;
  if (z.grab) return 3;
  if (z.state === 'ragdoll') return 2;
  return 1;
}

function hint(ctx, x, y, t) {
  const b = Math.sin(t * 6) * 8;
  ctx.save();
  ctx.translate(x, y + b);
  ctx.fillStyle = '#ffc928';
  ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 26); ctx.lineTo(-18, 4); ctx.lineTo(-7, 4); ctx.lineTo(-7, -22); ctx.lineTo(7, -22); ctx.lineTo(7, 4); ctx.lineTo(18, 4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.font = '900 20px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText('Grab & flick!', 0, -38);
  ctx.fillStyle = '#fff';
  ctx.fillText('Grab & flick!', 0, -38);
  ctx.restore();
}
