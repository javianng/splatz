// All sound is synthesised with WebAudio: no audio files to download,
// so the game is fully offline with a tiny footprint.

let ctx = null;
let master = null;
let musicGain = null;
let noiseBuf = null;
let enabled = true;
let musicTimer = null;
let lastPlay = {};

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.8 : 0;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.22;
  musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
}

// Avoid stacking dozens of identical sounds in the same frame.
function throttle(name, ms) {
  const now = performance.now();
  if (lastPlay[name] && now - lastPlay[name] < ms) return false;
  lastPlay[name] = now;
  return true;
}

function noise(dur, { freq = 800, q = 1, type = 'lowpass', vol = 0.5, attack = 0.002, sweep = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, out = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out || master);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  thud(power = 0.5) {
    if (!throttle('thud', 40)) return;
    tone(90 + Math.random() * 30, 0.18, { type: 'sine', vol: 0.25 + power * 0.4, slide: 0.4 });
    noise(0.08, { freq: 500, vol: 0.15 + power * 0.2 });
  },
  splat(power = 1) {
    if (!throttle('splat', 50)) return;
    noise(0.35, { freq: 1800, q: 0.8, vol: 0.5 * power, sweep: 0.15 });
    tone(160, 0.22, { type: 'triangle', vol: 0.3 * power, slide: 0.3 });
  },
  boom() {
    noise(0.9, { freq: 900, vol: 0.9, sweep: 0.08, attack: 0.005 });
    tone(70, 0.7, { type: 'sine', vol: 0.7, slide: 0.35 });
  },
  groan() {
    if (!throttle('groan', 1400)) return;
    const f = 90 + Math.random() * 50;
    tone(f, 0.9, { type: 'sawtooth', vol: 0.06, slide: 0.75 });
    tone(f * 1.5, 0.8, { type: 'sine', vol: 0.05, slide: 0.7 });
  },
  grab() {
    if (!throttle('grab', 60)) return;
    tone(320, 0.07, { type: 'square', vol: 0.06, slide: 1.4 });
  },
  whoosh() {
    if (!throttle('whoosh', 120)) return;
    noise(0.25, { freq: 600, type: 'bandpass', q: 2, vol: 0.18, sweep: 3 });
  },
  star() {
    if (!throttle('star', 45)) return;
    tone(1200 + Math.random() * 300, 0.12, { type: 'triangle', vol: 0.08, slide: 1.5 });
  },
  pickup() {
    tone(520, 0.1, { type: 'square', vol: 0.1 });
    tone(780, 0.14, { type: 'square', vol: 0.1, delay: 0.08 });
  },
  freeze() {
    noise(0.8, { freq: 6000, type: 'highpass', vol: 0.25, sweep: 0.5 });
    tone(1800, 0.5, { type: 'sine', vol: 0.08, slide: 0.5 });
  },
  shatter() {
    if (!throttle('shatter', 60)) return;
    for (let i = 0; i < 4; i++) tone(2000 + Math.random() * 2500, 0.15, { type: 'triangle', vol: 0.06, delay: i * 0.025 });
    noise(0.2, { freq: 5000, type: 'highpass', vol: 0.3 });
  },
  rumble() {
    noise(2.2, { freq: 160, vol: 0.5, attack: 0.3 });
  },
  hurt() {
    if (!throttle('hurt', 300)) return;
    tone(140, 0.15, { type: 'square', vol: 0.12, slide: 0.6 });
  },
  fire() { noise(1.2, { freq: 1200, type: 'bandpass', q: 0.6, vol: 0.35, attack: 0.05, sweep: 0.4 }); },
  beep() { tone(1400, 0.08, { type: 'square', vol: 0.07 }); },
  clang() {
    tone(220, 0.9, { type: 'square', vol: 0.12, slide: 0.98 });
    tone(587, 0.7, { type: 'triangle', vol: 0.14, slide: 0.99 });
    noise(0.3, { freq: 3000, type: 'highpass', vol: 0.3 });
  },
  plane() {
    tone(90, 2.2, { type: 'sawtooth', vol: 0.07, slide: 1.3 });
    noise(2.2, { freq: 300, vol: 0.12, attack: 0.6 });
  },
  vortex() {
    tone(80, 3.2, { type: 'sawtooth', vol: 0.06, slide: 3 });
    noise(3.2, { freq: 500, type: 'bandpass', q: 3, vol: 0.2, attack: 0.5, sweep: 4 });
  },
  zap() {
    noise(0.4, { freq: 4000, type: 'highpass', vol: 0.5, attack: 0.001 });
    tone(60, 0.5, { type: 'sawtooth', vol: 0.25, slide: 0.5 });
  },
  gas() { noise(0.7, { freq: 400, vol: 0.5, sweep: 0.3, attack: 0.01 }); tone(120, 0.4, { type: 'triangle', vol: 0.2, slide: 0.4 }); },
  click() { tone(660, 0.05, { type: 'square', vol: 0.07 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.09, delay: i * 0.12 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.08, delay: i * 0.18 })); }
};

// A small, creepy-but-goofy loop: walking bassline plus a plinky melody.
const BASS = [55, 0, 65.4, 0, 73.4, 0, 65.4, 61.7];
const MEL = [440, 0, 523, 0, 0, 466, 0, 392, 440, 0, 0, 349, 0, 392, 0, 0];

export function startMusic() {
  if (!ctx || musicTimer) return;
  let step = 0;
  const beat = 0.21;
  let next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      const b = BASS[step % BASS.length];
      const m = MEL[step % MEL.length];
      const delay = next - ctx.currentTime;
      if (b) tone(b, beat * 1.6, { type: 'triangle', vol: 0.5, delay, out: musicGain });
      if (m && step % 32 > 15) tone(m, beat * 0.9, { type: 'square', vol: 0.08, delay, out: musicGain });
      if (step % 4 === 2) tone(2400, 0.03, { type: 'square', vol: 0.03, delay, out: musicGain });
      next += beat;
      step++;
    }
  }, 100);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
