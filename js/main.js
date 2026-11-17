// 화면 전환, 입력(키보드·마우스 포인터 잠금·터치), HUD, 메인 루프
import { HEROES, HERO_ORDER, ITEMS, ITEM_ORDER, SLOT_ORDER, SLOT_LABEL, TEAM_NAME, RULES, ASSETS, cssBg, loadAssets } from './data.js';
import { World } from './world.js';
import { updateBot } from './ai.js';
import { Renderer3D } from './render3d.js';
import { drawMinimap } from './minimap.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;
const state = { assets: {}, hero: 'kai', difficulty: 1, world: null, player: null, renderer: null, paused: false, running: false, shop: false, acc: 0, last: 0, endT: 0 };
const keys = new Set();
const mouse = { l: false, r: false };
const touch = { on: false, joy: null, btn: {}, look: null, score: false, recall: 0, potion: 0 };
const view = $('view');
window.__game = state; // 디버깅·자동 검증용

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
    card.innerHTML = `<canvas class="art" data-art="portrait_${id}"></canvas><div class="in"><div class="role">${h.role}</div><h3>${h.name}<small>${h.title}</small></h3><p>${h.blurb}</p><ul>${
      ['lmb', 'rmb', 'q', 'e'].map((s) => `<li><b>${SLOT_LABEL[s]}</b><div>${h.skills[s].name}<span>${h.skills[s].desc}</span></div></li>`).join('')}</ul></div>`;
    card.onclick = () => { state.hero = id; for (const c of wrap.children) c.classList.toggle('on', c === card); };
    wrap.appendChild(card);
  }
  requestAnimationFrame(paintArt);
}

// 초상화를 캔버스에 cover 방식으로 그린다 (시트의 한 칸도 비율을 유지한 채 잘라 그릴 수 있다)
function paintArt() {
  for (const cv of document.querySelectorAll('canvas[data-art]')) {
    const a = state.assets[cv.dataset.art], w = cv.clientWidth, h = cv.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) continue;
    cv.width = w * d; cv.height = h * d;
    if (!a) continue;
    const k = Math.max(cv.width / a.sw, cv.height / a.sh), dw = a.sw * k, dh = a.sh * k;
    cv.getContext('2d').drawImage(a.img, a.sx, a.sy, a.sw, a.sh, (cv.width - dw) / 2, (cv.height - dh) * 0.08, dw, dh);
  }
}

// ───────── 게임 시작 / 데모 ─────────
const pick = (pool, n) => { const p = [...pool], out = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]); return out; };

// 타이틀·선택 화면 뒤에서 봇끼리 싸우는 전투를 보여준다
function enterDemo() {
  const a = pick(HERO_ORDER, 3), b = pick(HERO_ORDER, 3);
  const w = new World({ roster: [...a.map((hero, i) => ({ hero, team: 0, lane: i === 1 ? 'bot' : 'top' })), ...b.map((hero, i) => ({ hero, team: 1, lane: i === 1 ? 'top' : 'bot' }))] });
  state.world = w; state.player = w.heroes[0]; state.running = false; state.paused = false; closeShop(true);
  state.renderer.setWorld(w);
}

function startGame() {
  const allies = pick(HERO_ORDER.filter((h) => h !== state.hero), 2), foes = pick(HERO_ORDER, 3);
  const roster = [
    { hero: state.hero, team: 0, isPlayer: true, lane: 'top' },
    { hero: allies[0], team: 0, lane: 'top' }, { hero: allies[1], team: 0, lane: 'bot' },
    { hero: foes[0], team: 1, lane: 'top' }, { hero: foes[1], team: 1, lane: 'bot' }, { hero: foes[2], team: 1, lane: Math.random() < 0.5 ? 'top' : 'bot' },
  ];
  state.world = new World({ roster, difficulty: state.difficulty });
  state.player = state.world.heroes[0];
  state.renderer.setWorld(state.world);
  state.renderer.view.yaw = 0; state.renderer.view.pitch = 0.3;
  state.paused = false; state.running = true; state.acc = 0; state.endT = 0; state.invKey = null; closeShop(true);
  mouse.l = mouse.r = false;
  buildHud();
  $('feed').innerHTML = '';
  $('pause').classList.add('hidden');
  show('hud');
  announce('전투 개시!', '#ffd76a');
  lockPointer();
}

