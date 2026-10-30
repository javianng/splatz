// Zombies: a procedurally animated walker that turns into a Verlet ragdoll
// when grabbed, slammed, blown up or bowled over. When killed it falls apart
// into pieces you can keep grabbing and throwing until they fade away.
import { Particle, Stick, integrate, collide } from './physics.js';
import { ZOMBIES, GROUND_Y } from './data.js';

// Skeleton point indices
const HEAD = 0, NECK = 1, PELVIS = 2, LELB = 3, LHAND = 4, RELB = 5, RHAND = 6,
  LKNEE = 7, LFOOT = 8, RKNEE = 9, RFOOT = 10;
export const P = { HEAD, NECK, PELVIS, LHAND, RHAND, LFOOT, RFOOT };

// Bone index: 0 neck, 1 spine, 2 L shoulder, 3 L forearm, 4 R shoulder,
// 5 R forearm, 6 L hip, 7 L shin, 8 R hip, 9 R shin
const BONES = [
  [HEAD, NECK], [NECK, PELVIS],
  [NECK, LELB], [LELB, LHAND], [NECK, RELB], [RELB, RHAND],
  [PELVIS, LKNEE], [LKNEE, LFOOT], [PELVIS, RKNEE], [RKNEE, RFOOT]
];
// Soft "muscle" braces keep the torso from folding into a pretzel.
const BRACES = [[HEAD, PELVIS, 0.35], [LKNEE, RKNEE, 0.05], [LELB, PELVIS, 0.04], [RELB, PELVIS, 0.04]];

const LEN = { neck: 25, torso: 54, upper: 26, fore: 26, thigh: 30, shin: 31 };
export const HEAD_R = 25;
const INK = '#1c1512';
const BLOOD = '#9c1b1d';
const BLOOD_DARK = '#5e0e10';
const ICE = { skin: '#cdeeff', skinDark: '#8cc8e8', skinLight: '#f2fbff', cloth: '#a6daf2' };

const FADE_AT = 9;      // seconds a corpse piece lingers
const FADE_FOR = 1.2;

