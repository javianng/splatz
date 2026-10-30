// Boot: canvas sizing, game loop, input wiring, PWA install + offline.
import { Game } from './game.js';
import { createUI } from './ui.js';
import { initAudio, setEnabled, startMusic, stopMusic, sfx } from './audio.js';
import { store } from './save.js';
import { WORLD_H } from './data.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let view = { scale: 1, topY: 0, dpr: 1 };
let deferredInstall = null;
let lastStart = null;
let portrait = false;

const ui = createUI({
  start: (opts) => begin(opts),
  again: () => lastStart && begin(lastStart),
  slotDown: (i, e) => { unlockAudio(); const p = toWorld(e); game.slotDown(i, e.pointerId, p.x, p.y, p.t); },
  pause,
  resume,
  quit: () => { game.running = false; game.paused = false; game.cancelPointers(); stopMusic(); },
  toggleSound: () => {
    const on = !store.get().sound;
    store.set({ sound: on });
    setEnabled(on);
    updateSoundBtn();
  },
  install: async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    document.getElementById('install-btn').classList.add('hidden');
  },
  unlockAudio
});

const game = new Game(ui);
game.houseHp = game.houseMax = 100;
window.__splatz = { game, store }; // handy for debugging in the console

function unlockAudio() {
  initAudio();
  setEnabled(store.get().sound);
}

function updateSoundBtn() {
  document.getElementById('sound-btn').textContent = `Sound: ${store.get().sound ? 'On' : 'Off'}`;
}

function begin(opts) {
  unlockAudio();
  lockLandscape();
  lastStart = opts;
  ui.hideAll();
  game.start(opts);
  startMusic();
}

function pause() {
  if (!game.running || game.paused) return;
  game.paused = true;
  game.cancelPointers();
  ui.show('pause');
}

function resume() {
  game.paused = false;
  ui.hideAll();
}

// ---------- sizing ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth, cssH = window.innerHeight;
  portrait = cssH > cssW * 1.05;
  document.getElementById('rotate').classList.toggle('hidden', !portrait);
  if (portrait && game.running && !game.paused) pause();

  const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
  canvas.width = pw; canvas.height = ph;
  // Zoomed-out camera: show at least VIEW_H of world height and VIEW_W of width,
  // whichever needs the smaller scale. Extra height becomes more sky.
  const VIEW_H = 900, VIEW_W = 1650;
  const scale = Math.min(ph / VIEW_H, pw / VIEW_W);
  const W = pw / scale;
  const topY = WORLD_H - ph / scale;
  view = { scale, topY, dpr };
  game.resize(W, topY, pw, ph, scale);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- input ----------
function toWorld(e) {
  return {
    x: (e.clientX * view.dpr) / view.scale,
    y: (e.clientY * view.dpr) / view.scale + view.topY,
    t: performance.now()
  };
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const p = toWorld(e);
  game.pointerDown(e.pointerId, p.x, p.y, p.t);
});
window.addEventListener('pointermove', (e) => {
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs.length ? evs : [e]) {
    const p = toWorld(ev);
    game.pointerMove(e.pointerId, p.x, p.y, p.t);
  }
});
const up = (e) => { const p = toWorld(e); game.pointerUp(e.pointerId, p.x, p.y, p.t); };
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// stop iOS double-tap zoom and pinch
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') game.paused ? (ui.current === 'pause' && resume()) : pause();
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 4) game.useSlotAuto(n - 1);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); stopMusic(); }
});

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (!portrait) game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- landscape + fullscreen on phones/tablets ----------
function lockLandscape() {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (!touch) return;
  const el = document.documentElement;
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  try {
    if (!standalone && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch (_) {}
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (_) {}
}

// ---------- PWA ----------
const status = document.getElementById('offline-status');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ready = () => { status.textContent = '✓ Ready to play offline'; };
    if (navigator.serviceWorker.controller) ready();
    navigator.serviceWorker.ready.then(ready);
  }).catch(() => { status.textContent = ''; });
}
if (isIOS && !standalone) {
  status.textContent = 'Tip: Share → Add to Home Screen to install';
  navigator.serviceWorker?.ready.then(() => { status.textContent = '✓ Offline ready · Share → Add to Home Screen'; });
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  document.getElementById('install-btn').classList.remove('hidden');
});

updateSoundBtn();
ui.show('title');
