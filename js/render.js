// 캔버스 렌더러. 이미지 에셋이 없으면 도형으로 대체 렌더링한다 (에셋 교체/추가에 안전).
import { MAP, TEAM_COLOR, ASSETS } from './data.js';

const TAU = Math.PI * 2;

// 반환값: 키 → { img, sx, sy, sw, sh } (시트면 해당 칸의 영역)
export function loadAssets(onProgress) {
  const out = {};
  const keys = Object.keys(ASSETS).filter((k) => ASSETS[k]);
  const srcs = [...new Set(keys.map((k) => ASSETS[k].src || ASSETS[k]))];
  if (!srcs.length) return Promise.resolve(out);
  let done = 0;
  const imgs = {};
  return Promise.all(srcs.map((src) => new Promise((res) => {
    const img = new Image();
    const fin = (ok) => { if (ok) imgs[src] = img; onProgress && onProgress(++done / srcs.length); res(); };
    img.onload = () => fin(true); img.onerror = () => fin(false);
    img.src = src;
  }))).then(() => {
    for (const k of keys) {
      const a = ASSETS[k], img = imgs[a.src || a];
      if (!img) continue;
      if (a.grid) { const sw = img.width / a.grid[0], sh = img.height / a.grid[1]; out[k] = { img, sx: a.cell[0] * sw, sy: a.cell[1] * sh, sw, sh }; }
      else out[k] = { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
    }
    return out;
  });
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class Renderer {
  constructor(canvas, minimap, assets) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.mini = minimap; this.mctx = minimap.getContext('2d');
    this.assets = assets;
    this.cam = { x: MAP.w / 2, y: MAP.h / 2, zoom: 1, shake: 0 };
    this.pattern = null;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * dpr); this.canvas.height = Math.round(this.vh * dpr);
    this.cam.zoom = Math.max(this.vh / 1150, this.vw / 2100);
  }

  screenToWorld(sx, sy) {
    return { x: this.cam.x + (sx - this.vw / 2) / this.cam.zoom, y: this.cam.y + (sy - this.vh / 2) / this.cam.zoom };
  }

  follow(target, mouse, dt) {
    const c = this.cam;
    const tx = target.x + ((mouse.x - this.vw / 2) / c.zoom) * 0.22;
    const ty = target.y + ((mouse.y - this.vh / 2) / c.zoom) * 0.22;
    const k = 1 - Math.exp(-dt * 9);
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
    const hw = this.vw / 2 / c.zoom, hh = this.vh / 2 / c.zoom;
    c.x = Math.max(hw - 200, Math.min(MAP.w - hw + 200, c.x));
    c.y = Math.max(hh - 200, Math.min(MAP.h - hh + 200, c.y));
    if (c.shake > 0) c.shake = Math.max(0, c.shake - dt * 30);
  }

  draw(world, player) {
    const ctx = this.ctx, c = this.cam, z = c.zoom * this.dpr;
    const shx = c.shake ? (Math.random() - 0.5) * c.shake : 0, shy = c.shake ? (Math.random() - 0.5) * c.shake : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z, 0, 0, z, this.canvas.width / 2 - (c.x + shx) * z, this.canvas.height / 2 - (c.y + shy) * z);
    const hw = this.vw / 2 / c.zoom + 150, hh = this.vh / 2 / c.zoom + 150;
    const vis = (u, pad = 0) => Math.abs(u.x - c.x) < hw + pad && Math.abs(u.y - c.y) < hh + pad;
    this.time = world.time;

    this.drawGround(ctx);
    this.drawZones(ctx, world, player);
    for (const f of world.fx) if (f.type === 'line' || f.type === 'trail') this.drawFx(ctx, f, world, player);

    for (const u of world.units) if (u.struct && vis(u, 700)) this.drawStruct(ctx, u, world, player);
    for (const u of world.units) if (u.alive && u.kind === 'minion' && vis(u)) this.drawMinion(ctx, u);
    for (const h of world.heroes) if (h.alive && vis(h)) this.drawHero(ctx, h, player);

    for (const p of world.projectiles) {
      const a = Math.atan2(p.vy, p.vx), len = Math.min(70, p.radius * 5);
      ctx.strokeStyle = rgba(p.color, 0.5); ctx.lineWidth = p.radius * 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.shadowColor = p.color; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.8, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const f of world.fx) if (f.type !== 'line' && f.type !== 'trail') this.drawFx(ctx, f, world, player);
    this.drawMinimap(world, player);
  }

  drawGround(ctx) {
    const g = this.assets.ground;
    if (g && !this.pattern) {
      this.pattern = ctx.createPattern(g.img, 'repeat');
      const s = 640 / g.img.width;
      if (this.pattern.setTransform) this.pattern.setTransform(new DOMMatrix().scale(s, s));
    }
    ctx.fillStyle = this.pattern || '#141b27';
    ctx.fillRect(0, 0, MAP.w, MAP.h);
    ctx.fillStyle = 'rgba(6,10,18,0.45)';
    ctx.fillRect(0, 0, MAP.w, MAP.h);
    // 진영 색 물들이기
    for (const team of [0, 1]) {
      const core = MAP.cores[team];
      const gr = ctx.createRadialGradient(core.x, core.y, 80, core.x, core.y, 1700);
      gr.addColorStop(0, rgba(TEAM_COLOR[team], 0.22)); gr.addColorStop(1, rgba(TEAM_COLOR[team], 0));
      ctx.fillStyle = gr; ctx.fillRect(team === 0 ? 0 : MAP.w - 1800, 0, 1800, MAP.h);
      ctx.strokeStyle = rgba(TEAM_COLOR[team], 0.35); ctx.lineWidth = 4; ctx.setLineDash([18, 14]);
      ctx.beginPath(); ctx.arc(core.x, core.y, MAP.fountainRadius, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // 라인
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const lane of Object.values(MAP.lanes)) {
      const path = () => { ctx.beginPath(); lane.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
      path(); ctx.strokeStyle = 'rgba(150,190,230,0.10)'; ctx.lineWidth = MAP.laneWidth; ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(160,210,255,0.10)'; ctx.lineWidth = 6; ctx.setLineDash([40, 50]); ctx.stroke(); ctx.setLineDash([]);
    }
    // 벽
    for (const [x, y, w, h] of MAP.walls) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 10, y + 16, w, h);
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#2a3550'); gr.addColorStop(1, '#141b2c');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#5d7bb0'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
    }
    ctx.strokeStyle = '#33405c'; ctx.lineWidth = 12; ctx.strokeRect(-6, -6, MAP.w + 12, MAP.h + 12);
  }

  drawZones(ctx, world, player) {
    for (const zn of world.zones) {
      const enemy = zn.team !== player.team;
      const col = enemy ? '#ff4d5e' : zn.color;
      const k = Math.min(1, (world.time - zn.start) / (zn.at - zn.start));
      ctx.fillStyle = rgba(col, 0.13); ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.radius, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col, 0.25); ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.radius * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.radius, 0, TAU); ctx.stroke();
    }
  }

  hpBar(ctx, x, y, w, h, pct, color, back = 'rgba(0,0,0,0.65)') {
    ctx.fillStyle = back; ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * Math.max(0, pct), h);
  }

  sprite(ctx, a, x, y, size, rot) {
    const s = size / Math.max(a.sw, a.sh);
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, (-a.sw * s) / 2, (-a.sh * s) / 2, a.sw * s, a.sh * s);
    ctx.restore();
  }

  drawStruct(ctx, s, world, player) {
    const col = TEAM_COLOR[s.team];
    const img = this.assets[(s.kind === 'core' ? 'core' : 'tower') + s.team];
    if (!s.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,150,0.5)'; ctx.lineWidth = 4; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    // 적 건물 사거리 표시 (플레이어가 근처일 때)
    if (s.team !== player.team && Math.hypot(player.x - s.x, player.y - s.y) < s.def.range + 380) {
      const hot = s.target === player;
      ctx.strokeStyle = rgba(hot ? '#ffdd55' : col, hot ? 0.9 : 0.35); ctx.lineWidth = hot ? 5 : 3; ctx.setLineDash([16, 12]);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.def.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = rgba(col, 0.04); ctx.beginPath(); ctx.arc(s.x, s.y, s.def.range, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(s.x + 8, s.y + 14, s.r * 1.15, s.r * 1.05, 0, 0, TAU); ctx.fill();
    if (img) this.sprite(ctx, img, s.x, s.y, s.r * 2.7, 0);
    else {
      ctx.fillStyle = '#1b2436'; ctx.strokeStyle = col; ctx.lineWidth = 6;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.52; ctx.lineTo(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (s.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    const vul = world.vulnerable(s);
    this.hpBar(ctx, s.x, s.y - s.r - 34, s.r * 2.2, 12, s.hp / s.maxHp, vul ? col : '#77808f');
    if (!vul) { ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8d1df'; ctx.fillText('🛡 보호 중', s.x, s.y - s.r - 44); }
  }

  drawMinion(ctx, m) {
    const col = TEAM_COLOR[m.team], img = this.assets['minion' + m.team];
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(m.x + 3, m.y + 6, m.r, m.r * 0.9, 0, 0, TAU); ctx.fill();
    if (img) this.sprite(ctx, img, m.x, m.y, m.r * 2.9, m.face);
    else {
      ctx.fillStyle = '#1d2536'; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x + Math.cos(m.face) * m.r * 0.5, m.y + Math.sin(m.face) * m.r * 0.5, 5, 0, TAU); ctx.fill();
    }
    if (m.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); }
    this.hpBar(ctx, m.x, m.y - m.r - 14, 40, 5, m.hp / m.maxHp, col);
  }

  drawHero(ctx, h, player) {
    const col = TEAM_COLOR[h.team], img = this.assets['hero_' + h.def.id];
    // 발밑 진영 링
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(h.x + 4, h.y + 8, h.r * 1.2, h.r * 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = h === player ? 5 : 3.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 9, 0, TAU); ctx.stroke();
    if (h === player) { // 조준 방향 표시
      ctx.fillStyle = rgba(col, 0.9); const a = h.face, d = h.r + 20;
      ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * (d + 14), h.y + Math.sin(a) * (d + 14));
      ctx.lineTo(h.x + Math.cos(a + 0.35) * d, h.y + Math.sin(a + 0.35) * d); ctx.lineTo(h.x + Math.cos(a - 0.35) * d, h.y + Math.sin(a - 0.35) * d); ctx.fill();
    }
    ctx.globalAlpha = h.invulnT > 0 ? 0.55 : 1;
    if (img) this.sprite(ctx, img, h.x, h.y, h.def.sprite, h.face + (h.def.spriteRot || 0));
    else {
      ctx.fillStyle = h.def.color; ctx.strokeStyle = '#0b0f18'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(h.face) * (h.r + 22), h.y + Math.sin(h.face) * (h.r + 22)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (h.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 4, 0, TAU); ctx.fill(); }
    for (const b of h.buffs) if (b.fx === 'shield') { ctx.strokeStyle = rgba('#ffd24a', 0.85); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 18 + Math.sin(this.time * 8) * 2, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba('#ffd24a', 0.12); ctx.fill(); }
    if (h.slows.length) { ctx.strokeStyle = 'rgba(140,200,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    // 머리 위 정보
    const top = h.y - h.def.sprite * 0.5 - 16;
    this.hpBar(ctx, h.x, top, 86, 9, h.hp / h.maxHp, h === player ? '#5dfc8a' : col);
    ctx.font = 'bold 17px "Segoe UI", "Malgun Gothic", sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#fff';
    const label = `Lv.${h.level} ${h.name}`;
    ctx.strokeText(label, h.x, top - 9); ctx.fillText(label, h.x, top - 9);
    if (h.stunT > 0) { ctx.fillStyle = '#ffe24a'; ctx.font = 'bold 22px sans-serif'; ctx.strokeText('★ 기절', h.x, top - 32); ctx.fillText('★ 기절', h.x, top - 32); }
  }

  drawFx(ctx, f, world, player) {
    const k = f.t / f.dur, inv = 1 - k;
    switch (f.type) {
      case 'arc': {
        ctx.fillStyle = rgba(f.color, 0.45 * inv);
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.range, f.a - f.half, f.a + f.half); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.9 * inv); ctx.lineWidth = 9 * inv + 2;
        const sweep = f.a - f.half + f.half * 2 * Math.min(1, k * 1.8);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.range * 0.92, f.a - f.half, sweep); ctx.stroke();
        break;
      }
      case 'spin': {
        ctx.strokeStyle = rgba(f.color, 0.8 * inv); ctx.lineWidth = 14;
        const a0 = world.time * 22;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.radius * 0.85, a0, a0 + 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.radius * 0.85, a0 + Math.PI, a0 + Math.PI + 2.2); ctx.stroke();
        break;
      }
      case 'boom': case 'frost': case 'quake': case 'meteor': {
        const col = f.type === 'frost' ? '#8fd8ff' : f.color;
        const r = f.radius * (0.55 + 0.45 * Math.min(1, k * 2));
        ctx.fillStyle = rgba(col, 0.42 * inv); ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.9 * inv); ctx.lineWidth = 10 * inv + 1; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
        if (f.type === 'quake' || f.type === 'meteor') {
          ctx.strokeStyle = rgba(col, 0.8 * inv); ctx.lineWidth = 5;
          for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r * 0.25, f.y + Math.sin(a) * r * 0.25); ctx.lineTo(f.x + Math.cos(a + 0.12) * r * 0.95, f.y + Math.sin(a + 0.12) * r * 0.95); ctx.stroke(); }
          if (f.t < 0.05 && Math.hypot(player.x - f.x, player.y - f.y) < 900) this.cam.shake = 16;
        }
        break;
      }
      case 'hit': {
        ctx.strokeStyle = rgba(f.color, inv); ctx.lineWidth = 4;
        for (let i = -1; i <= 1; i++) { const a = f.a + Math.PI + i * 0.7; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * 8, f.y + Math.sin(a) * 8); ctx.lineTo(f.x + Math.cos(a) * (18 + 30 * k), f.y + Math.sin(a) * (18 + 30 * k)); ctx.stroke(); }
        break;
      }
      case 'beam': {
        const col = TEAM_COLOR[f.team];
        ctx.strokeStyle = rgba(col, 0.9 * inv); ctx.lineWidth = 9 * inv + 2; ctx.shadowColor = col; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', inv); ctx.lineWidth = 3; ctx.stroke(); ctx.shadowBlur = 0;
        break;
      }
      case 'trail': {
        ctx.strokeStyle = rgba(f.color, 0.55 * inv); ctx.lineWidth = 34 * inv + 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len); ctx.stroke();
        break;
      }
      case 'line': {
        const col = f.team !== player.team ? '#ff4d5e' : f.color;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
        ctx.fillStyle = rgba(col, 0.16); ctx.fillRect(0, -f.width / 2, f.len, f.width);
        ctx.fillStyle = rgba(col, 0.3); ctx.fillRect(0, -f.width / 2, f.len * k, f.width);
        ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3; ctx.strokeRect(0, -f.width / 2, f.len, f.width);
        ctx.restore();
        break;
      }
      case 'blink': {
        ctx.strokeStyle = rgba(f.color, inv); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, 20 + 50 * k, 0, TAU); ctx.stroke();
        break;
      }
      case 'levelup': case 'ultcast': {
        const u = world.heroes.find((h) => h.id === f.follow); const x = u ? u.x : f.x, y = u ? u.y : f.y;
        const col = f.type === 'levelup' ? '#ffe680' : f.color;
        ctx.strokeStyle = rgba(col, inv); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 30 + 90 * k, 0, TAU); ctx.stroke();
        if (f.type === 'levelup') { ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = rgba('#ffe680', inv); ctx.fillText('LEVEL UP', x, y - 80 - 30 * k); }
        break;
      }
      case 'num': {
        const mine = f.srcId === player.id || f.tgtId === player.id || !f.srcId;
        if (!mine && f.text !== '무적') break;
        ctx.font = `bold ${f.tgtId === player.id ? 24 : 21}px "Segoe UI", sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(0,0,0,${0.8 * inv})`; ctx.fillStyle = rgba(f.srcId === player.id ? '#ffe9a6' : f.color, Math.min(1, inv * 1.6));
        ctx.strokeText(f.text, f.x, f.y - 40 * k); ctx.fillText(f.text, f.x, f.y - 40 * k);
        break;
      }
    }
  }

  drawMinimap(world, player) {
    const m = this.mctx, W = this.mini.width, H = this.mini.height, sx = W / MAP.w, sy = H / MAP.h;
    m.fillStyle = 'rgba(8,12,20,0.92)'; m.fillRect(0, 0, W, H);
    m.lineCap = 'round'; m.lineJoin = 'round'; m.strokeStyle = 'rgba(150,190,230,0.22)'; m.lineWidth = 9;
    for (const lane of Object.values(MAP.lanes)) { m.beginPath(); lane.forEach(([x, y], i) => (i ? m.lineTo(x * sx, y * sy) : m.moveTo(x * sx, y * sy))); m.stroke(); }
    m.fillStyle = '#3a4866';
    for (const [x, y, w, h] of MAP.walls) m.fillRect(x * sx, y * sy, w * sx, h * sy);
    for (const u of world.units) {
      if (!u.alive) continue;
      m.fillStyle = TEAM_COLOR[u.team];
      if (u.kind === 'minion') m.fillRect(u.x * sx - 1.5, u.y * sy - 1.5, 3, 3);
      else if (u.kind === 'tower') m.fillRect(u.x * sx - 4, u.y * sy - 4, 8, 8);
      else if (u.kind === 'core') { m.beginPath(); m.arc(u.x * sx, u.y * sy, 8, 0, TAU); m.fill(); }
    }
    for (const h of world.heroes) {
      if (!h.alive) continue;
      m.fillStyle = h === player ? '#5dfc8a' : TEAM_COLOR[h.team]; m.strokeStyle = '#fff'; m.lineWidth = 1.5;
      m.beginPath(); m.arc(h.x * sx, h.y * sy, h === player ? 6 : 5, 0, TAU); m.fill(); m.stroke();
    }
    const c = this.cam, vw = (this.vw / c.zoom) * sx, vh = (this.vh / c.zoom) * sy;
    m.strokeStyle = 'rgba(255,255,255,0.7)'; m.lineWidth = 1; m.strokeRect(c.x * sx - vw / 2, c.y * sy - vh / 2, vw, vh);
  }
}
