// 봇 컨트롤러 — [규칙 기반 자동화] 계층이다 (AI 추론 아님).
// 플레이어와 똑같이 hero.intent 만 채운다. 스킬 사용 조건은 data.js 의 skill.ai 메타데이터를 읽어
// 일반화되어 있으므로, 영웅을 추가해도 이 파일은 수정할 필요가 없다.
// 이후 학습형/LLM 정책으로 교체하려면 updateBot 과 같은 시그니처(world, hero, dt → intent)만 맞추면 된다.
import { MAP } from './data.js';
import { dist, lanePath } from './world.js';

const DIFF = [
  { think: 0.38, aimErr: 90, skill: 0.35, ult: 0.25 },
  { think: 0.22, aimErr: 45, skill: 0.7, ult: 0.6 },
  { think: 0.13, aimErr: 15, skill: 1, ult: 1 },
];

function closestOnPath(path, x, y) {
  let best = { d: Infinity, seg: 0, t: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best.d) best = { d, seg: i, t };
  }
  return best;
}

// 라인 경로를 따라 앞(+)/뒤(-)로 ahead 만큼 떨어진 지점
function pathPoint(path, x, y, ahead) {
  const c = closestOnPath(path, x, y);
  let seg = c.seg, t = c.t, left = Math.abs(ahead);
  const dir = Math.sign(ahead) || 1;
  for (let guard = 0; guard < 12; guard++) {
    const [ax, ay] = path[seg], [bx, by] = path[seg + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const room = dir > 0 ? (1 - t) * len : t * len;
    if (left <= room) { t += (dir * left) / len; return [ax + (bx - ax) * t, ay + (by - ay) * t]; }
    left -= room;
    if (dir > 0) { if (seg >= path.length - 2) return path[path.length - 1]; seg++; t = 0; }
    else { if (seg <= 0) return path[0]; seg--; t = 1; }
  }
  return path[seg];
}

function dangerTower(w, h, x, y, margin) {
  for (const s of w.units) {
    if (!s.struct || !s.alive || s.team === h.team) continue;
    if (Math.hypot(s.x - x, s.y - y) > s.def.range + margin) continue;
    // 타워 사거리 안에 아군 미니언이 있으면 안전하다고 판단
    let covered = false;
    for (const m of w.units) if (m.alive && m.kind === 'minion' && m.team === h.team && dist(m, s) < s.def.range) { covered = true; break; }
    if (!covered || (s.target === h)) return s;
  }
  return null;
}

function decide(w, h) {
  const ai = h.ai;
  const hpPct = h.hp / h.maxHp;
  if (hpPct < 0.3) ai.retreat = true;
  else if (hpPct > 0.85) ai.retreat = false;

  let hero = null, hs = Infinity, minion = null, md = Infinity, struct = null, sd = Infinity, nearEnemies = 0, nearAllies = 0;
  for (const u of w.units) {
    if (!u.alive || u === h) continue;
    const d = dist(h, u);
    if (u.team === h.team) { if (u.kind === 'hero' && d < 700) nearAllies++; continue; }
    if (u.kind === 'hero') {
      if (d < 900) nearEnemies++;
      if (d < 780 && !dangerTower(w, h, u.x, u.y, -80)) { const s = d + (u.hp / u.maxHp) * 500; if (s < hs) { hs = s; hero = u; } }
    } else if (u.kind === 'minion') { if (d < 620 && d < md) { md = d; minion = u; } }
    else if (w.vulnerable(u) && d < 760 && d < sd) { sd = d; struct = u; }
  }
  ai.outnumbered = nearEnemies > nearAllies + 1 && hpPct < 0.7;
  ai.nearEnemyHero = hero;
  if (ai.retreat || ai.outnumbered) { ai.mode = 'retreat'; ai.target = hero; return; }
  if (hero) { ai.mode = 'fight'; ai.target = hero; return; }
  if (minion) { ai.mode = 'fight'; ai.target = minion; return; }
  if (struct && !dangerTower(w, h, h.x, h.y, 0)) { ai.mode = 'fight'; ai.target = struct; return; }
  ai.mode = 'advance'; ai.target = null;
}

function moveTo(h, x, y) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
  if (d < 12) { h.intent.mx = 0; h.intent.my = 0; return; }
  h.intent.mx = dx / d; h.intent.my = dy / d;
}

