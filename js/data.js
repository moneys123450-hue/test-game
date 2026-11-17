// 게임 데이터 정의 (전부 데이터 기반 — 영웅/스킬을 추가할 때 엔진 코드를 고칠 필요가 없다)
//
// 스킬은 "효과 프리미티브"의 조합이다. world.js 의 인터프리터가 해석한다.
//   arc        : 전방 부채꼴 근접 타격
//   projectile : 투사체 (pierce, explode, count/spread 지원)
//   dash       : 조준 방향 돌진 (경로 피해, 무적 옵션)
//   aoe        : 원형 범위 (at: self | cursor | front, delay 로 예고)
//   blink      : 순간이동
//   buff       : 지속 능력치 변화 / 회복
// look: 3D 모델 외형 명세 (js/models.js 가 해석한다. 영웅별 모델 코드를 따로 쓰지 않는다)
// 공통 필드: t(시전 후 지연 초), dmg:[고정, 공격력계수], stun, slow:[배율, 초], knock
// repeat:{times, interval} 를 붙이면 같은 효과를 반복 실행한다.

export const TEAM = { BLUE: 0, RED: 1 };
export const TEAM_COLOR = ['#3fb6ff', '#ff4d5e'];
export const TEAM_NAME = ['블루', '레드'];

export const MAP = {
  w: 5200,
  h: 3000,
  laneWidth: 300,
  // 라인 경로 (블루 → 레드 방향). 레드는 역순으로 사용
  lanes: {
    top: [[420, 1500], [900, 620], [2600, 520], [4300, 620], [4780, 1500]],
    bot: [[420, 1500], [900, 2380], [2600, 2480], [4300, 2380], [4780, 1500]],
  },
  cores: [{ x: 420, y: 1500 }, { x: 4780, y: 1500 }],
  fountainRadius: 420,
  // 타워: lane, tier(1=외곽, 2=내곽)
  towers: [
    { team: 0, lane: 'top', tier: 1, x: 1700, y: 430 },
    { team: 0, lane: 'top', tier: 2, x: 1040, y: 480 },
    { team: 0, lane: 'bot', tier: 1, x: 1700, y: 2570 },
    { team: 0, lane: 'bot', tier: 2, x: 1040, y: 2520 },
    { team: 1, lane: 'top', tier: 1, x: 3500, y: 430 },
    { team: 1, lane: 'top', tier: 2, x: 4160, y: 480 },
    { team: 1, lane: 'bot', tier: 1, x: 3500, y: 2570 },
    { team: 1, lane: 'bot', tier: 2, x: 4160, y: 2520 },
  ],
  // 벽 (x, y, w, h) — 중앙 정글 지대
  walls: [
    [1400, 1000, 500, 110], [1400, 1890, 500, 110],
    [3300, 1000, 500, 110], [3300, 1890, 500, 110],
    [2180, 900, 110, 420], [2910, 900, 110, 420],
    [2180, 1680, 110, 420], [2910, 1680, 110, 420],
    [2440, 1380, 320, 240],
    [1080, 1320, 120, 360], [4000, 1320, 120, 360],
    [1750, 1400, 260, 200], [3190, 1400, 260, 200],
  ],
};

export const RULES = {
  maxLevel: 12,
  xpNeed: (lv) => 90 + lv * 45,
  xpMinion: 34,
  xpHeroKill: (victimLv) => 120 + victimLv * 30,
  xpTower: 180,
  xpShareRadius: 800,
  respawn: (lv) => 5 + lv * 1.2,
  waveInterval: 24,
  firstWave: 4,
  minionsPerWave: 3,
  structMul: 0.5, // 영웅이 건물에 주는 피해 배율
  backdoorMul: 0.25, // 아군 미니언 없이 건물을 칠 때의 피해 배율
  backdoorRadius: 760,
  fountainHeal: 0.16, // 초당 최대 체력 비율
  // 골드
  goldStart: 420, // 신발 + 포션 2개를 바로 살 수 있는 금액
  goldPassive: 1.6, // 초당
  goldMinion: 24, // 영웅이 직접 처치
  goldMinionNear: 9, // 영웅이 아닌 유닛이 처치했을 때 근처 적 영웅 각각
  goldHeroKill: 150,
  goldAssist: 60,
  goldTower: 120, // 팀 전원
  sellRate: 0.6,
  invSlots: 6,
  recallTime: 4, // 귀환 시전 시간(초). 이동·공격·피격 시 취소
  outOfCombatRegen: 0.012,
};

export const STRUCT = {
  tower: { r: 62, hp: 5400, atk: 150, range: 640, cd: 1.05 },
  tower2: { r: 62, hp: 6800, atk: 175, range: 640, cd: 1.0 },
  core: { r: 110, hp: 10500, atk: 150, range: 600, cd: 0.9 },
};

