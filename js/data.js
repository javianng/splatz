// Static game data: zombie types, maps, levels, difficulties, specials, upgrades.

export const WORLD_H = 720;
export const GROUND_Y = 610;
export const GRAVITY = 2600;

// hp is in "slams": a solid flick into the ground does ~0.8-1.2 damage.
export const ZOMBIES = {
  walker: {
    name: 'Walker', hp: 3, speed: 36, scale: 1, mass: 1, dps: 2, stars: 10,
    skin: '#a9ba8b', skinDark: '#6f8058', skinLight: '#d3dcb6',
    shirt: ['#7a3b34', '#3f5a7a', '#6b6b4a', '#d6d0bd', '#8a6a3a'], pants: ['#3a3f55', '#4a3d33', '#2f3a33']
  },
  runner: {
    name: 'Runner', hp: 2, speed: 88, scale: 0.9, mass: 0.8, dps: 1.5, stars: 15,
    skin: '#bcc69c', skinDark: '#7e8a5e', skinLight: '#e2e8c8',
    shirt: ['#d6d0bd', '#b5532e', '#5a6e3a'], pants: ['#2f4f6f', '#3a3f55'], runner: true
  },
  brute: {
    name: 'Brute', hp: 8, speed: 26, scale: 1.3, mass: 2.4, dps: 5, stars: 40,
    skin: '#93a876', skinDark: '#5c6e48', skinLight: '#bfcf9f',
    shirt: ['#4a3a2e', '#2d2d33', '#6a2e2a'], pants: ['#4a3a2a', '#33302a'], sturdy: true
  },
  boomer: {
    name: 'Boomer', hp: 2, speed: 44, scale: 1, mass: 1, dps: 0, stars: 25,
    skin: '#a3b37d', skinDark: '#6b7a4c', skinLight: '#cdd8a8',
    shirt: ['#5e5e36'], pants: ['#3a3f55'], dynamite: true
  },
  cop: {
    name: 'Riot Cop', hp: 5, speed: 34, scale: 1.05, mass: 1.3, dps: 3, stars: 25,
    skin: '#a2b48a', skinDark: '#6a7a56', skinLight: '#cdd8b2',
    shirt: ['#2f4466', '#283a58'], pants: ['#1f2a3d'], helmet: true
  },
  bloater: {
    name: 'Bloater', hp: 4, speed: 24, scale: 1.15, mass: 1.8, dps: 2.5, stars: 30,
    skin: '#a7b56e', skinDark: '#6c7a3e', skinLight: '#d2dca0',
    shirt: ['#c9c2a6', '#8a7a5a'], pants: ['#4a4030'], fat: true, gas: true
  },
  frost: {
    name: 'Frostbite', hp: 4, speed: 40, scale: 1, mass: 1.1, dps: 2.5, stars: 25,
    skin: '#a9c6d6', skinDark: '#6c8fa6', skinLight: '#e2f1f8',
    shirt: ['#5a6e86', '#7a4a3a', '#3e4a5a'], pants: ['#2a3442'], frostImmune: true
  },
  giant: {
    name: 'Giant', hp: 22, speed: 19, scale: 1.75, mass: 4, dps: 8, stars: 120,
    skin: '#9aa986', skinDark: '#5f6b50', skinLight: '#c6d1b0',
    shirt: ['#d6d0bd', '#5a3a30', '#3d4a5e'], pants: ['#3a3328', '#2a2f3a'], sturdy: true, big: true
  }
};

export const DIFFS = [
  { id: 'easy',      name: 'Easy',      hp: 0.7,  count: 0.75, speed: 0.9,  dmg: 0.6, stars: 0.75, cap: 22, color: '#7fb53a' },
  { id: 'normal',    name: 'Normal',    hp: 1,    count: 1,    speed: 1,    dmg: 1,   stars: 1,    cap: 30, color: '#ffc928' },
  { id: 'hard',      name: 'Hard',      hp: 1.35, count: 1.25, speed: 1.1,  dmg: 1.3, stars: 1.5,  cap: 38, color: '#ff7a2a' },
  { id: 'nightmare', name: 'Nightmare', hp: 1.8,  count: 1.5,  speed: 1.2,  dmg: 1.7, stars: 2.2,  cap: 46, color: '#c8322a' }
];