let nextId = 1;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Zombie {
  constructor(typeKey, x, dir, opts = {}) {
    const t = ZOMBIES[typeKey];
    this.id = nextId++;
    this.type = typeKey;
    this.def = t;
    this.s = opts.scale ?? t.scale;
    this.maxHp = opts.hp ?? t.hp;
    this.hp = this.maxHp;
    this.speed = t.speed * (0.85 + Math.random() * 0.3);
    this.mass = opts.mass ?? t.mass;
    this.boss = !!opts.boss;
    this.big = this.boss || !!t.big;
    this.x = x;
    this.dir = dir;           // +1 walks right, -1 walks left
    this.phase = Math.random() * 6.28;
    this.state = 'walk';      // walk | attack | ragdoll | getup | dead
    this.grab = null;
    this.restTime = 0;
    this.getupT = 0;
    this.getupFrom = null;
    this.frozen = 0;
    this.freezeSticks = null;
    this.hitCooldown = 0;
    this.thrownBy = 0;
    this.deadTime = 0;
    this.alpha = 1;
    this.flash = 0;
    this.attackCd = 0;
    this.fuse = 0;
    this.headRot = 0;
    this.barShow = 0;
    this.burn = 0;

    // Look
    this.shirt = pick(t.shirt);
    this.pants = pick(t.pants);
    this.eyeBig = Math.random() < 0.5 ? -1 : 1;
    this.hair = Math.random() < 0.7 ? Math.floor(Math.random() * 3) : -1;
    this.wound = Math.random() < 0.45;
    this.ribs = this.big || Math.random() < 0.25;
    this.stains = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
      x: Math.random() * 1.4 - 0.7, y: 0.15 + Math.random() * 0.75, r: 0.18 + Math.random() * 0.25
    }));

    const pose = this.pose(0);
    this.pts = pose.map(([px, py], i) => new Particle(px, py, i === HEAD ? HEAD_R * this.s * 0.9 : 7 * this.s));
    this.sticks = BONES.map(([a, b]) => new Stick(this.pts[a], this.pts[b]));
    this.braces = BRACES.map(([a, b, k]) => new Stick(this.pts[a], this.pts[b], null, k));
  }

  get alive() { return this.state !== 'dead'; }
  get head() { return this.pts[HEAD]; }
  get pelvis() { return this.pts[PELVIS]; }
  get lostHead() { return this.sticks[0].broken; }

  // Procedural pose for walking / attacking. Returns [[x,y] x 11].
  pose(walkAmt = 1, attack = 0) {
    const s = this.s, d = this.dir, ph = this.phase;
    const run = this.def.runner ? 1 : 0;
    const swing = Math.sin(ph) * (0.45 + run * 0.25) * walkAmt;
    const bob = Math.abs(Math.cos(ph)) * 4 * s * walkAmt;
    const legH = (LEN.thigh + LEN.shin) * s * 0.96;
    const px = this.x, py = GROUND_Y - legH - 6 * s + bob * 0.5;
    const lean = (0.16 + run * 0.26) * d;      // hunched shamble
    const nx = px + Math.sin(lean) * LEN.torso * s;
    const ny = py - Math.cos(lean) * LEN.torso * s;
    const wob = Math.sin(ph * 0.5) * 0.14;
    const hx = nx + Math.sin(lean + wob + 0.35 * d) * LEN.neck * s;
    const hy = ny - Math.cos(lean + wob + 0.2 * d) * LEN.neck * s;

    const leg = (a) => {
      const kx = px + Math.sin(a) * LEN.thigh * s;
      const ky = py + Math.cos(a) * LEN.thigh * s;
      const b = a * 0.35 - Math.max(0, -a * d) * 0.6 * d;
      const fx = kx + Math.sin(b) * LEN.shin * s;
      const fy = Math.min(GROUND_Y - 7 * s, ky + Math.cos(b) * LEN.shin * s);
      return [[kx, ky], [fx, fy]];
    };
    const [lk, lf] = leg(swing);
    const [rk, rf] = leg(-swing);

    const arm = (side) => {
      const hammer = attack ? Math.sin(ph * 3 + side) * 0.9 : 0;
      const base = (1.35 + Math.sin(ph + side) * 0.12 - hammer) * d + (run ? -0.4 * d : 0);
      const ex = nx + Math.sin(base) * LEN.upper * s;
      const ey = ny - Math.cos(base) * LEN.upper * s;
      const b2 = base + (0.25 + hammer * 0.6) * d;
      return [[ex, ey], [ex + Math.sin(b2) * LEN.fore * s, ey - Math.cos(b2) * LEN.fore * s]];
    };
    const [le, lh] = arm(0);
    const [re, rh] = arm(1.3);

    return [[hx, hy], [nx, ny], [px, py], le, lh, re, rh, lk, lf, rk, rf];
  }

  applyPose(pose, dt, carry = true) {
    const vx = carry ? this.speed * this.dir * dt : 0;
    for (let i = 0; i < 11; i++) {
      const p = this.pts[i];
      p.x = pose[i][0]; p.y = pose[i][1];
      p.px = p.x - vx; p.py = p.y;
    }
  }

  toRagdoll() {
    if (this.state === 'dead') return;
    this.state = 'ragdoll';
    this.restTime = 0;
  }

  freeze(seconds) {
    if (!this.alive || this.def.frostImmune) return;
    this.frozen = seconds;
    this.freezeSticks = [];
    for (let i = 0; i < 11; i++)
      for (let j = i + 1; j < 11; j++)
        this.freezeSticks.push(new Stick(this.pts[i], this.pts[j], null, 0.6));
  }

  thaw() { this.frozen = 0; this.freezeSticks = null; }

  push(vx, vy, dt) {
    if (this.state !== 'dead') this.toRagdoll();
    const k = 1 / Math.max(1, this.mass * 0.7);
    for (const p of this.pts) {
      const j = 0.8 + Math.random() * 0.4;
      p.setVel(p.vx + vx * dt * k * j, p.vy + vy * dt * k * j);
    }
  }

  // Indices connected to idx through unbroken bones (one body piece).
  group(idx) {
    const seen = new Set([idx]);
    const stack = [idx];
    while (stack.length) {
      const i = stack.pop();
      BONES.forEach(([a, b], k) => {
        if (this.sticks[k].broken) return;
        const o = a === i ? b : b === i ? a : -1;
        if (o >= 0 && !seen.has(o)) { seen.add(o); stack.push(o); }
      });
    }
    return seen;
  }

  // Break a bone; braces that now join separate pieces break too.
  detach(bone) {
    const st = this.sticks[bone];
    if (st.broken) return;
    st.broken = true;
    const g = this.group(BONES[bone][1]);
    BRACES.forEach(([a, b], k) => { if (g.has(a) !== g.has(b)) this.braces[k].broken = true; });
    // fling the loose piece a little
    for (const i of g) {
      const p = this.pts[i];
      p.setVel(p.vx + (Math.random() - 0.5) * 6, p.vy - 3 - Math.random() * 5);
    }
  }

  step(dt, world) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.barShow > 0) this.barShow -= dt;
    this.fuse += dt;
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) this.thaw();
    }

    if (this.state === 'walk' || this.state === 'attack') {
      if (this.frozen <= 0) {
        const target = world.stopX(this);
        const dist = (target - this.x) * this.dir;
        if (dist > 1) {
          this.state = 'walk';
          this.x += Math.min(dist, this.speed * dt) * this.dir;
          this.phase += dt * this.speed * (this.def.runner ? 0.11 : 0.085) / Math.sqrt(this.s);
        } else {
          this.state = 'attack';
          this.phase += dt * 3;
        }
        this.applyPose(this.pose(1, this.state === 'attack' ? 1 : 0), dt, this.state === 'walk');
      }
      return null;
    }

    if (this.state === 'getup') {
      this.getupT += dt / (0.45 * Math.sqrt(this.s));
      const t = Math.min(1, this.getupT);
      const e = t * t * (3 - 2 * t);
      const target = this.pose(0);
      for (let i = 0; i < 11; i++) {
        const p = this.pts[i], f = this.getupFrom[i];
        p.x = p.px = f[0] + (target[i][0] - f[0]) * e;
        p.y = p.py = f[1] + (target[i][1] - f[1]) * e;
      }
      if (t >= 1) this.state = 'walk';
      return null;
    }

    // Ragdoll / dead pieces
    integrate(this.pts, dt, this.frozen > 0 ? 0.998 : 0.993);
    const g = this.grab;
    // Heavier zombies lag behind your finger; loose body parts don't.
    const follow = this.alive ? Math.min(1, 0.9 / Math.max(1, this.mass * 0.75)) : 0.95;
    if (g) {
      const p = this.pts[g.idx];
      p.x += (g.tx - p.x) * follow;
      p.y += (g.ty - p.y) * follow;
    }
    for (let it = 0; it < 4; it++) {
      for (const st of this.sticks) st.solve();
      if (this.frozen > 0 && this.freezeSticks) for (const st of this.freezeSticks) st.solve();
      else for (const st of this.braces) st.solve();
      if (g) {
        const p = this.pts[g.idx];
        p.x += (g.tx - p.x) * follow * 0.5;
        p.y += (g.ty - p.y) * follow * 0.5;
      }
    }
    const hit = collide(this.pts, dt, { walls: world.walls, friction: this.frozen > 0 ? 0.95 : 0.78, bounce: this.frozen > 0 ? 0.4 : 0.22 });
    if (this.lostHead) this.headRot += (this.head.x - this.head.px) * 0.06;

    if (this.state === 'dead') {
      this.deadTime += dt;
      if (g) this.deadTime = Math.min(this.deadTime, 2);   // held pieces don't vanish
      if (this.deadTime > FADE_AT) this.alpha = Math.max(0, 1 - (this.deadTime - FADE_AT) / FADE_FOR);
      return hit;
    }

    // Settled on the ground? Stand back up and keep coming.
    if (!g) {
      let ke = 0;
      for (const p of this.pts) ke += Math.abs(p.vx) + Math.abs(p.vy);
      const onGround = this.pelvis.y > GROUND_Y - 60 * this.s;
      if (ke < 13 && onGround && this.frozen <= 0) this.restTime += dt;
      else this.restTime = 0;
      if (this.restTime > 0.6) this.startGetup(world);
    }
    return hit;
  }

  startGetup(world) {
    this.x = this.pelvis.x;
    this.dir = this.x < world.centerX ? 1 : -1;
    this.state = 'getup';
    this.getupT = 0;
    this.thrownBy = 0;
    this.getupFrom = this.pts.map((p) => [p.x, p.y]);
  }

  kill() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadTime = 0;
    this.thaw();
    // Fall apart: head usually pops, limbs sometimes come off.
    if (Math.random() < 0.8) this.detach(0);
    if (Math.random() < 0.5) this.detach(2);
    if (Math.random() < 0.5) this.detach(4);
    if (Math.random() < 0.3) this.detach(6);
    if (Math.random() < 0.3) this.detach(8);
  }

  nearest(x, y) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < 11; i++) {
      const p = this.pts[i];
      const d = Math.hypot(p.x - x, p.y - y) - (i === HEAD ? p.r * 0.6 : 0);
      if (d < bd) { bd = d; best = i; }
    }
    return { idx: best, dist: bd };
  }

  bounds() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of this.pts) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    return { x0, x1, y0, y1 };
  }

  // ---------- Drawing ----------
  palette() {
    if (this.frozen > 0) return { skin: ICE.skin, skinD: ICE.skinDark, skinL: ICE.skinLight, shirt: ICE.cloth, pants: ICE.skinDark };
    return { skin: this.def.skin, skinD: this.def.skinDark, skinL: this.def.skinLight, shirt: this.shirt, pants: this.pants };
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    const s = this.s, P_ = this.pts, d = this.dir, B = this.sticks.map((x) => x.broken);
    const c = this.palette();
    const frozen = this.frozen > 0;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const W = (w) => w * s;

    // soft contact shadow
    if (this.state !== 'dead' && this.pelvis.y > GROUND_Y - 120 * s) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(this.pelvis.x, GROUND_Y + 4, 30 * s, 6 * s, 0, 0, 7); ctx.fill();
    }

    const seg = (a, b, w, col, light) => {
      ctx.beginPath();
      ctx.moveTo(P_[a].x, P_[a].y); ctx.lineTo(P_[b].x, P_[b].y);
      ctx.strokeStyle = INK; ctx.lineWidth = W(w) + 5; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = W(w); ctx.stroke();
      if (light) {
        ctx.strokeStyle = light; ctx.lineWidth = W(w) * 0.28;
        ctx.beginPath();
        ctx.moveTo(P_[a].x - W(w) * 0.18, P_[a].y - W(w) * 0.18); ctx.lineTo(P_[b].x - W(w) * 0.18, P_[b].y - W(w) * 0.18);
        ctx.stroke();
      }
    };
    // bloody stub where a piece tore off; (x,y) toward (tx,ty)
    const stump = (x, y, tx, ty, w, col) => {
      const a = Math.atan2(ty - y, tx - x);
      const ex = x + Math.cos(a) * W(9), ey = y + Math.sin(a) * W(9);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
      ctx.strokeStyle = INK; ctx.lineWidth = W(w) + 5; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = W(w); ctx.stroke();
      ctx.fillStyle = BLOOD;
      ctx.beginPath(); ctx.arc(ex, ey, W(w) * 0.55, 0, 7); ctx.fill();
      ctx.fillStyle = '#efe6cf';
      ctx.beginPath(); ctx.arc(ex, ey, W(w) * 0.2, 0, 7); ctx.fill();
    };

    const drawArm = (side, shade) => {
      const sh = side ? 4 : 2, e = side ? RELB : LELB, h = side ? RHAND : LHAND;
      const skin = shade ? c.skinD : c.skin;
      if (!B[sh]) {
        seg(NECK, e, 13, c.shirt);
      } else {
        // torn-off arm: show a sleeve stub on the piece and a wound on the shoulder
        stump(P_[e].x, P_[e].y, 2 * P_[e].x - P_[h].x, 2 * P_[e].y - P_[h].y, 12, c.shirt);
        ctx.fillStyle = BLOOD;
        ctx.beginPath(); ctx.arc(P_[NECK].x, P_[NECK].y + W(4), W(6), 0, 7); ctx.fill();
      }
      seg(e, h, 10.5, skin, shade ? null : c.skinL);
      // bony hand with dark fingertips
      const hx = P_[h].x, hy = P_[h].y;
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(hx, hy, W(7), 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      if (!frozen) {
        ctx.fillStyle = BLOOD_DARK;
        ctx.beginPath(); ctx.arc(hx + W(3) * d, hy + W(2), W(3), 0, 7); ctx.fill();
      }
    };

    const drawLeg = (side) => {
      const hip = side ? 8 : 6, k = side ? RKNEE : LKNEE, f = side ? RFOOT : LFOOT;
      if (!B[hip]) seg(PELVIS, k, 14, c.pants);
      else stump(P_[k].x, P_[k].y, 2 * P_[k].x - P_[f].x, 2 * P_[k].y - P_[f].y, 13, c.pants);
      seg(k, f, 12.5, c.pants);
      // ankle skin + shoe
      const fp = P_[f];
      ctx.fillStyle = c.skinD;
      ctx.beginPath(); ctx.arc(fp.x, fp.y - W(3), W(5), 0, 7); ctx.fill();
      ctx.fillStyle = '#2b211a';
      ctx.beginPath();
      ctx.ellipse(fp.x + W(5) * d, fp.y + 2, W(12), W(6.5), 0, 0, 7);
      ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(fp.x + W(7) * d, fp.y - W(1), W(6), W(2), 0, 0, 7); ctx.fill();
    };

    drawArm(d > 0 ? 0 : 1, true);
    drawLeg(d > 0 ? 0 : 1);
    this.drawTorso(ctx, c, frozen);
    drawLeg(d > 0 ? 1 : 0);
    if (B[0]) {
      // neck stump on the body
      const n = P_[NECK];
      ctx.fillStyle = BLOOD;
      ctx.beginPath(); ctx.ellipse(n.x, n.y - W(3), W(9), W(6), 0, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#efe6cf';
      ctx.beginPath(); ctx.arc(n.x, n.y - W(3), W(2.5), 0, 7); ctx.fill();
    }
    this.drawHead(ctx, c, frozen);
    drawArm(d > 0 ? 1 : 0, false);

    if (frozen) {
      const b = this.bounds();
      ctx.globalAlpha = this.alpha * 0.28;
      ctx.fillStyle = '#e8f8ff';
      ctx.beginPath();
      ctx.roundRect(b.x0 - 12, b.y0 - 12 - HEAD_R * s, b.x1 - b.x0 + 24, b.y1 - b.y0 + 24 + HEAD_R * s, 14);
      ctx.fill();
      ctx.globalAlpha = this.alpha * 0.6;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x0 + 14, b.y0 + 30); ctx.stroke();
    }
    ctx.restore();
  }

  drawTorso(ctx, c, frozen) {
    const s = this.s, P_ = this.pts;
    const n = P_[NECK], pl = P_[PELVIS];
    const ang = Math.atan2(pl.y - n.y, pl.x - n.x);
    const tw = (this.def.fat ? 34 : this.type === 'brute' || this.type === 'giant' ? 29 : 22) * s;
    const tl = Math.hypot(pl.x - n.x, pl.y - n.y);
    const W = (w) => w * s;
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(ang - Math.PI / 2);
    ctx.scale(this.dir, 1);

    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(-tw * 0.85, -W(3));
      ctx.quadraticCurveTo(-tw * 1.15, tl * 0.5, -tw * 0.85, tl + W(4));
      // ragged hem
      const teeth = 6;
      for (let i = 0; i <= teeth; i++) {
        const x = -tw * 0.85 + (tw * 1.7 * i) / teeth;
        ctx.lineTo(x, tl + W(i % 2 ? 12 : 4));
      }
      ctx.quadraticCurveTo(tw * 1.15, tl * 0.5, tw * 0.85, -W(3));
      ctx.closePath();
    };
    shape();
    const g = ctx.createLinearGradient(-tw, 0, tw, 0);
    g.addColorStop(0, shade(c.shirt, -0.25));
    g.addColorStop(0.55, c.shirt);
    g.addColorStop(1, shade(c.shirt, -0.12));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();

    ctx.save();
    shape(); ctx.clip();
    // tear showing skin (ribs on some)
    ctx.fillStyle = c.skinD;
    ctx.beginPath(); ctx.ellipse(tw * 0.3, tl * 0.45, W(7), W(11), 0.3, 0, 7); ctx.fill();
    if (this.ribs) {
      ctx.strokeStyle = c.skinL; ctx.lineWidth = W(2.2);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(tw * 0.1, tl * (0.36 + i * 0.09)); ctx.quadraticCurveTo(tw * 0.32, tl * (0.33 + i * 0.09), tw * 0.5, tl * (0.38 + i * 0.09)); ctx.stroke();
      }
    }
    // blood stains
    if (!frozen) {
      for (const st of this.stains) {
        ctx.fillStyle = 'rgba(130,20,22,0.55)';
        ctx.beginPath(); ctx.ellipse(st.x * tw, st.y * tl, st.r * tw, st.r * tw * 1.3, 0.4, 0, 7); ctx.fill();
      }
    }
    // collar + buttons / seam
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-tw * 0.4, -W(2)); ctx.lineTo(0, W(10)); ctx.lineTo(tw * 0.4, -W(2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-tw * 0.1, W(12)); ctx.lineTo(-tw * 0.05, tl); ctx.stroke();
    ctx.restore();

    if (this.def.dynamite) {
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = '#c83a2c';
        ctx.fillRect(i * W(9) - W(4), tl * 0.25, W(8), tl * 0.55);
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.strokeRect(i * W(9) - W(4), tl * 0.25, W(8), tl * 0.55);
      }
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-tw * 0.85, tl * 0.45, tw * 1.7, W(5));
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, tl * 0.25); ctx.quadraticCurveTo(W(8), tl * 0.1, W(4), -W(2)); ctx.stroke();
      if (this.alive) {
        const f = 3 + Math.sin(this.fuse * 40) * 2;
        ctx.fillStyle = '#ffd23a';
        ctx.beginPath(); ctx.arc(W(4), -W(3), f, 0, 7); ctx.fill();
      }
    }
    if (this.def.fat) {
      // bulging bare belly with green blisters
      const bg = ctx.createRadialGradient(-tw * 0.1, tl * 0.5, 2, 0, tl * 0.6, tw);
      bg.addColorStop(0, c.skinL); bg.addColorStop(1, c.skinD);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(tw * 0.15, tl * 0.62, tw * 0.95, tl * 0.48, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = frozen ? '#e8f8ff' : '#8fbf3a';
      for (const [bx, by, br] of [[0.4, 0.5, 5], [-0.2, 0.75, 4], [0.6, 0.8, 3.5], [0.05, 0.4, 3]]) {
        ctx.beginPath(); ctx.arc(tw * bx, tl * by, W(br), 0, 7); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tw * 0.2, tl * 0.7, W(3), 0, 7); ctx.stroke();
    }
    if (this.def.helmet) {
      ctx.fillStyle = '#e8c04a';
      ctx.beginPath(); ctx.moveTo(-tw * 0.45, tl * 0.25); ctx.lineTo(-tw * 0.25, tl * 0.25); ctx.lineTo(-tw * 0.35, tl * 0.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-tw * 0.85, tl * 0.7, tw * 1.7, W(6));
    }
    ctx.restore();
  }

  drawHead(ctx, c, frozen) {
    const h = this.pts[HEAD], n = this.pts[NECK];
    const s = this.s;
    const r = HEAD_R * s;
    const ang = this.lostHead ? this.headRot : Math.atan2(h.y - n.y, h.x - n.x) + Math.PI / 2;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    ctx.scale(this.dir, 1);

    // ear
    ctx.fillStyle = c.skinD;
    ctx.beginPath(); ctx.ellipse(-r * 0.82, r * 0.05, r * 0.18, r * 0.26, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();

    // skull + underbite jaw, painted with a soft light from top-left
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
    g.addColorStop(0, c.skinL); g.addColorStop(0.55, c.skin); g.addColorStop(1, c.skinD);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.08, r * 0.9, r * 0.98, 0, 0, 7);
    ctx.moveTo(r * 0.85, r * 0.45);
    ctx.ellipse(r * 0.22, r * 0.52, r * 0.62, r * 0.4, 0.05, 0, 7);
    ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.08, r * 0.9, r * 0.98, 0, Math.PI * 0.62, Math.PI * 2.24); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(r * 0.22, r * 0.52, r * 0.62, r * 0.4, 0.05, -0.2, Math.PI * 1.02); ctx.stroke();

    // stringy hair
    if (this.hair >= 0) {
      ctx.strokeStyle = ['#2e241c', '#55473a', '#1e1e22'][this.hair];
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        const x0 = -r * 0.6 + i * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(x0, -r * 0.92);
        ctx.quadraticCurveTo(x0 - r * 0.15, -r * 1.2, x0 - r * 0.05 + (i % 2) * r * 0.2, -r * 1.25);
        ctx.stroke();
      }
    }
    // forehead wound with stitches
    if (this.wound && !frozen) {
      ctx.strokeStyle = BLOOD; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.7); ctx.lineTo(r * 0.45, -r * 0.45); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const x = -r * 0.05 + i * r * 0.17, y = -r * 0.66 + i * r * 0.07;
        ctx.beginPath(); ctx.moveTo(x - r * 0.05, y - r * 0.08); ctx.lineTo(x + r * 0.05, y + r * 0.08); ctx.stroke();
      }
    }
    // sunken sockets
    ctx.fillStyle = 'rgba(70,40,55,0.4)';
    ctx.beginPath(); ctx.ellipse(r * 0.08, -r * 0.18, r * 0.42, r * 0.36, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.62, -r * 0.12, r * 0.3, r * 0.28, 0, 0, 7); ctx.fill();

    // mismatched bulging eyes
    const dead = !this.alive;
    const big = r * 0.33, small = r * 0.21;
    const e1 = this.eyeBig > 0 ? big : small, e2 = this.eyeBig > 0 ? small : big;
    const eye = (x, y, er) => {
      if (dead) {
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - er * .6, y - er * .6); ctx.lineTo(x + er * .6, y + er * .6);
        ctx.moveTo(x + er * .6, y - er * .6); ctx.lineTo(x - er * .6, y + er * .6); ctx.stroke();
        return;
      }
      ctx.fillStyle = frozen ? '#ffffff' : '#f4eccf';
      ctx.beginPath(); ctx.arc(x, y, er, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      if (!frozen) {
        ctx.strokeStyle = 'rgba(190,40,40,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - er * 0.9, y); ctx.lineTo(x - er * 0.4, y + er * 0.1); ctx.moveTo(x - er * 0.7, y - er * 0.5); ctx.lineTo(x - er * 0.3, y - er * 0.3); ctx.stroke();
      }
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(x + er * 0.35, y + er * 0.12, er * 0.3, 0, 7); ctx.fill();
    };
    eye(r * 0.08, -r * 0.2, e1);
    eye(r * 0.62, -r * 0.13, e2);
    // nose holes
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.17, r * 0.05, r * 0.07, 0, 0, 7); ctx.ellipse(r * 0.7, r * 0.17, r * 0.05, r * 0.07, 0, 0, 7); ctx.fill();
    // gaping mouth, crooked teeth, drool of blood
    const open = this.state === 'attack' ? 0.24 : (this.grab ? 0.28 : 0.15);
    ctx.fillStyle = '#3e1013';
    ctx.beginPath(); ctx.ellipse(r * 0.38, r * 0.5, r * 0.36, r * open, 0.08, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#e9dfb8';
    for (let i = 0; i < 4; i++) {
      const tx = r * (0.1 + i * 0.16), ty = r * (0.5 - open + 0.02);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + r * 0.11, ty); ctx.lineTo(tx + r * 0.05, ty + r * (0.1 + (i % 2) * 0.05)); ctx.closePath(); ctx.fill();
    }
    if (!frozen) {
      ctx.fillStyle = BLOOD;
      ctx.beginPath(); ctx.ellipse(r * 0.2, r * (0.55 + open), r * 0.05, r * 0.12, 0, 0, 7); ctx.fill();
    }
    if (this.def.helmet) {
      // riot helmet with a scratched visor
      ctx.fillStyle = '#26324a';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 1.02, r * 0.86, 0, Math.PI, 0); ctx.lineTo(r * 1.02, -r * 0.18); ctx.lineTo(-r * 1.02, -r * 0.18); ctx.closePath();
      ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.8, r * 0.35, r * 0.12, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(170,210,240,0.35)';
      ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.2); ctx.lineTo(r * 1.08, -r * 0.2); ctx.lineTo(r * 1.0, r * 0.35); ctx.lineTo(-r * 0.1, r * 0.3); ctx.closePath();
      ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#e8e8e8'; ctx.font = `900 ${Math.round(r * 0.32)}px Arial Black, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('POLICE', -r * 0.2, -r * 0.45);
    }
    if (this.def.frostImmune && !this.def.helmet) {
      // icicles hanging off the brow and chin
      ctx.fillStyle = '#e8f6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (const [ix, iy, il] of [[-0.3, -0.62, 0.22], [0.2, -0.58, 0.16], [0.35, 0.86, 0.26], [0.6, 0.8, 0.18]]) {
        ctx.beginPath(); ctx.moveTo(r * ix - r * 0.07, r * iy); ctx.lineTo(r * ix + r * 0.07, r * iy); ctx.lineTo(r * ix, r * (iy + il)); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (this.lostHead) {
      // torn neck under the loose head
      ctx.fillStyle = BLOOD;
      ctx.beginPath(); ctx.ellipse(-r * 0.05, r * 0.85, r * 0.3, r * 0.16, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // Health bar above the head (big zombies always, others once hurt).
  drawBar(ctx) {
    if (!this.alive || this.alpha <= 0) return;
    if (!this.big && this.hp >= this.maxHp && this.barShow <= 0) return;
    const h = this.head;
    const w = Math.min(190, 38 + this.maxHp * 5.5);
    const hh = this.big ? 11 : 7;
    const x = h.x - w / 2, y = h.y - HEAD_R * this.s - 22;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, y - 3, w + 6, hh + 6);
    ctx.fillStyle = '#4a1012';
    ctx.fillRect(x, y, w, hh);
    const k = Math.max(0, this.hp / this.maxHp);
    const g = ctx.createLinearGradient(0, y, 0, y + hh);
    g.addColorStop(0, '#ff5a4a'); g.addColorStop(1, '#b81f24');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * k, hh);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y, w * k, hh * 0.35);
  }
}

// Lighten (+) or darken (-) a #rrggbb colour.
const shadeCache = new Map();
export function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(Math.max(0, Math.min(255, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  v = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, v);
  return v;
}