function buildHud() {
  const p = state.player, def = p.def;
  $('bottom').style.setProperty('--c', def.color);
  const por = $('me-portrait');
  por.style.setProperty('--c', def.color);
  por.innerHTML = `<canvas data-art="portrait_${def.id}"></canvas>`;
  requestAnimationFrame(paintArt);
  $('me-name').textContent = def.name;
  const wrap = $('skills');
  wrap.innerHTML = '';
  for (const slot of SLOT_ORDER) {
    const sk = def.skills[slot];
    const el = document.createElement('div');
    el.className = 'slot' + (sk.ult ? ' ult' : '');
    el.style.setProperty('--c', def.color);
    el.title = `${sk.name} — ${sk.desc}`;
    const iconKey = `icon_${def.id}_${sk.icon}`;
    if (sk.icon !== undefined && state.assets[iconKey]) Object.assign(el.style, cssBg(iconKey));
    else el.innerHTML = `<div class="glyph">${slot === 'space' ? '»' : sk.name[0]}</div>`;
    el.insertAdjacentHTML('beforeend', `<div class="cd"></div><div class="num"></div><div class="key">${SLOT_LABEL[slot]}</div>`);
    el.dataset.slot = slot;
    wrap.appendChild(el);
  }
  for (const el of document.querySelectorAll('.tb')) {
    const sk = def.skills[el.dataset.slot];
    el.style.setProperty('--c', def.color);
    if (!['lmb', 'space'].includes(el.dataset.slot)) el.textContent = sk.name.length > 4 ? sk.name.replace(' ', '\n') : sk.name;
  }
  for (const t of [0, 1]) $('tw' + t).innerHTML = '<i></i>'.repeat(4);
}

function announce(text, color = '#fff') {
  const a = $('announce');
  a.textContent = text; a.style.color = color;
  a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
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
      if (e.victim === p.name && e.victimTeam === p.team && !p.alive) state.renderer.shake = 0.6;
    } else if (e.type === 'tower') {
      announce(`${TEAM_NAME[e.team]} 팀 ${e.tier === 1 ? '외곽' : '내곽'} 타워 파괴!`, e.team === p.team ? '#ff4d5e' : '#3fb6ff');
    } else if (e.type === 'levelup') {
      feed(`<span class="t${p.team}">레벨 ${e.level}</span> 달성`);
    } else if (e.type === 'over') {
      state.endT = 2.6;
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
  $('me-gold').textContent = `🪙 ${Math.floor(p.gold)}`;
  updateInventory(p);
  $('me-hp').style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('me-hp-t').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
  $('me-xp').style.width = p.level >= RULES.maxLevel ? '100%' : `${(p.xp / RULES.xpNeed(p.level)) * 100}%`;
  for (const el of $('skills').children) {
    const slot = el.dataset.slot, cd = p.cds[slot], max = p.def.skills[slot].cd * (slot === 'lmb' ? 1 : 1 - p.cdr);
    el.children[el.children.length - 3].style.height = cd > 0 ? `${Math.min(100, (cd / max) * 100)}%` : '0';
    el.children[el.children.length - 2].textContent = cd > 0.5 ? Math.ceil(cd) : '';
    el.classList.toggle('ready', cd <= 0);
  }
  $('respawn').classList.toggle('hidden', p.alive || w.over !== null);
  if (!p.alive) $('respawn-t').textContent = Math.max(1, Math.ceil(p.respawnT));
  const showSb = keys.has('Tab') || touch.score;
  $('scoreboard').classList.toggle('hidden', !showSb);
  if (showSb) $('scoreboard').innerHTML = scoreTable(w, p);
  $('crosshair').classList.toggle('hidden', !p.alive || state.shop);
  $('lock-hint').classList.toggle('hidden', touch.on || state.shop || document.pointerLockElement === view);
  $('recall-bar').classList.toggle('hidden', !p.recall);
  if (p.recall) $('recall-fill').style.width = `${(1 - p.recall.t / RULES.recallTime) * 100}%`;
  $('shop-hint').classList.toggle('hidden', state.shop || !w.canShop(p));
  if (state.shop && (state.shopT = (state.shopT || 0) + 1) % 20 === 0) renderShop();
  drawMinimap($('minimap'), w, p, state.renderer.view.yaw);
}

// ───────── 인벤토리 · 상점 ─────────
function itemIcon(id) {
  const st = state.assets['item_' + id] ? cssBg('item_' + id) : null;
  return st ? `<div class="ic" style="background-image:${st.backgroundImage};background-size:${st.backgroundSize || 'cover'};background-position:${st.backgroundPosition || 'center'}"></div>` : `<div class="ic">${ITEMS[id].glyph}</div>`;
}

