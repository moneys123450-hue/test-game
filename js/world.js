// 시뮬레이션 코어 — DOM에 의존하지 않는다 (node 에서 헤드리스 검증 가능).
// 모든 영웅(플레이어/봇)은 동일한 intent 인터페이스로 조종된다.
import { MAP, RULES, STRUCT, MINION, HEROES, SLOT_ORDER } from './data.js';

const TAU = Math.PI * 2;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angDiff = (a, b) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const CAST_PRIORITY = ['e', 'q', 'rmb', 'space', 'lmb'];

export function lanePath(lane, team) {
  const p = MAP.lanes[lane];
  return team === 0 ? p : [...p].reverse();
}

export class World {
  constructor({ roster, difficulty = 1, seed = Date.now() }) {
    this.time = 0;
    this.difficulty = difficulty;
    this.units = [];
    this.projectiles = [];
    this.timers = [];
    this.zones = [];
    this.fx = [];
    this.events = [];
    this.kills = [0, 0];
    this.over = null;
    this.nextId = 1;
    this.waveT = RULES.firstWave;
    this._seed = seed >>> 0 || 1;

    this.cores = MAP.cores.map((c, team) => this.addStruct('core', team, c.x, c.y, STRUCT.core, null, 3));
    this.towers = MAP.towers.map((t) => this.addStruct('tower', t.team, t.x, t.y, t.tier === 2 ? STRUCT.tower2 : STRUCT.tower, t.lane, t.tier));
    this.heroes = [];
    const count = [0, 0];
    for (const r of roster) this.addHero(r, count[r.team]++);
  }

  rand() { // 결정적 난수 (재현 가능한 테스트용)
    let s = this._seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this._seed = s >>> 0;
    return this._seed / 4294967296;
  }

  // ───────── 유닛 생성 ─────────
  base(kind, team, x, y, r, hp, atk) {
    return { id: this.nextId++, kind, team, x, y, r, hp, maxHp: hp, atk, alive: true, face: team === 0 ? 0 : Math.PI,
      vx: 0, vy: 0, stunT: 0, slows: [], buffs: [], invulnT: 0, lastDamagedT: -99, flashT: 0, cd: 0 };
  }

  addStruct(kind, team, x, y, def, lane, tier) {
    const u = Object.assign(this.base(kind, team, x, y, def.r, def.hp, def.atk), { def, lane, tier, target: null, scanT: 0, struct: true });
    this.units.push(u);
    return u;
  }

  addHero(r, idx) {
    const def = HEROES[r.hero];
    const core = MAP.cores[r.team];
    const sx = core.x + (r.team === 0 ? -150 : 150);
    const sy = core.y + (idx - 1) * 120;
    const h = Object.assign(this.base('hero', r.team, sx, sy, def.r, def.hp, def.atk), {
      def, name: r.name || def.name, isPlayer: !!r.isPlayer, lane: r.lane || 'top', spawn: { x: sx, y: sy },
      level: 1, xp: 0, speed: def.speed, cds: {}, lockT: 0, lockMove: false, dash: null, respawnT: 0, lifeId: 1,
      k: 0, d: 0, a: 0, damagers: new Map(), aggroT: -99, lastCombatT: -99,
      intent: { mx: 0, my: 0, aimX: sx + (r.team === 0 ? 100 : -100), aimY: sy, cast: {} },
      ai: r.isPlayer ? null : { thinkT: this.rand() * 0.3, mode: 'advance', target: null, retreat: false, strafe: 1, strafeT: 0, stuckT: 0, lastX: sx, lastY: sy, sideT: 0 },
    });
    for (const s of SLOT_ORDER) h.cds[s] = 0;
    this.units.push(h);
    this.heroes.push(h);
    return h;
  }

  addMinion(team, lane, offset) {
    const path = lanePath(lane, team);
    const min = this.time / 60;
    const m = Object.assign(this.base('minion', team, path[0][0] + (team === 0 ? 120 : -120), path[0][1] + offset, MINION.r,
      MINION.hp + MINION.hpPerMin * min, MINION.atk + MINION.atkPerMin * min), { path, wp: 1, speed: MINION.speed, target: null, scanT: 0, lane });
    this.units.push(m);
  }

  // ───────── 조회 ─────────
  enemiesIn(team, x, y, rad) {
    const out = [];
    for (const u of this.units) {
      if (!u.alive || u.team === team) continue;
      if (Math.hypot(u.x - x, u.y - y) <= rad + u.r) out.push(u);
    }
    return out;
  }

