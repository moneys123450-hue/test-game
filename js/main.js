// 화면 전환, 입력, HUD, 메인 루프
import { HEROES, HERO_ORDER, SLOT_ORDER, SLOT_LABEL, TEAM_NAME, ASSETS } from './data.js';
import { World } from './world.js';
import { updateBot } from './ai.js';
import { Renderer, loadAssets } from './render.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;
const state = { assets: {}, hero: 'kai', difficulty: 1, world: null, player: null, renderer: null, paused: false, running: false, acc: 0, last: 0, endT: 0 };
const keys = new Set();
const mouse = { x: innerWidth / 2, y: innerHeight / 2, l: false, r: false };

// ───────── 화면 ─────────
function show(id) {
  for (const s of ['screen-title', 'screen-select', 'screen-end']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== 'hud');
}

function buildSelect() {
  const wrap = $('hero-cards');
  wrap.innerHTML = '';
  for (const id of HERO_ORDER) {
    const h = HEROES[id];
    const card = document.createElement('div');
    card.className = 'card' + (id === state.hero ? ' on' : '');
    card.style.setProperty('--c', h.color);
    if (state.assets['portrait_' + id]) card.style.backgroundImage = `url(${ASSETS['portrait_' + id]})`;
    card.innerHTML = `<div class="in"><div class="role">${h.role}</div><h3>${h.name}<small>${h.title}</small></h3><p>${h.blurb}</p><ul>${
      ['lmb', 'rmb', 'q', 'e'].map((s) => `<li><b>${SLOT_LABEL[s]}</b><div>${h.skills[s].name}<span>${h.skills[s].desc}</span></div></li>`).join('')}</ul></div>`;
    card.onclick = () => { state.hero = id; buildSelect(); };
    wrap.appendChild(card);
  }
}

// ───────── 게임 시작 ─────────
function startGame() {
  const pick = (pool, n, rnd) => { const p = [...pool]; const out = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(rnd() * p.length), 1)[0]); return out; };
  const allies = pick(HERO_ORDER.filter((h) => h !== state.hero), 2, Math.random);
  const foes = pick(HERO_ORDER, 3, Math.random);
  const roster = [
    { hero: state.hero, team: 0, isPlayer: true, lane: 'top' },
    { hero: allies[0], team: 0, lane: 'top' }, { hero: allies[1], team: 0, lane: 'bot' },
    { hero: foes[0], team: 1, lane: 'top' }, { hero: foes[1], team: 1, lane: 'bot' }, { hero: foes[2], team: 1, lane: Math.random() < 0.5 ? 'top' : 'bot' },
  ];
  state.world = new World({ roster, difficulty: state.difficulty });
  state.player = state.world.heroes[0];
  state.renderer.cam.x = state.player.x; state.renderer.cam.y = state.player.y;
  state.paused = false; state.running = true; state.acc = 0; state.endT = 0;
  buildHud();
  $('feed').innerHTML = '';
  $('pause').classList.add('hidden');
  show('hud');
  announce('전투 개시!', '#ffd76a');
}

function buildHud() {
  const p = state.player, def = p.def;
  $('bottom').style.setProperty('--c', def.color);
  const por = $('me-portrait');
  por.style.setProperty('--c', def.color);
  por.style.backgroundImage = state.assets['portrait_' + def.id] ? `url(${ASSETS['portrait_' + def.id]})` : 'none';
  $('me-name').textContent = def.name;
  const wrap = $('skills');
  wrap.innerHTML = '';
  const hasIcons = !!state.assets['icons_' + def.id];
  for (const slot of SLOT_ORDER) {
    const sk = def.skills[slot];
    const el = document.createElement('div');
    el.className = 'slot' + (sk.ult ? ' ult' : '');
    el.style.setProperty('--c', def.color);
    el.title = `${sk.name} — ${sk.desc}`;
    if (hasIcons && sk.icon !== undefined) {
      el.style.backgroundImage = `url(${ASSETS['icons_' + def.id]})`;
      el.style.backgroundSize = '200% 200%';
      el.style.backgroundPosition = `${(sk.icon % 2) * 100}% ${Math.floor(sk.icon / 2) * 100}%`;
    } else el.innerHTML = `<div class="glyph">${slot === 'space' ? '»' : sk.name[0]}</div>`;
    el.insertAdjacentHTML('beforeend', `<div class="cd"></div><div class="num"></div><div class="key">${SLOT_LABEL[slot]}</div>`);
    el.dataset.slot = slot;
    wrap.appendChild(el);
  }
  for (const t of [0, 1]) $('tw' + t).innerHTML = '<i></i>'.repeat(4);
}