// How each special is used from its slot:
//  throw  - drag it out and fling it      place - drag to a spot on the ground
//  aim    - drag a target marker          tap   - fires instantly
// unlock = global level index (0-based) at which it becomes available.
export const SPECIALS = {
  grenade:   { name: 'Grenade',   use: 'throw', unlock: 1,  color: '#4f7a3a', desc: 'Drag it out and throw. Whack zombies with it before it blows.' },
  freeze:    { name: 'Freeze',    use: 'tap',   unlock: 3,  color: '#7fd4ff', desc: 'Tap to freeze everyone. Frozen zombies shatter on any hit.' },
  molotov:   { name: 'Molotov',   use: 'throw', unlock: 5,  color: '#ff8a2a', desc: 'Smashes into a pool of fire that burns anything walking through.' },
  boulder:   { name: 'Boulder',   use: 'place', unlock: 7,  color: '#8a7a68', desc: 'Drop it on a side and it rolls through everything there.' },
  landmine:  { name: 'Landmine',  use: 'place', unlock: 9,  color: '#5a5a48', desc: 'Bury it in their path. The first zombie to step on it regrets it.' },
  meteor:    { name: 'Meteor',    use: 'aim',   unlock: 11, color: '#ff5a2a', desc: 'Aim and a flaming rock flattens the spot.' },
  lightning: { name: 'Lightning', use: 'aim',   unlock: 14, color: '#ffe14a', desc: 'Strikes one zombie and chains through the crowd.' },
  anvil:     { name: 'Anvil',     use: 'place', unlock: 17, color: '#4a4f58', desc: 'A ton of iron, straight down. Even giants feel it.' },
  airstrike: { name: 'Airstrike', use: 'aim',   unlock: 20, color: '#6a7a4a', desc: 'A bomber carpets the area around your target.' },
  vortex:    { name: 'Vortex',    use: 'aim',   unlock: 23, color: '#9a5aff', desc: 'Sucks zombies and body parts into a spinning storm, then spits them out.' }
};

export const MODS = {
  rush:   { name: 'Stampede',   desc: 'Mostly runners, coming fast.' },
  nograb: { name: 'Hands Off',  desc: 'You can\'t grab living zombies. Crates drop constantly.' },
  timer:  { name: 'Hold Out',   desc: 'Survive until the clock runs out.' },
  fog:    { name: 'Fog',        desc: 'Thick fog hides them until they\'re close.' },
  giants: { name: 'Giants',     desc: 'Fewer zombies, but big ones.' },
  boss:   { name: 'Boss',       desc: 'A huge zombie closes out the night.' }
};