export const MINION = { r: 20, hp: 340, atk: 24, speed: 185, range: 78, aggro: 420, cd: 1.0, hpPerMin: 40, atkPerMin: 3 };

const DODGE = {
  id: 'dodge', name: '긴급 회피', key: 'Space', cd: 5, lock: 0.2, move: true,
  desc: '이동 방향으로 구르며 잠시 무적이 된다.',
  effects: [{ type: 'dash', dist: 270, dur: 0.2, invuln: true, toMove: true }],
  ai: { use: 'escape' },
};

export const HEROES = {
  kai: {
    id: 'kai', name: '카이', title: '섬광의 검사', role: '근접 돌격', color: '#35e0ff',
    hp: 1550, atk: 96, speed: 335, r: 27, hpLv: 135, atkLv: 9, aiRange: 110, sprite: 150,
    look: { model: 'art/kai-blender/kai-prototype.glb', scale: 1.0, skin: '#e8b89a', hair: { color: '#1b1f2a', style: 'spiky', streak: '#35e0ff' }, torso: '#2f3a52', legs: '#222a3a', accent: '#35e0ff', weapon: 'katana', anim: 'slash' },
    build: ['boots1', 'sword', 'fang', 'greatsword', 'boots2', 'heart'], // 봇이 사는 순서
    blurb: '빠른 연속 베기와 돌진으로 적진을 파고드는 근접 딜러.',
    skills: {
      lmb: { id: 'kai_lmb', name: '연참', cd: 0.42, lock: 0.16, icon: 0,
        desc: '전방을 빠르게 벤다.',
        effects: [{ type: 'dash', dist: 34, dur: 0.08 }, { type: 'arc', t: 0.06, range: 128, angle: 115, dmg: [0, 1.0], fx: 'slash' }],
        ai: { range: 135 } },
      rmb: { id: 'kai_rmb', name: '질풍 돌진', cd: 6, lock: 0.24, icon: 1,
        desc: '조준 방향으로 돌진하며 경로의 적을 벤다.',
        effects: [{ type: 'dash', dist: 400, dur: 0.22, hit: { radius: 66, dmg: [40, 1.2] }, fx: 'slash' }],
        ai: { range: 420, use: 'gap' } },
      q: { id: 'kai_q', name: '회오리 베기', cd: 9, lock: 0, icon: 2,
        desc: '1초간 회전하며 주변 적을 연속으로 벤다. 시전 중 이동 가능.',
        effects: [{ type: 'aoe', at: 'self', radius: 175, dmg: [22, 0.5], repeat: { times: 5, interval: 0.2 }, fx: 'spin' }],
        ai: { range: 150 } },
      e: { id: 'kai_e', name: '섬광 일섬', cd: 45, lock: 0.75, icon: 3, ult: true,
        desc: '기를 모은 뒤 긴 거리를 관통하며 큰 피해와 기절을 준다.',
        effects: [{ type: 'telegraph', shape: 'line', len: 640, width: 150, dur: 0.45 },
          { type: 'dash', t: 0.45, dist: 640, dur: 0.16, invuln: true, hit: { radius: 82, dmg: [150, 2.4], stun: 0.8 }, fx: 'slash' }],
        ai: { range: 520 } },
      space: DODGE,
    },
  },
  lyra: {
    id: 'lyra', name: '리라', title: '쌍권총의 추적자', role: '원거리 딜러', color: '#ff9a3c',
    hp: 1180, atk: 82, speed: 322, r: 25, hpLv: 100, atkLv: 8.5, aiRange: 560, sprite: 150,
    look: { scale: 0.96, skin: '#f0c4a8', hair: { color: '#ff8a2a', style: 'ponytail' }, torso: '#e9edf2', legs: '#2a2f3a', accent: '#ff9a3c', weapon: 'pistols', anim: 'shoot' },
    build: ['boots1', 'sword', 'greatsword', 'fang', 'boots2', 'hourglass'], // 봇이 사는 순서
    blurb: '먼 거리에서 꾸준히 쏘고, 탄막으로 전투를 마무리하는 사수.',
    skills: {
      lmb: { id: 'lyra_lmb', name: '속사', cd: 0.36, lock: 0.08, move: true, icon: 0,
        desc: '빠른 탄환을 발사한다.',
        effects: [{ type: 'projectile', speed: 1500, range: 780, radius: 11, dmg: [0, 0.9], color: '#ffb057' }],
        ai: { range: 720 } },
      rmb: { id: 'lyra_rmb', name: '관통탄', cd: 7, lock: 0.32, icon: 1,
        desc: '적을 관통하는 강력한 탄환을 쏜다.',
        effects: [{ type: 'projectile', t: 0.22, speed: 2000, range: 1150, radius: 20, pierce: true, dmg: [60, 1.6], color: '#ffe08a' }],
        ai: { range: 950 } },
      q: { id: 'lyra_q', name: '섬광 수류탄', cd: 10, lock: 0.2, icon: 2,
        desc: '지정 위치에 수류탄을 던져 피해를 주고 느리게 만든다.',
        effects: [{ type: 'aoe', at: 'cursor', maxRange: 680, radius: 195, delay: 0.6, dmg: [80, 1.3], slow: [0.5, 1.6], fx: 'boom' }],
        ai: { range: 660 } },
      e: { id: 'lyra_e', name: '탄막 폭풍', cd: 50, lock: 0, icon: 3, ult: true,
        desc: '1.3초 동안 조준 방향으로 탄환을 난사한다.',
        effects: [{ type: 'buff', dur: 1.3, mods: { speed: 0.55 } },
          { type: 'projectile', speed: 1500, range: 820, radius: 12, jitter: 13, dmg: [16, 0.55], color: '#ff7a2f', repeat: { times: 16, interval: 0.08 } }],
        ai: { range: 640 } },
      space: DODGE,
    },
  },
  brom: {
    id: 'brom', name: '브롬', title: '강철의 수호자', role: '탱커', color: '#ffd24a',
    hp: 2350, atk: 86, speed: 292, r: 33, hpLv: 190, atkLv: 7.5, aiRange: 120, sprite: 180,
    look: { scale: 1.28, bulk: 1.45, skin: '#c99878', hair: { color: '#5a3a22', style: 'beard' }, torso: '#8a6a3a', legs: '#4a4f5a', accent: '#ffd24a', pauldrons: '#b08a4a', weapon: 'hammer_shield', anim: 'smash' },
    build: ['boots1', 'armor', 'shield', 'heart', 'hourglass', 'boots2'], // 봇이 사는 순서
    blurb: '두꺼운 방어와 군중 제어로 아군의 진입로를 여는 선봉.',
    skills: {
      lmb: { id: 'brom_lmb', name: '망치 강타', cd: 0.66, lock: 0.28, icon: 0,
        desc: '전방을 묵직하게 내려친다.',
        effects: [{ type: 'arc', t: 0.14, range: 145, angle: 95, dmg: [0, 1.15], knock: 40, fx: 'slash' }],
        ai: { range: 150 } },
      rmb: { id: 'brom_rmb', name: '방패 돌격', cd: 9, lock: 0.32, icon: 1,
        desc: '방패를 앞세워 돌진하고 부딪힌 적을 기절시킨다.',
        effects: [{ type: 'dash', dist: 330, dur: 0.3, hit: { radius: 80, dmg: [50, 0.8], stun: 1.0 } }],
        ai: { range: 340, use: 'gap' } },
      q: { id: 'brom_q', name: '철벽', cd: 14, lock: 0, icon: 2,
        desc: '4초간 받는 피해가 55% 감소하고 체력을 일부 회복한다.',
        effects: [{ type: 'buff', dur: 4, mods: { dmgTaken: 0.45 }, heal: 0.08, fx: 'shield' }],
        ai: { range: 400, use: 'defend' } },
      e: { id: 'brom_e', name: '대지 분쇄', cd: 55, lock: 0.75, icon: 3, ult: true,
        desc: '땅을 내리쳐 넓은 범위의 적에게 큰 피해와 기절을 준다.',
        effects: [{ type: 'aoe', at: 'self', radius: 340, delay: 0.7, dmg: [180, 2.0], stun: 1.5, fx: 'quake' }],
        ai: { range: 280 } },
      space: DODGE,
    },
  },
  sera: {
    id: 'sera', name: '세라', title: '별빛의 마도사', role: '마법사', color: '#b98cff',
    hp: 1080, atk: 92, speed: 316, r: 25, hpLv: 92, atkLv: 9.5, aiRange: 540, sprite: 150,
    look: { scale: 0.98, skin: '#f2d2c4', hair: { color: '#cfc4f2', style: 'long' }, torso: '#4a2f80', robe: '#3a2468', accent: '#b98cff', weapon: 'staff', anim: 'cast', hover: true },
    build: ['boots1', 'hourglass', 'sword', 'greatsword', 'boots2', 'armor'], // 봇이 사는 순서
    blurb: '광역 마법과 점멸로 전장을 지배하지만 몸이 약한 마법사.',
    skills: {
      lmb: { id: 'sera_lmb', name: '별빛 탄', cd: 0.5, lock: 0.1, move: true, icon: 0,
        desc: '작은 폭발을 일으키는 마력탄을 쏜다.',
        effects: [{ type: 'projectile', speed: 1150, range: 720, radius: 15, dmg: [0, 1.0], explode: 70, color: '#c9a4ff' }],
        ai: { range: 680 } },
      rmb: { id: 'sera_rmb', name: '서리 폭발', cd: 7, lock: 0.25, icon: 1,
        desc: '지정 위치에 서리를 터뜨려 피해를 주고 느리게 만든다.',
        effects: [{ type: 'aoe', at: 'cursor', maxRange: 520, radius: 175, delay: 0.38, dmg: [60, 1.2], slow: [0.45, 2], fx: 'frost' }],
        ai: { range: 500 } },
      q: { id: 'sera_q', name: '점멸', cd: 11, lock: 0.05, move: true, icon: 2,
        desc: '조준 방향으로 순간이동한다.',
        effects: [{ type: 'blink', dist: 430 }],
        ai: { use: 'escape' } },
      e: { id: 'sera_e', name: '유성 낙하', cd: 55, lock: 0.5, icon: 3, ult: true,
        desc: '지정 위치에 거대한 유성을 떨어뜨린다.',
        effects: [{ type: 'aoe', at: 'cursor', maxRange: 820, radius: 285, delay: 1.1, dmg: [250, 2.8], stun: 0.6, fx: 'meteor' }],
        ai: { range: 780 } },
      space: DODGE,
    },
  },
};