export function updateBot(w, h, dt) {
  const ai = h.ai, it = h.intent, diff = DIFF[w.difficulty] || DIFF[1];
  it.cast = {}; it.mx = 0; it.my = 0;
  if (!h.alive) return;
  ai.thinkT -= dt;
  if (ai.thinkT <= 0) { ai.thinkT = diff.think * (0.8 + w.rand() * 0.4); decide(w, h); ai.roll = w.rand(); ai.errA = (w.rand() - 0.5) * 2; }
  ai.strafeT -= dt;
  if (ai.strafeT <= 0) { ai.strafeT = 0.6 + w.rand() * 0.9; ai.strafe = w.rand() < 0.5 ? -1 : 1; }

  const path = lanePath(h.lane, h.team);
  const t = ai.target && ai.target.alive ? ai.target : null;
  const hpPct = h.hp / h.maxHp;

  if (ai.mode === 'retreat') {
    const core = MAP.cores[h.team];
    if (Math.hypot(core.x - h.x, core.y - h.y) < 700) moveTo(h, h.spawn.x, h.spawn.y);
    else { const p = pathPoint(path, h.x, h.y, -280); moveTo(h, p[0], p[1]); }
    it.aimX = h.x + it.mx * 300; it.aimY = h.y + it.my * 300;
    const threat = ai.nearEnemyHero && ai.nearEnemyHero.alive && dist(h, ai.nearEnemyHero) < 420;
    if (threat) for (const slot of ['q', 'rmb', 'space']) { const sk = h.def.skills[slot]; if (sk.ai && sk.ai.use === 'escape' && w.canCast(h, slot)) { it.cast[slot] = true; break; } }
    if (threat) { const sk = h.def.skills.q; if (sk.ai && sk.ai.use === 'defend') it.cast.q = true; }
  } else if (ai.mode === 'fight' && t) {
    const d = dist(h, t) - t.r;
    const lead = t.struct ? 0 : Math.min(0.35, d / 1500);
    const err = (diff.aimErr * ai.errA * Math.min(1, d / 500));
    const ang = Math.atan2(t.y - h.y, t.x - h.x) + Math.PI / 2;
    it.aimX = t.x + (t.vx || 0) * lead + Math.cos(ang) * err;
    it.aimY = t.y + (t.vy || 0) * lead + Math.sin(ang) * err;
    const want = h.def.aiRange;
    const ranged = want > 300;
    if (d > want) moveTo(h, t.x, t.y);
    else if (ranged && d < want * 0.6 && !t.struct) moveTo(h, h.x - (t.x - h.x), h.y - (t.y - h.y));
    else if (!t.struct && t.kind === 'hero') { it.mx = Math.cos(ang) * ai.strafe; it.my = Math.sin(ang) * ai.strafe; }
    // 스킬 선택: 메타데이터(ai.range / ai.use) 기반
    for (const slot of ['e', 'q', 'rmb', 'lmb']) {
      const sk = h.def.skills[slot];
      if (!sk.ai || !w.canCast(h, slot)) continue;
      const use = sk.ai.use || 'damage';
      if (use === 'escape') continue;
      if (use === 'defend') { if (t.kind === 'hero' && hpPct < 0.65 && d < sk.ai.range) { it.cast[slot] = true; break; } continue; }
      if (slot !== 'lmb') {
        if (t.struct) continue;
        if (sk.ult && (t.kind !== 'hero' || ai.roll > diff.ult || t.hp / t.maxHp > 0.8)) continue;
        if (!sk.ult && ai.roll > (t.kind === 'hero' ? diff.skill : diff.skill * 0.35)) continue;
        if (use === 'gap' && d < 140) continue;
      }
      if (d <= (sk.ai.range || 0) - 10) { it.cast[slot] = true; break; }
    }
    if (t.kind === 'hero' && hpPct < 0.45 && d < 200 && ai.roll < diff.skill && w.canCast(h, 'space')) { it.cast.space = true; moveTo(h, h.x - (t.x - h.x), h.y - (t.y - h.y)); }
  } else {
    const p = pathPoint(path, h.x, h.y, 300);
    if (dangerTower(w, h, p[0], p[1], 60)) {
      if (dangerTower(w, h, h.x, h.y, 90)) { const b = pathPoint(path, h.x, h.y, -260); moveTo(h, b[0], b[1]); }
    } else moveTo(h, p[0], p[1]);
    it.aimX = h.x + (it.mx || (h.team === 0 ? 1 : -1)) * 300; it.aimY = h.y + it.my * 300;
  }

  // 타워에 쫓기는 상황 이탈
  const tw = dangerTower(w, h, h.x, h.y, 20);
  if (tw && ai.mode !== 'retreat' && !(t && t.struct) && (tw.target === h || !t || t.kind !== 'hero' || t.hp / t.maxHp > 0.25)) {
    const b = pathPoint(path, h.x, h.y, -300); moveTo(h, b[0], b[1]);
  }

  // 끼임 감지 → 잠시 옆으로 비켜 이동
  if (ai.sideT > 0) { ai.sideT -= dt; const mx = it.mx; it.mx = -it.my * ai.side + mx * 0.3; it.my = mx * ai.side + it.my * 0.3; }
  ai.stuckT += dt;
  if (ai.stuckT > 0.5) {
    const wantMove = Math.hypot(it.mx, it.my) > 0.1 && h.lockT <= 0 && h.stunT <= 0;
    if (wantMove && Math.hypot(h.x - ai.lastX, h.y - ai.lastY) < 14) { ai.sideT = 0.7; ai.side = w.rand() < 0.5 ? -1 : 1; }
    ai.stuckT = 0; ai.lastX = h.x; ai.lastY = h.y;
  }
}