function updateInventory(p) {
  const key = p.items.join(',') + '|' + p.potions;
  if (key === state.invKey) return;
  state.invKey = key;
  let html = `<div class="islot pot" title="체력 포션 (F)">${ITEMS.potion.glyph}<kbd>F</kbd><em>${p.potions}</em></div>`;
  for (let i = 0; i < RULES.invSlots; i++) { const id = p.items[i]; html += `<div class="islot" title="${id ? ITEMS[id].name + ' — ' + ITEMS[id].desc : '빈 칸'}">${id ? ITEMS[id].glyph : ''}</div>`; }
  $('inv').innerHTML = html;
  $('tb-potion').textContent = `포션 ${p.potions}`;
}

const REASON = { home: '본진에서만 구매', gold: '골드 부족', slots: '칸 부족', owned: '보유 중', full: '최대 보유' };
function renderShop() {
  const w = state.world, p = state.player, home = w.canShop(p);
  $('shop-gold').textContent = `🪙 ${Math.floor(p.gold)}`;
  $('shop-note').textContent = home ? '' : '본진(코어 주변 원 안)에 있어야 사고팔 수 있습니다. B 로 귀환하세요.';
  $('shop-items').innerHTML = ITEM_ORDER.map((id) => {
    const it = ITEMS[id], q = w.quote(p, id);
    return `<button class="sitem${q.ok ? '' : ' no'}" data-buy="${id}">${itemIcon(id)}<div><b>${it.name}</b><span>${it.desc}</span></div><div class="cost">${q.cost}${q.ok ? '' : `<small>${REASON[q.reason]}</small>`}</div></button>`;
  }).join('');
  $('shop-inv').innerHTML = (p.potions ? `<div class="sitem no">${itemIcon('potion')}<div><b>체력 포션 × ${p.potions}</b></div></div>` : '')
    + p.items.map((id, i) => `<button class="sitem${home ? '' : ' no'}" data-sell="${i}">${itemIcon(id)}<div><b>${ITEMS[id].name}</b><span>판매 +${Math.round(ITEMS[id].cost * RULES.sellRate)}</span></div></button>`).join('')
    || '<span style="color:#93a1b8;font-size:13px">아직 아이템이 없습니다</span>';
}

function openShop() {
  if (!state.running || state.paused) return;
  state.shop = true; state.shopT = 0;
  mouse.l = mouse.r = false;
  $('shop').classList.remove('hidden');
  renderShop();
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeShop(silent) {
  state.shop = false;
  $('shop').classList.add('hidden');
  if (!silent && state.running && !state.paused) lockPointer();
}
// 다시 그려도 클릭이 끊기지 않도록 누르는 순간에 처리한다
$('shop').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-buy],[data-sell]');
  if (!b || !state.running) return;
  e.preventDefault();
  const w = state.world, p = state.player;
  if (b.dataset.buy) w.buy(p, b.dataset.buy); else w.sell(p, Number(b.dataset.sell));
  renderShop();
});
$('shop-close').onclick = () => closeShop();

function endGame() {
  const w = state.world, p = state.player, win = w.over === p.team;
  $('end-title').textContent = win ? '승리' : '패배';
  $('end-title').className = win ? 'win' : 'lose';
  $('end-sub').textContent = `경기 시간 ${fmtTime(w.time)} · 블루 ${w.kills[0]} : ${w.kills[1]} 레드`;
  $('end-table').innerHTML = scoreTable(w, p);
  if (document.pointerLockElement) document.exitPointerLock();
  show('screen-end');
  enterDemo();
}

// ───────── 입력 → intent ─────────
function autoTarget(w, p) {
  let best = null, bs = Infinity;
  for (const u of w.units) {
    if (!u.alive || u.team === p.team || (u.struct && !w.vulnerable(u))) continue;
    const d = Math.hypot(u.x - p.x, u.y - p.y) - u.r;
    if (d > 850) continue;
    const score = d + (u.kind === 'hero' ? 0 : u.kind === 'minion' ? 350 : 500);
    if (score < bs) { bs = score; best = u; }
  }
  return best;
}