let annTimer = 0;
function announce(text, color = '#fff') {
  const a = $('announce');
  a.textContent = text; a.style.color = color;
  a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
  clearTimeout(annTimer);
}

function feed(html) {
  const f = $('feed');
  const d = document.createElement('div');
  d.innerHTML = html;
  f.appendChild(d);
  setTimeout(() => d.remove(), 5000);
  while (f.children.length > 6) f.firstChild.remove();
}

function handleEvents() {
  const w = state.world, p = state.player;
  for (const e of w.events) {
    if (e.type === 'kill') {
      feed(`<span class="t${e.killerTeam}">${e.killer}</span> ▸ <span class="t${e.victimTeam}">${e.victim}</span> 처치`);
      if (e.victim === p.name && e.victimTeam === p.team && !p.alive) state.renderer.cam.shake = 20;
    } else if (e.type === 'tower') {
      announce(`${TEAM_NAME[e.team]} 팀 ${e.tier === 1 ? '외곽' : '내곽'} 타워 파괴!`, e.team === p.team ? '#ff4d5e' : '#3fb6ff');
    } else if (e.type === 'levelup') {
      feed(`<span class="t${p.team}">레벨 ${e.level}</span> 달성`);
    } else if (e.type === 'over') {
      state.endT = 2.2;
      announce(e.winner === p.team ? '적 코어 파괴!' : '아군 코어가 파괴되었습니다', e.winner === p.team ? '#ffd76a' : '#ff4d5e');
    }
  }
  w.events.length = 0;
}

function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

function scoreTable(w, p) {
  const rows = [...w.heroes].sort((a, b) => a.team - b.team).map((h) =>
    `<tr class="t${h.team}${h === p ? ' me' : ''}"><td>${h.name}${h === p ? ' (나)' : ''}</td><td>Lv.${h.level}</td><td>${h.k} / ${h.d} / ${h.a}</td></tr>`).join('');
  return `<table class="score"><tr><th>영웅</th><th>레벨</th><th>처치 / 사망 / 도움</th></tr>${rows}</table>`;
}

function updateHud() {
  const w = state.world, p = state.player;
  $('clock').textContent = fmtTime(w.time);
  $('k0').textContent = w.kills[0]; $('k1').textContent = w.kills[1];
  for (const t of [0, 1]) {
    const els = $('tw' + t).children;
    w.towers.filter((x) => x.team === t).forEach((x, i) => els[i] && els[i].classList.toggle('dead', !x.alive));
  }
  $('me-lv').textContent = `Lv.${p.level}`;
  $('me-kda').textContent = `${p.k} / ${p.d} / ${p.a}`;
  $('me-hp').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('me-hp-t').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
  $('me-xp').style.width = p.level >= 12 ? '100%' : `${(p.xp / (90 + p.level * 45)) * 100}%`;
  for (const el of $('skills').children) {
    const slot = el.dataset.slot, cd = p.cds[slot], max = p.def.skills[slot].cd;
    el.children[el.children.length - 3].style.height = cd > 0 ? `${Math.min(100, (cd / max) * 100)}%` : '0';
    el.children[el.children.length - 2].textContent = cd > 0.5 ? Math.ceil(cd) : '';
    el.classList.toggle('ready', cd <= 0);
  }
  const rs = $('respawn');
  rs.classList.toggle('hidden', p.alive || w.over !== null);
  if (!p.alive) $('respawn-t').textContent = Math.max(1, Math.ceil(p.respawnT));
  const sb = $('scoreboard');
  const showSb = keys.has('Tab');
  sb.classList.toggle('hidden', !showSb);
  if (showSb) sb.innerHTML = scoreTable(w, p);
}

