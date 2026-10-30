// Progress lives in localStorage. Every access is guarded: private mode or
// cleared storage must never break the game.
const KEY = 'splatz-save-v2';
const OLD_KEY = 'splatz-save-v1';

const DEFAULTS = {
  stars: 0,
  unlocked: 0,          // highest global level index you may start
  medals: {},           // level index -> best difficulty index beaten (0..3)
  upgrades: {},         // id -> level
  bestEndless: {},      // map id -> kills
  diff: 1,              // last chosen difficulty
  loadout: [],          // chosen specials
  sound: true,
  seenNew: []           // specials whose unlock was announced
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old);
      return { ...structuredClone(DEFAULTS), stars: o.stars || 0, upgrades: o.upgrades || {}, sound: o.sound !== false };
    }
  } catch (e) { /* ignore */ }
  return structuredClone(DEFAULTS);
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export const store = {
  get: () => data,
  level: (id) => data.upgrades[id] || 0,
  set(patch) { Object.assign(data, patch); save(); }
};