  vulnerable(s) {
    if (s.kind === 'tower') return s.tier === 1 || !this.towers.some((t) => t.alive && t.team === s.team && t.lane === s.lane && t.tier === 1);
    if (s.kind === 'core') return this.towers.some((t) => !t.alive && t.team === s.team && t.tier === 2);
    return true;
  }

  minionNear(team, s) {
    for (const u of this.units) if (u.alive && u.kind === 'minion' && u.team === team && dist(u, s) < RULES.backdoorRadius) return true;
    return false;
  }

  inWall(x, y, pad = 0) {
    for (const [wx, wy, ww, wh] of MAP.walls) if (x > wx - pad && x < wx + ww + pad && y > wy - pad && y < wy + wh + pad) return true;
    return false;
  }

  speedMul(u) {
    let m = 1;
    for (const b of u.buffs) if (b.mods.speed) m *= b.mods.speed;
    let slow = 1;
    for (const s of u.slows) slow = Math.min(slow, s.mul);
    return m * slow;
  }

  addFx(f) { f.t = 0; this.fx.push(f); if (this.fx.length > 400) this.fx.shift(); }

  // ───────── 피해 / 처치 ─────────
  damage(src, tgt, amount) {
    if (!tgt.alive || tgt.invulnT > 0 || this.over !== null) return 0;
    if (tgt.struct) {
      if (!this.vulnerable(tgt)) { this.addFx({ type: 'num', x: tgt.x, y: tgt.y - tgt.r, text: '무적', color: '#9aa7b8', dur: 0.6 }); return 0; }
      if (src && src.kind === 'hero') amount *= this.minionNear(src.team, tgt) ? RULES.structMul : RULES.backdoorMul;
    }
    for (const b of tgt.buffs) if (b.mods.dmgTaken) amount *= b.mods.dmgTaken;
    amount = Math.max(1, Math.round(amount));
    tgt.hp -= amount;
    tgt.lastDamagedT = this.time;
    tgt.flashT = 0.12;
    if (src && src.kind === 'hero') {
      src.lastCombatT = this.time;
      if (tgt.kind === 'hero') { tgt.damagers.set(src.id, this.time); src.aggroT = this.time; }
    }
    if (tgt.kind === 'hero' || (src && src.kind === 'hero')) {
      this.addFx({ type: 'num', x: tgt.x + (this.rand() - 0.5) * 30, y: tgt.y - tgt.r - 10, text: String(amount), color: tgt.kind === 'hero' ? '#ff6b6b' : '#ffffff', dur: 0.7, srcId: src ? src.id : 0, tgtId: tgt.id });
    }
    if (tgt.hp <= 0) this.kill(src, tgt);
    return amount;
  }

  applyHit(src, tgt, spec, amount) {
    this.damage(src, tgt, amount);
    if (!tgt.alive || tgt.struct || tgt.invulnT > 0) return;
    if (spec.stun) tgt.stunT = Math.max(tgt.stunT, spec.stun);
    if (spec.slow) tgt.slows.push({ mul: spec.slow[0], t: spec.slow[1] });
    if (spec.knock) {
      const a = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      tgt.x += Math.cos(a) * spec.knock; tgt.y += Math.sin(a) * spec.knock;
    }
  }

  dmgOf(h, d) { return d ? d[0] * (1 + 0.08 * (h.level - 1)) + d[1] * h.atk : 0; }

  giveXp(h, amount) {
    if (h.level >= RULES.maxLevel) return;
    h.xp += amount;
    while (h.level < RULES.maxLevel && h.xp >= RULES.xpNeed(h.level)) {
      h.xp -= RULES.xpNeed(h.level);
      h.level++;
      h.maxHp += h.def.hpLv; h.atk += h.def.atkLv;
      if (h.alive) h.hp = Math.min(h.maxHp, h.hp + h.def.hpLv + h.maxHp * 0.15);
      this.addFx({ type: 'levelup', follow: h.id, x: h.x, y: h.y, dur: 0.9 });
      if (h.isPlayer) this.events.push({ type: 'levelup', level: h.level });
    }
  }