function playerIntent(w, p) {
  const r = state.renderer, b = r.basis(), it = p.intent;
  let f = 0, s = 0;
  it.cast = {};
  if (touch.on) {
    if (touch.joy) { const dx = touch.joy.x - touch.joy.ox, dy = touch.joy.y - touch.joy.oy, d = Math.hypot(dx, dy); if (d > 10) { s = dx / d; f = -dy / d; } }
    let manual = false;
    for (const slot in touch.btn) { it.cast[slot] = true; if (touch.btn[slot].moved > 14) manual = true; }
    for (const el of document.querySelectorAll('.tb')) el.classList.toggle('wait', p.cds[el.dataset.slot] > 0.3);
    const t = !manual && Object.keys(touch.btn).length ? autoTarget(w, p) : null; // 버튼만 누르면 가까운 적 자동 조준
    const aim = t ? { x: t.x + (t.vx || 0) * 0.15, y: t.y + (t.vy || 0) * 0.15 } : r.aimPoint(p);
    it.aimX = aim.x; it.aimY = aim.y;
  } else {
    f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const aim = r.aimPoint(p);
    it.aimX = aim.x; it.aimY = aim.y;
    it.cast = { lmb: mouse.l, rmb: mouse.r, q: keys.has('KeyQ'), e: keys.has('KeyE'), space: keys.has('Space') };
  }
  it.mx = b.fx * f + b.rx * s; it.my = b.fy * f + b.ry * s; // 카메라 기준 이동
  const now = performance.now();
  it.recall = keys.has('KeyB') || now < touch.recall;
  it.potion = keys.has('KeyF') || keys.has('Digit1') || now < touch.potion;
}

// ───────── 루프 ─────────
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - state.last) / 1000 || 0);
  state.last = now;
  const w = state.world, r = state.renderer;
  if (!w) return;
  if (state.running) {
    if (!state.paused) {
      playerIntent(w, state.player);
      state.acc += dt;
      while (state.acc >= STEP) {
        for (const h of w.heroes) if (h.ai) updateBot(w, h, STEP);
        w.step(STEP);
        state.acc -= STEP;
      }
      handleEvents();
      updateHud();
      if (w.over !== null) { state.endT -= dt; if (state.endT <= 0) { endGame(); return; } }
    }
    r.render(w, state.player, state.paused ? 0 : dt, 'play');
  } else {
    state.acc += dt;
    while (state.acc >= STEP) { for (const h of w.heroes) updateBot(w, h, STEP); w.step(STEP); state.acc -= STEP; }
    w.events.length = 0;
    if (w.over !== null) enterDemo();
    r.render(state.world, state.player, dt, 'demo');
  }
}

// ───────── 키보드·마우스 ─────────
function lockPointer() {
  if (touch.on || !view.requestPointerLock) return;
  try { const p = view.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 잠금 실패 시 화면 클릭으로 다시 시도한다 */ }
}
function setPaused(v) {
  if (!state.running) return;
  state.paused = v; $('pause').classList.toggle('hidden', !v);
  if (v) { closeShop(true); keys.clear(); mouse.l = mouse.r = false; if (document.pointerLockElement) document.exitPointerLock(); } else lockPointer();
}
addEventListener('keydown', (e) => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { if (state.shop) closeShop(); else if (state.running && !state.paused) setPaused(true); return; } // 재개는 버튼으로 (포인터 잠금은 클릭이 필요하다)
  if (e.code === 'KeyP') { if (!e.repeat) { if (state.shop) closeShop(); else openShop(); } return; }
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
addEventListener('mousemove', (e) => { if (document.pointerLockElement === view && state.running && !state.paused) state.renderer.look(e.movementX, e.movementY); });
view.addEventListener('mousedown', (e) => {
  if (!state.running || state.paused || touch.on) return;
  if (state.shop) { closeShop(); return; }
  if (document.pointerLockElement !== view) { lockPointer(); return; } // 첫 클릭은 조준 고정에만 쓴다
  if (e.button === 0) mouse.l = true;
  if (e.button === 2) mouse.r = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
// Esc 로 포인터 잠금이 풀리면 일시정지로 처리한다
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== view && state.running && !state.paused && !state.shop && !touch.on && state.world.over === null) setPaused(true); });
addEventListener('resize', () => { if (state.renderer) state.renderer.resize(); paintArt(); });

// ───────── 터치 ─────────
// 왼쪽 아래: 이동 조이스틱 / 화면 오른쪽 끌기: 시점 회전 / 버튼: 누르고 있으면 시전(가까운 적 자동 조준), 버튼을 누른 채 끌면 시점을 돌려 직접 조준
function enableTouch() {
  if (touch.on) return;
  touch.on = true;
  document.body.classList.add('touch');
  $('touch').classList.remove('hidden');
}