export const MAPS = [
  {
    id: 'farm', name: 'Moonlit Farm', scene: 'farm', building: 'farmhouse',
    blurb: 'Hold the old farmhouse through a long blue night.',
    levels: [
      ['First Night',      { walker: 1 }, null],
      ['Uninvited Guests', { walker: 4, runner: 1 }, null],
      ['Stampede',         { walker: 2, runner: 5 }, 'rush'],
      ['Heavy Hitters',    { walker: 4, runner: 2, brute: 1, giant: 0.3 }, null],
      ['Until Dawn',       { walker: 4, runner: 2, brute: 1, giant: 0.4 }, 'timer'],
      ['The Big One',      { walker: 4, runner: 3, brute: 2, giant: 0.5 }, 'boss']
    ]
  },
  {
    id: 'grave', name: 'Hollow Hill Cemetery', scene: 'grave', building: 'chapel',
    blurb: 'The dead are climbing out right next to the chapel.',
    levels: [
      ['Fresh Graves',     { walker: 4, runner: 1, bloater: 1 }, null],
      ['Pea Soup',         { walker: 4, runner: 2, bloater: 1 }, 'fog'],
      ['Gasbags',          { walker: 2, bloater: 3, brute: 1 }, null],
      ['Hands Off',        { walker: 3, runner: 2, bloater: 1 }, 'nograb'],
      ['Restless',         { walker: 3, runner: 3, bloater: 2, giant: 0.5 }, 'fog'],
      ['Gravedigger',      { walker: 4, runner: 2, bloater: 2, brute: 1, giant: 0.4 }, 'boss']
    ]
  },
  {
    id: 'prison', name: 'Blackrock Prison', scene: 'prison', building: 'bunker',
    blurb: 'The cell blocks are empty. The yard is not.',
    levels: [
      ['Lockdown',         { walker: 4, cop: 1, runner: 1 }, null],
      ['Riot',             { walker: 2, cop: 3, runner: 2 }, null],
      ['Jailbreak',        { walker: 2, runner: 5, cop: 1 }, 'rush'],
      ['Demolition Crew',  { walker: 3, cop: 2, boomer: 2, brute: 1 }, null],
      ['Yard Giants',      { walker: 2, cop: 2, giant: 1, brute: 1 }, 'giants'],
      ['The Warden',       { walker: 3, cop: 3, runner: 2, boomer: 1, giant: 0.6 }, 'boss']
    ]
  },
  {
    id: 'city', name: 'Downtown Sundown', scene: 'city', building: 'diner',
    blurb: 'Last diner open on a burning street.',
    levels: [
      ['Rush Hour',        { walker: 3, runner: 3, cop: 1 }, 'rush'],
      ['Gas Leak',         { walker: 3, bloater: 2, boomer: 2 }, null],
      ['Overtime',         { walker: 3, runner: 2, cop: 2, brute: 1 }, 'timer'],
      ['No Hands',         { walker: 3, runner: 2, boomer: 1, cop: 1 }, 'nograb'],
      ['Skyline Giants',   { walker: 2, runner: 2, giant: 1.2, cop: 1 }, 'giants'],
      ['Main Street Monster', { walker: 3, runner: 3, cop: 2, bloater: 1, boomer: 1, giant: 0.7 }, 'boss']
    ]
  },
  {
    id: 'arctic', name: 'Frostbite Outpost', scene: 'arctic', building: 'cabin',
    blurb: 'A research station at the end of the world. Freeze won\'t save you here.',
    levels: [
      ['Whiteout',         { walker: 2, frost: 3, runner: 1 }, 'fog'],
      ['Cold Snap',        { frost: 4, runner: 2, brute: 1 }, null],
      ['Avalanche',        { frost: 3, runner: 4 }, 'rush'],
      ['Long Night',       { frost: 3, runner: 2, boomer: 1, brute: 1, giant: 0.5 }, 'timer'],
      ['Frost Giants',     { frost: 3, giant: 1.4, brute: 1 }, 'giants'],
      ['The Thing Below',  { frost: 4, runner: 3, brute: 2, boomer: 1, giant: 1 }, 'boss']
    ]
  }
];

export const LEVELS_PER_MAP = 6;
export const TOTAL_LEVELS = MAPS.length * LEVELS_PER_MAP;

// Turn a map/level pair into a full spawn recipe (before difficulty).
export function levelSpec(mapIdx, day) {
  const map = MAPS[mapIdx];
  const [name, mix, mod] = map.levels[day];
  const idx = mapIdx * LEVELS_PER_MAP + day;
  let count = Math.round(22 + mapIdx * 8 + day * 6);
  const g0 = Math.max(0.5, 1.35 - mapIdx * 0.13 - day * 0.09);
  let gap = [g0, g0 + 0.7];
  let burst = Math.min(0.45, 0.15 + day * 0.05 + mapIdx * 0.03);
  let time = 0;
  if (mod === 'rush') { gap = [gap[0] * 0.7, gap[1] * 0.7]; burst += 0.1; }
  if (mod === 'nograb') count = Math.round(count * 0.6);
  if (mod === 'giants') count = Math.round(count * 0.6);
  if (mod === 'timer') time = 70 + mapIdx * 10;
  return {
    idx, mapIdx, day, name, scene: map.scene, building: map.building, mix, mod,
    count, gap, burst, time,
    boss: mod === 'boss',
    bossHp: 50 + mapIdx * 20,
    crates: idx > 0
  };
}

export const UPGRADES = [
  { id: 'armor',   name: 'Reinforced walls', desc: '+25% building health per level.', max: 4, cost: [150, 300, 550, 900] },
  { id: 'slots',   name: 'Bigger pockets',   desc: 'One more special slot (start with 2).', max: 2, cost: [250, 600] },
  { id: 'fence',   name: 'Barricades',       desc: 'A fence on each side that soaks up hits.', max: 3, cost: [200, 450, 800] },
  { id: 'arm',     name: 'Pitching arm',     desc: 'Throws hit harder and splat easier.', max: 3, cost: [180, 400, 750] },
  { id: 'blast',   name: 'Bigger bangs',     desc: 'Explosions, fire and lightning hit harder.', max: 3, cost: [220, 500, 900] },
  { id: 'luck',    name: 'Lucky crates',     desc: 'Crates drop more often.', max: 3, cost: [160, 350, 650] },
  { id: 'starter', name: 'Go-bag',           desc: 'Start every level holding a special.', max: 1, cost: [500] }
];
