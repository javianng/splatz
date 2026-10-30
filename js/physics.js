// Tiny Verlet physics: particles + distance constraints. Good enough for
// floppy cartoon ragdolls, cheap enough for older phones.
import { GRAVITY, GROUND_Y } from './data.js';

export class Particle {
  constructor(x, y, r = 8) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.r = r;
    this.pinned = false;
  }
  get vx() { return this.x - this.px; }
  get vy() { return this.y - this.py; }
  setVel(vx, vy) { this.px = this.x - vx; this.py = this.y - vy; }
  moveTo(x, y) { this.x = x; this.y = y; }
  teleport(x, y) { this.x = this.px = x; this.y = this.py = y; }
}

export class Stick {
  constructor(a, b, len = null, stiffness = 1) {
    this.a = a; this.b = b;
    this.len = len ?? Math.hypot(b.x - a.x, b.y - a.y);
    this.stiffness = stiffness;
    this.broken = false;
  }
  solve() {
    if (this.broken) return;
    const a = this.a, b = this.b;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const diff = ((d - this.len) / d) * 0.5 * this.stiffness;
    const ox = dx * diff, oy = dy * diff;
    if (!a.pinned) { a.x += ox; a.y += oy; }
    if (!b.pinned) { b.x -= ox; b.y -= oy; }
  }
}

// Integrate one substep (gravity + inertia).
export function integrate(particles, dt, damping = 0.995) {
  const g = GRAVITY * dt * dt;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.pinned) continue;
    const vx = (p.x - p.px) * damping;
    const vy = (p.y - p.py) * damping;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + g;
  }
}

// Keep particles above the ground and inside the side walls. Returns the
// strongest impact speed (px/s) so callers can turn slams into damage.
export function collide(particles, dt, { walls = null, friction = 0.8, bounce = 0.25 } = {}) {
  let impact = 0, impactIdx = -1;
  const floor = GROUND_Y;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.pinned) continue;
    if (p.y + p.r > floor) {
      const vy = (p.y - p.py) / dt;
      if (vy > impact) { impact = vy; impactIdx = i; }
      const vx = p.x - p.px;
      p.y = floor - p.r;
      p.py = p.y + Math.max(0, vy * dt) * bounce;
      p.px = p.x - vx * friction;
    }
    if (walls) {
      if (p.x - p.r < walls[0]) {
        const vx = (p.px - p.x) / dt;
        if (vx > impact) { impact = vx; impactIdx = i; }
        p.x = walls[0] + p.r; p.px = p.x - vx * dt * bounce;
      } else if (p.x + p.r > walls[1]) {
        const vx = (p.x - p.px) / dt;
        if (vx > impact) { impact = vx; impactIdx = i; }
        p.x = walls[1] - p.r; p.px = p.x + vx * dt * bounce;
      }
    }
  }
  return { impact, impactIdx };
}