function endGame() {
  const w = state.world, p = state.player, win = w.over === p.team;
  state.running = false;
  $('end-title').textContent = win ? '승리' : '패배';
  $('end-title').className = win ? 'win' : 'lose';
  $('end-sub').textContent = `경기 시간 ${fmtTime(w.time)} · 블루 ${w.kills[0]} : ${w.kills[1]} 레드`;
  $('end-table').innerHTML = scoreTable(w, p);
  show('screen-end');
}

// ───────── 루프 ─────────
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - state.last) / 1000 || 0);
  state.last = now;
  const w = state.world, r = state.renderer;
  if (!w) return;
  if (state.running && !state.paused) {
    const p = state.player;
    const aim = r.screenToWorld(mouse.x, mouse.y);
    const it = p.intent;
    it.mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    it.my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    it.aimX = aim.x; it.aimY = aim.y;
    it.cast = { lmb: mouse.l, rmb: mouse.r, q: keys.has('KeyQ'), e: keys.has('KeyE'), space: keys.has('Space') };
    state.acc += dt;
    while (state.acc >= STEP) {
      for (const h of w.heroes) if (h.ai) updateBot(w, h, STEP);
      w.step(STEP);
      state.acc -= STEP;
    }
    handleEvents();
    if (w.over !== null) { state.endT -= dt; if (state.endT <= 0) endGame(); }
    // 사망 시에는 처치한 곳 대신 아군 코어 쪽을 비춘다
    r.follow(p.alive ? p : (w.over !== null ? w.cores[1 - w.over] : p), mouse, dt);
    updateHud();
  }
  r.draw(w, state.player);
}

// ───────── 입력 ─────────
function setPaused(v) { if (!state.running) return; state.paused = v; $('pause').classList.toggle('hidden', !v); }
addEventListener('keydown', (e) => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') setPaused(!state.paused);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mousedown', (e) => { if (e.target.id !== 'view') return; if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('resize', () => state.renderer && state.renderer.resize());

$('btn-start').onclick = () => { buildSelect(); show('screen-select'); };
$('btn-play').onclick = startGame;
$('btn-again').onclick = () => { buildSelect(); show('screen-select'); };
$('btn-resume').onclick = () => setPaused(false);
$('btn-quit').onclick = () => { state.running = false; state.paused = false; buildSelect(); show('screen-select'); };
for (const b of document.querySelectorAll('[data-diff]')) {
  b.onclick = () => { state.difficulty = Number(b.dataset.diff); document.querySelectorAll('[data-diff]').forEach((x) => x.classList.toggle('on', x === b)); };
}

// ───────── 부팅 ─────────
loadAssets((p) => { $('btn-start').textContent = `불러오는 중… ${Math.round(p * 100)}%`; }).then((assets) => {
  state.assets = assets;
  state.renderer = new Renderer($('view'), $('minimap'), assets);
  if (assets.title) for (const s of document.querySelectorAll('.screen')) s.style.setProperty('--bg', `url(${ASSETS.title})`);
  // 타이틀 뒤에서 봇끼리 싸우는 데모 전투를 보여준다
  const demo = new World({ roster: [{ hero: 'kai', team: 0, lane: 'top' }, { hero: 'lyra', team: 0, lane: 'bot' }, { hero: 'brom', team: 0, lane: 'top' }, { hero: 'sera', team: 1, lane: 'top' }, { hero: 'brom', team: 1, lane: 'bot' }, { hero: 'lyra', team: 1, lane: 'bot' }] });
  state.world = demo; state.player = demo.heroes[0];
  const b = $('btn-start'); b.disabled = false; b.textContent = '게임 시작';
  requestAnimationFrame(frame);
});