function setupTouch() {
  const zone = $('joy-zone'), joy = $('joy'), knob = joy.firstElementChild, lookZone = $('look-zone');
  const place = () => {
    const j = touch.joy, rect = zone.getBoundingClientRect();
    if (!j) { joy.style.left = '110px'; joy.style.top = 'calc(100% - 110px)'; knob.style.transform = ''; return; }
    joy.style.left = `${j.ox - rect.left}px`; joy.style.top = `${j.oy - rect.top}px`;
    const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(d, 50) / d;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const opt = { passive: false };
  zone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; touch.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY }; place(); }, opt);
  zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (touch.joy && t.identifier === touch.joy.id) { touch.joy.x = t.clientX; touch.joy.y = t.clientY; place(); } }, opt);
  const endJoy = (e) => { for (const t of e.changedTouches) if (touch.joy && t.identifier === touch.joy.id) { touch.joy = null; place(); } };
  zone.addEventListener('touchend', endJoy); zone.addEventListener('touchcancel', endJoy);

  const lookMove = (rec, t) => { const dx = t.clientX - rec.x, dy = t.clientY - rec.y; rec.x = t.clientX; rec.y = t.clientY; rec.moved = (rec.moved || 0) + Math.abs(dx) + Math.abs(dy); if (state.running && !state.paused) state.renderer.look(dx * 2.6, dy * 2.2); };
  lookZone.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; touch.look = { id: t.identifier, x: t.clientX, y: t.clientY }; }, opt);
  lookZone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (touch.look && t.identifier === touch.look.id) lookMove(touch.look, t); }, opt);
  const endLook = (e) => { for (const t of e.changedTouches) if (touch.look && t.identifier === touch.look.id) touch.look = null; };
  lookZone.addEventListener('touchend', endLook); lookZone.addEventListener('touchcancel', endLook);

  for (const el of document.querySelectorAll('.tb')) {
    const slot = el.dataset.slot;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; touch.btn[slot] = { id: t.identifier, x: t.clientX, y: t.clientY, moved: 0 }; el.classList.add('down'); }, opt);
    el.addEventListener('touchmove', (e) => { e.preventDefault(); const b = touch.btn[slot]; for (const t of e.changedTouches) if (b && t.identifier === b.id) lookMove(b, t); }, opt);
    const end = (e) => { e.preventDefault(); delete touch.btn[slot]; el.classList.remove('down'); };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }
  $('tb-pause').addEventListener('touchstart', (e) => { e.preventDefault(); setPaused(!state.paused); }, opt);
  $('tb-score').addEventListener('touchstart', (e) => { e.preventDefault(); touch.score = !touch.score; }, opt);
  $('tb-shop').addEventListener('touchstart', (e) => { e.preventDefault(); if (state.shop) closeShop(); else openShop(); }, opt);
  $('tb-recall').addEventListener('touchstart', (e) => { e.preventDefault(); touch.recall = performance.now() + 250; }, opt);
  $('tb-potion').addEventListener('touchstart', (e) => { e.preventDefault(); touch.potion = performance.now() + 250; }, opt);
  addEventListener('touchstart', enableTouch, { passive: true });
}
setupTouch();

$('btn-start').onclick = () => { buildSelect(); show('screen-select'); };
$('btn-play').onclick = startGame;
$('btn-again').onclick = () => { buildSelect(); show('screen-select'); };
$('btn-resume').onclick = () => setPaused(false);
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); enterDemo(); buildSelect(); show('screen-select'); };
for (const b of document.querySelectorAll('[data-diff]')) {
  b.onclick = () => { state.difficulty = Number(b.dataset.diff); document.querySelectorAll('[data-diff]').forEach((x) => x.classList.toggle('on', x === b)); };
}

// ───────── 부팅 ─────────
const lowSpec = matchMedia('(pointer: coarse)').matches;
try {
  state.renderer = new Renderer3D(view, $('overlay'), { low: lowSpec });
} catch (err) {
  $('btn-start').textContent = '이 브라우저는 WebGL 을 지원하지 않습니다';
  throw err;
}
enterDemo();
requestAnimationFrame(frame);
loadAssets((p) => { $('btn-start').textContent = `불러오는 중… ${Math.round(p * 100)}%`; }).then((assets) => {
  state.assets = assets;
  if (assets.title) $('screen-title').style.setProperty('--bg', `url(${typeof ASSETS.title === 'string' ? ASSETS.title : ASSETS.title.src})`);
  const b = $('btn-start'); b.disabled = false; b.textContent = '게임 시작';
});
