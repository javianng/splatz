# SplatZ

Flick 'em. Smash 'em. Splat 'em. A cartoon zombie-defence game inspired by the classic iOS castle-defence flickers — built as an installable, fully offline **Progressive Web App**.

Grab zombies with your finger (or mouse), fling them into the sky and let gravity do the rest. Protect the farmhouse, then the prison bunker, across 10 days — or see how long you last in Endless Siege.

## Features

- **5 maps, 30 levels**: Moonlit Farm, Hollow Hill Cemetery, Blackrock Prison, Downtown Sundown and Frostbite Outpost. Each has its own scenery, building to defend, zombies and a boss.
- **Level twists**: Stampede (runners), Hands Off (specials only), Hold Out (survive the clock), Fog, Giants and Boss nights.
- **4 difficulties** (Easy, Normal, Hard, Nightmare) with a medal per level and bigger star payouts on harder settings.
- **10 specials, dragged out of their slot**: throw Grenades and Molotovs, drop Landmines, Anvils and Boulders, aim Meteors, Lightning, Airstrikes and Vortexes, tap Freeze. Pick a 4-special loadout before each level.
- **8 zombie types**: Walker, Runner, Brute, Boomer, Riot Cop (helmet shrugs off headshots), Bloater (bursts into a gas cloud), Frostbite (immune to Freeze) and Giants.
- **Ragdoll physics** with throwable body parts that linger after a kill, plus combos for zombies thrown into zombies.
- **Upgrades** for walls, slots, barricades, throwing arm, explosions, crate luck and a go-bag.
- **Works offline** as an installable PWA; all art is drawn in code and all sound is synthesised.
- **Landscape on iPhone, iPad and laptop**, multi-touch and mouse. Keyboard: `1`-`4` fire specials at the nearest zombie, `Esc`/`P` pause.

## Run locally

No build step. Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repo called `SplatZ` on GitHub and push this folder to the `main` branch:
   ```bash
   git remote add origin https://github.com/<your-username>/SplatZ.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`** → Save.
3. After a minute it's live at `https://<your-username>.github.io/SplatZ/`.

All paths are relative, so it works under the `/SplatZ/` sub-path.

## Install on your phone

- **iPhone / iPad (Safari):** open the site → Share → **Add to Home Screen**. Launch it once while online; after that it works in airplane mode.
- **Android (Chrome):** tap **Install** on the title screen (or the browser menu → Install app).
- **Laptop (Chrome/Edge):** click the install icon in the address bar, or just play in the tab.

## Releasing updates

Bump `VERSION` in `sw.js` whenever you change a file. Installed copies fetch the new version the next time they open online.

## Project layout

```
index.html            app shell + menus
manifest.webmanifest  PWA manifest (landscape, fullscreen)
sw.js                 offline cache
css/style.css         menus + HUD
js/main.js            boot, sizing, input, loop, install
js/game.js            gameplay: spawning, grab/flick, damage, combos, win/lose
js/zombie.js          zombie animation, ragdoll + drawing
js/physics.js         Verlet particles and sticks
js/specials.js        crates, grenade, boulder, meteor
js/scenes.js          farm + prison scenery and buildings
js/fx.js              splats, particles, floating text
js/audio.js           synthesised sound + music
js/data.js            zombie stats, days, upgrades
js/save.js            progress in localStorage
icons/                app icons
```

All characters and art are original and drawn in code.