  kill(src, tgt) {
    tgt.alive = false; tgt.hp = 0;
    const enemyTeam = 1 - tgt.team;
    this.addFx({ type: 'boom', x: tgt.x, y: tgt.y, radius: tgt.r * 2.2, color: '#ffffff', dur: 0.35 });
    if (tgt.kind === 'minion') {
      const near = this.heroes.filter((h) => h.alive && h.team === enemyTeam && dist(h, tgt) < RULES.xpShareRadius);
      for (const h of near) this.giveXp(h, RULES.xpMinion / Math.sqrt(near.length));
    } else if (tgt.kind === 'hero') {
      tgt.d++; tgt.lifeId++; tgt.dash = null; tgt.buffs = []; tgt.slows = []; tgt.stunT = 0; tgt.lockT = 0;
      tgt.respawnT = RULES.respawn(tgt.level);
      this.kills[enemyTeam]++;
      const killer = src && src.kind === 'hero' ? src : null;
      const xp = RULES.xpHeroKill(tgt.level);
      if (killer) { killer.k++; this.giveXp(killer, xp); }
      for (const [id, t] of tgt.damagers) {
        if (this.time - t > 10 || (killer && id === killer.id)) continue;
        const h = this.heroes.find((x) => x.id === id);
        if (h) { h.a++; this.giveXp(h, xp * 0.5); }
      }
      tgt.damagers.clear();
      this.events.push({ type: 'kill', killer: killer ? killer.name : (src ? (src.struct ? '타워' : '미니언') : '?'), killerTeam: enemyTeam, victim: tgt.name, victimTeam: tgt.team, playerInvolved: tgt.isPlayer || (killer && killer.isPlayer) });
    } else if (tgt.kind === 'tower') {
      for (const h of this.heroes) if (h.team === enemyTeam) this.giveXp(h, RULES.xpTower);
      this.events.push({ type: 'tower', team: tgt.team, lane: tgt.lane, tier: tgt.tier });
    } else if (tgt.kind === 'core') {
      this.over = enemyTeam;
      this.events.push({ type: 'over', winner: enemyTeam });
    }
  }

  // ───────── 스킬 인터프리터 ─────────
  canCast(h, slot) { return h.alive && h.cds[slot] <= 0 && h.lockT <= 0 && h.stunT <= 0 && !h.dash; }

  cast(h, slot) {
    const sk = h.def.skills[slot];
    h.cds[slot] = sk.cd; h.lockT = sk.lock; h.lockMove = !!sk.move;
    if (sk.ult) { this.addFx({ type: 'ultcast', follow: h.id, x: h.x, y: h.y, color: h.def.color, dur: 0.7 }); this.events.push({ type: 'ult', name: h.name, skill: sk.name, team: h.team }); }
    for (const eff of sk.effects) {
      const rep = eff.repeat || { times: 1, interval: 0 };
      for (let i = 0; i < rep.times; i++) {
        const delay = (eff.t || 0) + i * rep.interval;
        if (delay <= 0) this.runEffect(h, eff);
        else { const life = h.lifeId; this.timers.push({ t: this.time + delay, run: () => { if (h.alive && h.lifeId === life && h.stunT <= 0) this.runEffect(h, eff); } }); }
      }
    }
  }

  cursorPoint(h, maxRange) {
    const dx = h.intent.aimX - h.x, dy = h.intent.aimY - h.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(d, maxRange) / d;
    return { x: h.x + dx * k, y: h.y + dy * k };
  }