// 아이템 — 전부 데이터. stats 의 키는 world.recalc 가 합산한다.
//   atk 공격력 / hp 최대 체력 / speed 이동 속도 / cdr 재사용 대기시간 감소(합산 상한 40%)
//   lifesteal 흡혈 비율 / armor 받는 피해 감소 비율(합산 상한 50%) / regen 초당 체력 회복
// group 이 같은 아이템은 하나만 가질 수 있고, 상위 아이템을 사면 차액만 내고 교체된다.
// consumable 은 사용 아이템(스택). glyph 는 아이콘 이미지가 없을 때 쓰는 대체 문자.
export const ITEMS = {
  potion: { id: 'potion', name: '체력 포션', cost: 60, glyph: '🧪', desc: '6초에 걸쳐 체력 360 회복. 최대 5개.', consumable: { heal: 360, dur: 6 }, stack: 5 },
  boots1: { id: 'boots1', name: '신속의 신발', cost: 300, glyph: '👟', desc: '이동 속도 +45', stats: { speed: 45 }, group: 'boots' },
  boots2: { id: 'boots2', name: '질풍의 신발', cost: 700, glyph: '🥾', desc: '이동 속도 +80 (신속의 신발에서 차액으로 교체)', stats: { speed: 80 }, group: 'boots' },
  sword: { id: 'sword', name: '강철 검', cost: 350, glyph: '🗡️', desc: '공격력 +18', stats: { atk: 18 } },
  greatsword: { id: 'greatsword', name: '파멸의 대검', cost: 850, glyph: '⚔️', desc: '공격력 +45', stats: { atk: 45 } },
  fang: { id: 'fang', name: '흡혈의 송곳니', cost: 700, glyph: '🩸', desc: '공격력 +15, 준 피해의 12% 만큼 회복', stats: { atk: 15, lifesteal: 0.12 } },
  armor: { id: 'armor', name: '생명의 갑주', cost: 400, glyph: '🦺', desc: '최대 체력 +350', stats: { hp: 350 } },
  heart: { id: 'heart', name: '거인의 심장', cost: 900, glyph: '❤️', desc: '최대 체력 +800, 초당 체력 8 회복', stats: { hp: 800, regen: 8 } },
  shield: { id: 'shield', name: '수호자의 방패', cost: 750, glyph: '🛡️', desc: '최대 체력 +200, 받는 피해 12% 감소', stats: { hp: 200, armor: 0.12 } },
  hourglass: { id: 'hourglass', name: '시간의 모래시계', cost: 600, glyph: '⏳', desc: '스킬 재사용 대기시간 15% 감소', stats: { cdr: 0.15 } },
};
export const ITEM_ORDER = ['potion', 'boots1', 'boots2', 'sword', 'greatsword', 'fang', 'armor', 'heart', 'shield', 'hourglass'];

export const HERO_ORDER = ['kai', 'lyra', 'brom', 'sera'];
export const SLOT_ORDER = ['lmb', 'rmb', 'q', 'e', 'space'];
export const SLOT_LABEL = { lmb: '좌클릭', rmb: '우클릭', q: 'Q', e: 'E', space: 'Space' };

// 이미지 주소는 js/assets.js 에서 관리한다 (없는 키는 도형으로 대체 렌더링)
export { ASSETS, cssBg, loadAssets } from './assets.js';
