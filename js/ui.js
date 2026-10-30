// DOM menus and HUD. Kept separate from the canvas so text stays crisp and
// buttons are real, tappable elements.
import { MAPS, DIFFS, SPECIALS, MODS, ZOMBIES, UPGRADES, LEVELS_PER_MAP, levelSpec } from './data.js';
import { store } from './save.js';
import { drawIcon } from './specials.js';
import { drawStatic, drawAnimated, drawBuilding } from './scenes.js';
import { sfx } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const SCREENS = ['title', 'maps', 'levels', 'brief', 'shop', 'pause', 'result', 'howto'];
const MAX_LOADOUT = 4;

export function createUI(h) {
  let current = 'title';
  let howtoBack = 'title';
  let shopBack = 'title';
  let bannerTimer = null;
  let slotEls = [];
  let lastSlots = '';
  const nav = { mode: 'campaign', map: 0, day: 0 };
  const thumbs = new Map();

  function show(name) {
    current = name;
    for (const s of SCREENS) $(`#screen-${s}`).classList.toggle('hidden', s !== name);
    $('#hud').classList.toggle('hidden', name !== 'pause' && name !== 'result');
    if (name === 'maps') renderMaps();
    if (name === 'levels') renderLevels();
    if (name === 'brief') renderBrief();
    if (name === 'shop') renderShop();
    document.querySelectorAll('.bank').forEach((el) => (el.textContent = store.get().stars));
  }

  function hideAll() {
    current = null;
    for (const s of SCREENS) $(`#screen-${s}`).classList.add('hidden');
    $('#hud').classList.remove('hidden');
  }

  // ---------- world map ----------
  function thumb(map) {
    if (thumbs.has(map.id)) return thumbs.get(map.id);
    const c = document.createElement('canvas');
    c.width = 460; c.height = 230;
    const g = c.getContext('2d');
    const W = 1500, top = 720 - 750, k = c.width / W;
    g.setTransform(k, 0, 0, k, 0, -top * k);
    drawStatic(g, map.scene, W, top);
    drawAnimated(g, map.scene, W, top, 12);
    drawBuilding(g, map.building, W / 2, 1, 0, 0);
    const url = c.toDataURL('image/jpeg', 0.82);
    thumbs.set(map.id, url);
    return url;
  }

  function renderMaps() {
    const s = store.get();
    $('#maps-title').textContent = nav.mode === 'endless' ? 'Endless Siege: pick a map' : 'Choose a map';
    const grid = $('#map-grid');
    grid.innerHTML = '';
    MAPS.forEach((m, i) => {
      const first = i * LEVELS_PER_MAP;
      const locked = first > s.unlocked;
      let beaten = 0;
      const medals = [0, 0, 0, 0];
      for (let d = 0; d < LEVELS_PER_MAP; d++) {
        const md = s.medals[first + d];
        if (md != null) { beaten++; medals[md]++; }
      }
      const card = document.createElement('button');
      card.className = 'map-card' + (locked ? ' locked' : '');
      card.disabled = locked;
      const img = new Image();
      img.alt = '';
      img.style.cssText = 'display:block;width:100%;aspect-ratio:2/1;object-fit:cover;border-bottom:3px solid var(--ink)';
      img.src = thumb(m);
      card.appendChild(img);
      const info = document.createElement('div');
      info.className = 'info';
      const right = nav.mode === 'endless'
        ? `Best: ${s.bestEndless[m.id] || 0} kills`
        : `<span class="medals">${DIFFS.map((d, k) => medals[k] ? `<span class="medal" style="background:${d.color}" title="${medals[k]} on ${d.name}"></span>` : '').join('')}</span>`;
      info.innerHTML = `<h3>${m.name}</h3><div class="meta"><span>${nav.mode === 'endless' ? m.blurb.split('.')[0] : `${beaten}/${LEVELS_PER_MAP} levels`}</span>${right}</div>`;
      card.appendChild(info);
      card.addEventListener('click', () => {
        sfx.click();
        nav.map = i;
        if (nav.mode === 'endless') { nav.day = 0; show('brief'); }
        else show('levels');
      });
      grid.appendChild(card);
    });
    // scroll the newest map into view
    const target = Math.min(MAPS.length - 1, Math.floor(s.unlocked / LEVELS_PER_MAP));
    requestAnimationFrame(() => grid.children[target]?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }

  // ---------- levels ----------
  function renderLevels() {
    const s = store.get();
    const m = MAPS[nav.map];
    $('#levels-title').textContent = m.name;
    $('#levels-blurb').textContent = m.blurb;
    const list = $('#level-list');
    list.innerHTML = '';
    m.levels.forEach(([name, , mod], d) => {
      const idx = nav.map * LEVELS_PER_MAP + d;
      const locked = idx > s.unlocked;
      const md = s.medals[idx];
      const b = document.createElement('button');
      b.className = 'level' + (locked ? ' locked' : '') + (mod === 'boss' ? ' boss' : '');
      b.disabled = locked;
      const medal = md != null ? `<span class="medals">${DIFFS.slice(0, md + 1).map((x) => `<span class="medal" style="background:${x.color}"></span>`).join('')}</span>` : '';
      b.innerHTML = `<span class="num">LEVEL ${d + 1} ${locked ? '🔒' : ''}</span><b>${name}</b>${mod ? `<span class="tag">${MODS[mod].name}</span>` : ''}${medal}`;
      b.addEventListener('click', () => { sfx.click(); nav.day = d; show('brief'); });
      list.appendChild(b);
    });
  }

  // ---------- briefing ----------
  function renderBrief() {
    const s = store.get();
    const m = MAPS[nav.map];
    const endless = nav.mode === 'endless';
    let mix, mod = null, goal;
    if (endless) {
      mix = {};
      for (const [, mx] of m.levels) Object.assign(mix, mx);
      $('#brief-eyebrow').textContent = m.name;
      $('#brief-title').textContent = 'Endless Siege';
      goal = `Survive as long as you can. Best here: ${s.bestEndless[m.id] || 0} kills.`;
    } else {
      const spec = levelSpec(nav.map, nav.day);
      mix = spec.mix; mod = spec.mod;
      $('#brief-eyebrow').textContent = `${m.name} · Level ${nav.day + 1}`;
      $('#brief-title').textContent = spec.name;
      goal = mod === 'timer' ? `Survive for ${spec.time} seconds.` :
        `Splat all ${Math.round(spec.count * DIFFS[s.diff].count)}${spec.boss ? ' zombies and the boss' : ' zombies'} before they break in.`;
      if (mod && mod !== 'timer') goal += ' ' + MODS[mod].desc;
    }
    $('#brief-mod').textContent = mod ? MODS[mod].name : '';
    $('#brief-goal').textContent = goal;
    const en = $('#brief-enemies');
    en.innerHTML = '';
    for (const k of Object.keys(mix).concat(mod === 'boss' ? ['boss'] : [])) {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = k === 'boss' ? 'Boss' : ZOMBIES[k].name;
      en.appendChild(c);
    }

    // difficulty
    const row = $('#diff-row');
    row.innerHTML = '';
    const idx = nav.map * LEVELS_PER_MAP + nav.day;
    const best = endless ? -1 : (s.medals[idx] ?? -1);
    DIFFS.forEach((d, i) => {
      const b = document.createElement('button');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s.diff === i));
      b.style.setProperty('--dc', d.color);
      b.textContent = d.name;
      if (i <= best) b.classList.add('beaten');
      b.addEventListener('click', () => { sfx.click(); store.set({ diff: i }); renderBrief(); });
      row.appendChild(b);
    });
    const D = DIFFS[s.diff];
    $('#diff-note').textContent = `Zombie health ×${D.hp}, numbers ×${D.count}, stars ×${D.stars}.`;

    // loadout
    const unlocked = Object.keys(SPECIALS).filter((k) => SPECIALS[k].unlock <= s.unlocked);
    let lo = (s.loadout || []).filter((k) => unlocked.includes(k));
    if (!lo.length) lo = unlocked.slice(-MAX_LOADOUT);
    if (lo.join() !== (s.loadout || []).join()) store.set({ loadout: lo });
    const grid = $('#loadout-grid');
    grid.innerHTML = '';
    $('#loadout-count').textContent = unlocked.length ? `${lo.length}/${Math.min(MAX_LOADOUT, unlocked.length)}` : '';
    $('#loadout-desc').textContent = unlocked.length ? 'Tap a special to add or remove it.' : 'Your first special unlocks after Level 1.';
    for (const [k, sp] of Object.entries(SPECIALS)) {
      const b = document.createElement('button');
      b.className = 'lo';
      const isUnlocked = unlocked.includes(k);
      if (!isUnlocked) { b.classList.add('locked'); b.dataset.lock = `Level ${sp.unlock + 1}`; b.disabled = true; }
      b.setAttribute('aria-pressed', String(lo.includes(k)));
      b.setAttribute('aria-label', sp.name);
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      drawIcon(c.getContext('2d'), k, 96);
      b.appendChild(c);
      const n = document.createElement('span');
      n.className = 'lo-name'; n.textContent = sp.name;
      b.appendChild(n);
      b.addEventListener('click', () => {
        let cur = store.get().loadout.slice();
        if (cur.includes(k)) { if (cur.length > 1) cur = cur.filter((x) => x !== k); }
        else { cur.push(k); if (cur.length > MAX_LOADOUT) cur.shift(); }
        store.set({ loadout: cur });
        sfx.click();
        renderBrief();
        $('#loadout-desc').textContent = `${sp.name}: ${sp.desc}`;
      });
      grid.appendChild(b);
    }
  }

  // ---------- shop ----------
  function renderShop() {
    const s = store.get();
    const list = $('#shop-list');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = store.level(u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.cost[lvl];
      const row = document.createElement('div');
      row.className = 'shop-item';
      const pips = Array.from({ length: u.max }, (_, i) => `<span class="pip${i < lvl ? ' on' : ''}"></span>`).join('');
      row.innerHTML = `<div><h3>${u.name}<span class="pips">${pips}</span></h3><p>${u.desc}</p></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.innerHTML = maxed ? 'Maxed' : `${cost} <span class="star-icon">★</span>`;
      btn.disabled = maxed || s.stars < cost;
      btn.addEventListener('click', () => {
        if (store.get().stars < cost) return;
        store.set({ stars: store.get().stars - cost, upgrades: { ...store.get().upgrades, [u.id]: lvl + 1 } });
        sfx.pickup();
        show('shop');
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  // ---------- HUD ----------
  function hud(d) {
    $('#star-count').textContent = d.endless ? `${d.kills} kills · ${d.stars}` : d.stars;
    const hp = Math.max(0, d.hp);
    const fill = $('#hp-fill');
    fill.style.width = `${hp * 100}%`;
    fill.classList.toggle('low', hp < 0.3);
    $('#wave-fill').style.width = `${Math.min(1, d.wave) * 100}%`;
    $('#wave-label').textContent = d.label || '';

    const key = d.slots.join(',');
    if (key === lastSlots && !d.force) return;
    lastSlots = key;
    const wrap = $('#slots');
    if (slotEls.length !== d.slots.length) {
      wrap.innerHTML = '';
      slotEls = d.slots.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'slot';
        b.setAttribute('aria-label', `Special slot ${i + 1}`);
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        b.appendChild(c);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); h.slotDown(i, e); });
        wrap.appendChild(b);
        return b;
      });
    }
    d.slots.forEach((kind, i) => {
      const b = slotEls[i];
      b.classList.toggle('filled', !!kind);
      const c = b.firstChild.getContext('2d');
      if (kind) drawIcon(c, kind, 128); else c.clearRect(0, 0, 128, 128);
    });
  }

  function banner(text, sub = '', ms = 1600) {
    const el = $('#banner');
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ---------- results ----------
  function result(r) {
    const title = $('#result-title');
    const body = $('#result-body');
    const next = $('#result-next');
    const medalEl = $('#result-medal');
    const unlockEl = $('#result-unlock');
    medalEl.textContent = ''; medalEl.style.background = '';
    unlockEl.innerHTML = '';
    const D = DIFFS[r.diff ?? 1];
    if (r.mode === 'endless') {
      title.textContent = r.newBest ? 'New best!' : 'Overrun!';
      body.innerHTML = `${r.kills} zombies splatted (best ${r.best})<br>+${r.stars} ★`;
      next.textContent = 'Try again';
      next.onclick = () => { sfx.click(); h.again(); };
    } else if (r.won) {
      const m = MAPS[r.map];
      title.textContent = r.finale ? 'You saved them all!' : `${m.levels[r.day][0]} cleared!`;
      medalEl.textContent = `${D.name} medal${r.newMedal ? ' · NEW' : ''}`;
      medalEl.style.background = D.color;
      body.innerHTML = `+${r.stars} ★ from kills · +${r.bonus} ★ bonus${r.perfect ? ' (no damage!)' : ''}${r.bestCombo > 1 ? `<br>Best combo x${r.bestCombo}` : ''}`;
      const items = [];
      for (const u of r.unlocks || []) items.push(`<span class="unlock-item"><canvas data-kind="${u.kind}" width="68" height="68"></canvas>New special: ${u.name}</span>`);
      if (r.newMap) items.push(`<span class="unlock-item">New map: ${r.newMap}!</span>`);
      unlockEl.innerHTML = items.length ? `<div class="unlock-row">${items.join('')}</div>` : '';
      unlockEl.querySelectorAll('canvas').forEach((c) => drawIcon(c.getContext('2d'), c.dataset.kind, 68));
      const lastOfMap = r.day === LEVELS_PER_MAP - 1;
      if (r.finale) { next.textContent = 'Play Endless'; next.onclick = () => { sfx.click(); nav.mode = 'endless'; show('maps'); }; }
      else if (lastOfMap) { next.textContent = 'Next map'; next.onclick = () => { sfx.click(); nav.map = r.map + 1; nav.day = 0; show('levels'); }; }
      else { next.textContent = 'Next level'; next.onclick = () => { sfx.click(); nav.map = r.map; nav.day = r.day + 1; show('brief'); }; }
    } else {
      title.textContent = 'They got in…';
      body.innerHTML = `${r.kills} splatted · +${r.stars} ★ kept<br>Try an upgrade, a different loadout or an easier difficulty.`;
      next.textContent = 'Retry';
      next.onclick = () => { sfx.click(); show('brief'); };
    }
    show('result');
    $('#hud').classList.remove('hidden');
  }

  // ---------- buttons ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    h.unlockAudio();
    sfx.click();
    switch (a) {
      case 'campaign': nav.mode = 'campaign'; show('maps'); break;
      case 'endless': nav.mode = 'endless'; show('maps'); break;
      case 'howto': howtoBack = current; show('howto'); break;
      case 'back-howto': show(howtoBack || 'title'); break;
      case 'back-title': show('title'); break;
      case 'back-maps': show('maps'); break;
      case 'back-brief': show(nav.mode === 'endless' ? 'maps' : 'levels'); break;
      case 'go': h.start({ mode: nav.mode, map: nav.map, day: nav.day, diff: store.get().diff, loadout: store.get().loadout }); break;
      case 'shop': shopBack = current === 'result' ? (nav.mode === 'endless' ? 'maps' : 'levels') : current; show('shop'); break;
      case 'shop-done': show(shopBack || 'title'); break;
      case 'resume': h.resume(); break;
      case 'restart': h.again(); break;
      case 'quit': h.quit(); show(nav.mode === 'endless' ? 'maps' : 'levels'); break;
      case 'sound': h.toggleSound(); break;
      case 'install': h.install(); break;
    }
  });
  $('#pause-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); h.pause(); });

  return { show, hideAll, hud, banner, result, nav, get current() { return current; } };
}