  runEffect(h, eff) {
    const a = h.face;
    switch (eff.type) {
      case 'arc': {
        const half = (eff.angle * Math.PI) / 360;
        const amount = this.dmgOf(h, eff.dmg);
        for (const u of this.enemiesIn(h.team, h.x, h.y, eff.range)) {
          const d = dist(h, u);
          if (d > h.r + u.r + 8 && Math.abs(angDiff(Math.atan2(u.y - h.y, u.x - h.x), a)) > half + Math.asin(Math.min(1, u.r / d))) continue;
          this.applyHit(h, u, eff, amount);
        }
        this.addFx({ type: 'arc', x: h.x, y: h.y, a, range: eff.range, half, color: h.def.color, dur: 0.2 });
        break;
      }
      case 'projectile': {
        const ang = a + ((eff.jitter || 0) * (this.rand() - 0.5) * 2 * Math.PI) / 180;
        this.projectiles.push({ x: h.x + Math.cos(ang) * h.r, y: h.y + Math.sin(ang) * h.r, vx: Math.cos(ang) * eff.speed, vy: Math.sin(ang) * eff.speed,
          team: h.team, owner: h, amount: this.dmgOf(h, eff.dmg), radius: eff.radius, left: eff.range, eff, hit: new Set(), color: eff.color || h.def.color });
        break;
      }
      case 'dash': {
        let ang = a;
        if (eff.toMove && (h.intent.mx || h.intent.my)) ang = Math.atan2(h.intent.my, h.intent.mx);
        const v = eff.dist / eff.dur;
        h.dash = { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t: eff.dur, eff, hit: new Set(), amount: eff.hit ? this.dmgOf(h, eff.hit.dmg) : 0 };
        if (eff.invuln) h.invulnT = Math.max(h.invulnT, eff.dur + 0.06);
        if (eff.dist > 100) this.addFx({ type: 'trail', x: h.x, y: h.y, a: ang, len: eff.dist, color: h.def.color, dur: 0.3 });
        break;
      }
      case 'aoe': {
        let p = { x: h.x, y: h.y };
        if (eff.at === 'cursor') p = this.cursorPoint(h, eff.maxRange);
        else if (eff.at === 'front') p = { x: h.x + Math.cos(a) * eff.maxRange, y: h.y + Math.sin(a) * eff.maxRange };
        const z = { x: p.x, y: p.y, radius: eff.radius, start: this.time, at: this.time + (eff.delay || 0), team: h.team, owner: h, eff, amount: this.dmgOf(h, eff.dmg), color: h.def.color };
        if (eff.delay) this.zones.push(z); else this.resolveZone(z);
        break;
      }
      case 'blink': {
        const p = this.cursorPoint(h, eff.dist);
        const ang = Math.atan2(p.y - h.y, p.x - h.x);
        let d = Math.hypot(p.x - h.x, p.y - h.y);
        while (d > 0 && this.inWall(h.x + Math.cos(ang) * d, h.y + Math.sin(ang) * d, h.r)) d -= 20;
        d = Math.max(0, d);
        this.addFx({ type: 'blink', x: h.x, y: h.y, color: h.def.color, dur: 0.4 });
        h.x += Math.cos(ang) * d; h.y += Math.sin(ang) * d;
        this.addFx({ type: 'blink', x: h.x, y: h.y, color: h.def.color, dur: 0.4 });
        break;
      }
      case 'buff': {
        h.buffs.push({ t: eff.dur, mods: eff.mods, fx: eff.fx });
        if (eff.heal) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * eff.heal);
        break;
      }
      case 'telegraph':
        this.addFx({ type: 'line', x: h.x, y: h.y, a, len: eff.len, width: eff.width, color: h.def.color, team: h.team, dur: eff.dur });
        break;
    }
  }

  resolveZone(z) {
    for (const u of this.enemiesIn(z.team, z.x, z.y, z.radius)) this.applyHit(z.owner, u, z.eff, z.amount);
    this.addFx({ type: z.eff.fx || 'boom', x: z.x, y: z.y, radius: z.radius, color: z.color, dur: z.eff.fx === 'spin' ? 0.22 : 0.45 });
  }

  // ───────── 틱 ─────────
  step(dt) {
    if (this.over !== null) { this.ageFx(dt); return; }
    this.time += dt;

    this.waveT -= dt;
    if (this.waveT <= 0) {
      this.waveT = RULES.waveInterval;
      for (const team of [0, 1]) for (const lane of ['top', 'bot']) for (let i = 0; i < RULES.minionsPerWave; i++) this.addMinion(team, lane, (i - 1) * 55);
    }

    if (this.timers.length) {
      const due = this.timers.filter((t) => t.t <= this.time);
      if (due.length) { this.timers = this.timers.filter((t) => t.t > this.time); for (const t of due) t.run(); }
    }

    for (const u of this.units) {
      if (u.flashT > 0) u.flashT -= dt;
      if (u.cd > 0) u.cd -= dt;
      if (!u.alive) { if (u.kind === 'hero') this.updateDead(u, dt); continue; }
      const px = u.x, py = u.y;
      if (u.stunT > 0) u.stunT -= dt;
      if (u.invulnT > 0) u.invulnT -= dt;
      if (u.slows.length) { for (const s of u.slows) s.t -= dt; u.slows = u.slows.filter((s) => s.t > 0); }
      if (u.buffs.length) { for (const b of u.buffs) b.t -= dt; u.buffs = u.buffs.filter((b) => b.t > 0); }
      if (u.kind === 'hero') this.updateHero(u, dt);
      else if (u.kind === 'minion') this.updateMinion(u, dt);
      else this.updateStruct(u, dt);
      if (!u.struct) { this.collide(u); u.vx = (u.x - px) / dt; u.vy = (u.y - py) / dt; }
    }
    this.separate();
    this.updateProjectiles(dt);

    if (this.zones.length) {
      const due = this.zones.filter((z) => z.at <= this.time);
      if (due.length) { this.zones = this.zones.filter((z) => z.at > this.time); for (const z of due) this.resolveZone(z); }
    }
    if (this.units.some((u) => !u.alive && u.kind === 'minion')) this.units = this.units.filter((u) => u.alive || u.kind !== 'minion');
    this.ageFx(dt);
  }

  ageFx(dt) {
    let dead = false;
    for (const f of this.fx) { f.t += dt; if (f.t >= f.dur) dead = true; }
    if (dead) this.fx = this.fx.filter((f) => f.t < f.dur);
  }

  updateDead(h, dt) {
    h.respawnT -= dt;
    if (h.respawnT <= 0) {
      h.alive = true; h.hp = h.maxHp; h.x = h.spawn.x; h.y = h.spawn.y; h.invulnT = 1.5; h.vx = h.vy = 0;
      if (h.ai) { h.ai.retreat = false; h.ai.target = null; if (this.rand() < 0.35) h.lane = h.lane === 'top' ? 'bot' : 'top'; }
    }
  }

  updateHero(h, dt) {
    for (const s of SLOT_ORDER) if (h.cds[s] > 0) h.cds[s] -= dt;
    if (h.lockT > 0) h.lockT -= dt;
    const core = MAP.cores[h.team];
    if (Math.hypot(h.x - core.x, h.y - core.y) < MAP.fountainRadius) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * RULES.fountainHeal * dt);
    else if (this.time - h.lastDamagedT > 6) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * RULES.outOfCombatRegen * dt);

    if (h.dash) {
      const d = h.dash;
      const stepT = Math.min(dt, d.t);
      h.x += d.vx * stepT; h.y += d.vy * stepT; d.t -= dt;
      if (d.eff.hit) {
        for (const u of this.enemiesIn(h.team, h.x, h.y, d.eff.hit.radius)) {
          if (d.hit.has(u.id)) continue;
          d.hit.add(u.id);
          this.applyHit(h, u, d.eff.hit, d.amount);
        }
      }
      if (d.t <= 0) h.dash = null;
      return;
    }
    if (h.stunT > 0) return;
    const it = h.intent;
    h.face = Math.atan2(it.aimY - h.y, it.aimX - h.x);
    for (const slot of CAST_PRIORITY) {
      if (it.cast[slot] && this.canCast(h, slot)) { this.cast(h, slot); break; }
    }
    if (h.dash) return;
    if (h.lockT > 0 && !h.lockMove) return;
    const m = Math.hypot(it.mx, it.my);
    if (m > 0.01) {
      const sp = h.speed * this.speedMul(h);
      h.x += (it.mx / m) * sp * dt; h.y += (it.my / m) * sp * dt;
    }
  }

  pickTarget(u, range, preferMinion) {
    let best = null, bd = Infinity;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      if (e.struct && !this.vulnerable(e)) continue;
      let d = dist(u, e) - e.r;
      if (d > range) continue;
      if (preferMinion && e.kind === 'hero') d += e.aggroT > this.time - 2 ? -2000 : 2000; // 아군 영웅을 친 적 영웅은 최우선
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateMinion(m, dt) {
    if (m.stunT > 0) return;
    m.scanT -= dt;
    if (m.scanT <= 0 || (m.target && !m.target.alive)) {
      m.scanT = 0.35;
      m.target = this.pickTarget(m, MINION.aggro, false);
    }
    const sp = m.speed * this.speedMul(m) * dt;
    const t = m.target;
    if (t) {
      const d = dist(m, t);
      m.face = Math.atan2(t.y - m.y, t.x - m.x);
      if (d - t.r - m.r <= MINION.range - 40) {
        if (m.cd <= 0) { m.cd = MINION.cd; this.damage(m, t, m.atk); this.addFx({ type: 'hit', x: t.x, y: t.y, a: m.face, color: '#ffffff', dur: 0.15 }); }
      } else { m.x += Math.cos(m.face) * sp; m.y += Math.sin(m.face) * sp; }
      return;
    }
    const wp = m.path[Math.min(m.wp, m.path.length - 1)];
    const dx = wp[0] - m.x, dy = wp[1] - m.y, d = Math.hypot(dx, dy);
    if (d < 90 && m.wp < m.path.length - 1) { m.wp++; return; }
    if (d > 150 || m.wp < m.path.length - 1) { m.face = Math.atan2(dy, dx); m.x += (dx / d) * sp; m.y += (dy / d) * sp; }
  }

  updateStruct(s, dt) {
    s.scanT -= dt;
    const range = s.def.range;
    if (s.scanT <= 0 || (s.target && (!s.target.alive || dist(s, s.target) - s.target.r > range))) {
      s.scanT = 0.25;
      const keep = s.target && s.target.alive && dist(s, s.target) - s.target.r <= range && s.target.kind !== 'hero';
      if (!keep) s.target = this.pickTarget(s, range, true);
    }
    if (s.target && s.cd <= 0) {
      s.cd = s.def.cd;
      this.addFx({ type: 'beam', x: s.x, y: s.y, x2: s.target.x, y2: s.target.y, team: s.team, dur: 0.22 });
      this.damage(s, s.target, s.atk * (s.target.kind === 'minion' ? 1.6 : 1));
    }
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const sx = p.vx * dt, sy = p.vy * dt;
      p.x += sx; p.y += sy; p.left -= Math.hypot(sx, sy);
      let done = p.left <= 0 || this.inWall(p.x, p.y) || p.x < 0 || p.y < 0 || p.x > MAP.w || p.y > MAP.h;
      if (!done) {
        for (const u of this.enemiesIn(p.team, p.x, p.y, p.radius)) {
          if (p.hit.has(u.id) || u.invulnT > 0) continue;
          p.hit.add(u.id);
          if (p.eff.explode) { done = true; break; }
          this.applyHit(p.owner, u, p.eff, p.amount);
          this.addFx({ type: 'hit', x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx), color: p.color, dur: 0.18 });
          if (!p.eff.pierce) { done = true; break; }
        }
      }
      if (done) {
        p.dead = true;
        if (p.eff.explode && p.left > -1) {
          for (const u of this.enemiesIn(p.team, p.x, p.y, p.eff.explode)) this.applyHit(p.owner, u, p.eff, p.amount);
          this.addFx({ type: 'boom', x: p.x, y: p.y, radius: p.eff.explode, color: p.color, dur: 0.3 });
        }
      }
    }
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ───────── 충돌 ─────────
  collide(u) {
    for (const [wx, wy, ww, wh] of MAP.walls) {
      const cx = clamp(u.x, wx, wx + ww), cy = clamp(u.y, wy, wy + wh);
      let dx = u.x - cx, dy = u.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= u.r * u.r) continue;
      if (d2 > 0.0001) { const d = Math.sqrt(d2); u.x = cx + (dx / d) * u.r; u.y = cy + (dy / d) * u.r; }
      else { // 중심이 벽 안: 가장 가까운 면으로 밀어낸다
        const l = u.x - wx, r = wx + ww - u.x, t = u.y - wy, b = wy + wh - u.y, m = Math.min(l, r, t, b);
        if (m === l) u.x = wx - u.r; else if (m === r) u.x = wx + ww + u.r; else if (m === t) u.y = wy - u.r; else u.y = wy + wh + u.r;
      }
    }
    for (const s of this.units) {
      if (!s.struct || !s.alive) continue;
      const dx = u.x - s.x, dy = u.y - s.y, d = Math.hypot(dx, dy) || 0.01, min = u.r + s.r * 0.85;
      if (d < min) { u.x = s.x + (dx / d) * min; u.y = s.y + (dy / d) * min; }
    }
    u.x = clamp(u.x, u.r, MAP.w - u.r); u.y = clamp(u.y, u.r, MAP.h - u.r);
  }

  separate() {
    const mob = this.units.filter((u) => u.alive && !u.struct && !u.dash);
    for (let i = 0; i < mob.length; i++) {
      for (let j = i + 1; j < mob.length; j++) {
        const a = mob[i], b = mob[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.9;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
        const wa = a.kind === 'hero' && b.kind === 'minion' ? 0.3 : 0.5; // 영웅은 미니언에 덜 밀린다
        a.x -= nx * push * wa * 2; a.y -= ny * push * wa * 2;
        b.x += nx * push * (1 - wa) * 2; b.y += ny * push * (1 - wa) * 2;
      }
    }
  }
}
