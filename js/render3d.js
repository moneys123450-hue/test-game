// 3D 렌더러 (Three.js). 시뮬레이션(world.js)은 2D 평면 그대로이고, 이 파일이 XZ 평면에 올려 그린다.
// 시뮬레이션 좌표 (x, y) → 3D (x*S, 높이, y*S). 시뮬레이션 각도 a → 방향 (cos a, 0, sin a), rotation.y = -a.
import * as THREE from '../vendor/three.module.min.js';
import { MAP, TEAM_COLOR, MINION, ASSETS } from './data.js';
import { S, buildHero, buildMinion, buildStruct } from './models.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WALL_H = 2.8;

const GEO = {
  ring: new THREE.RingGeometry(0.93, 1, 56),
  disc: new THREE.CircleGeometry(1, 40),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
  plane: new THREE.PlaneGeometry(1, 1),
};
const fxMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function flat(geo, mat, y = 0.06) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; }

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2231'; g.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 26 + Math.floor(rnd() * 14);
    g.fillStyle = `rgb(${v},${v + 7},${v + 20})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
  }
  g.strokeStyle = 'rgba(90,210,230,0.16)'; g.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const x = Math.floor(rnd() * 4) * 128 + 20 + rnd() * 80, y = Math.floor(rnd() * 4) * 128 + 20 + rnd() * 80; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 30, y + 18); g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},255,${rnd() * 0.035})`; g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 5, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function laneTexture() {
  const W = 1024, H = Math.round((1024 * MAP.h) / MAP.w), k = W / MAP.w;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  for (const team of [0, 1]) {
    const core = MAP.cores[team], gr = g.createRadialGradient(core.x * k, core.y * k, 10, core.x * k, core.y * k, 1500 * k);
    gr.addColorStop(0, TEAM_COLOR[team] + '66'); gr.addColorStop(1, TEAM_COLOR[team] + '00');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = TEAM_COLOR[team] + 'cc'; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.beginPath(); g.arc(core.x * k, core.y * k, MAP.fountainRadius * k, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  g.lineJoin = g.lineCap = 'round';
  for (const lane of Object.values(MAP.lanes)) {
    const path = () => { g.beginPath(); lane.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); };
    path(); g.strokeStyle = 'rgba(170,205,240,0.20)'; g.lineWidth = MAP.laneWidth * k; g.stroke();
    path(); g.strokeStyle = 'rgba(190,225,255,0.35)'; g.lineWidth = 2; g.setLineDash([10, 12]); g.stroke(); g.setLineDash([]);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#070a18'); gr.addColorStop(0.55, '#161634'); gr.addColorStop(0.85, '#3a2348'); gr.addColorStop(1, '#5a2f4a');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Renderer3D {
  constructor(canvas, overlay, opts = {}) {
    this.canvas = canvas; this.overlay = overlay; this.octx = overlay.getContext('2d');
    this.low = !!opts.low;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.FogExp2(0x1a1730, 0.011);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.2, 400);
    this.view = { yaw: 0, pitch: 0.3 };
    this.pivot = new THREE.Vector3();
    this.shake = 0; this.time = 0;
    this.dyn = new THREE.Group(); this.scene.add(this.dyn);
    this.maps = { hero: new Map(), minion: new Map(), struct: new Map(), proj: new Map(), zone: new Map(), fx: new Map() };
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
    this.buildStatic();
    this.resize();
  }

  // ───────── 고정 지형 ─────────
  buildStatic() {
    const sc = this.scene, W = MAP.w * S, H = MAP.h * S;
    sc.add(new THREE.HemisphereLight(0xb4c4ff, 0x2a2238, 1.9));
    const sun = new THREE.DirectionalLight(0xffe6cf, 1.9);
    sun.castShadow = true; sun.shadow.mapSize.setScalar(this.low ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    sc.add(sun, sun.target); this.sun = sun;

    const gt = groundTexture(); gt.repeat.set((W + 160) / 8, (H + 160) / 8);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 160, H + 160), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.82, metalness: 0.15 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(W / 2, 0, H / 2); this.ground.receiveShadow = true; sc.add(this.ground);
    if (ASSETS.ground) this.tryGroundImage(typeof ASSETS.ground === 'string' ? ASSETS.ground : ASSETS.ground.src, (W + 160) / 12, (H + 160) / 12);
    const lanes = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: laneTexture(), transparent: true, depthWrite: false }));
    lanes.rotation.x = -Math.PI / 2; lanes.position.set(W / 2, 0.02, H / 2); sc.add(lanes);

    const wallM = new THREE.MeshStandardMaterial({ color: '#46557e', roughness: 0.65, metalness: 0.25, flatShading: true });
    const edgeM = new THREE.LineBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.55 });
    const addBox = (x, z, w, d, h, mat = wallM, edges = true) => {
      const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, mat);
      m.position.set(x + w / 2, h / 2, z + d / 2); m.castShadow = m.receiveShadow = true; sc.add(m);
      if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeM); e.position.copy(m.position); sc.add(e); }
    };
    for (const [x, y, w, h] of MAP.walls) addBox(x * S, y * S, w * S, h * S, WALL_H);
    const b = 1.2;
    addBox(-b, -b, W + b * 2, b, 4); addBox(-b, H, W + b * 2, b, 4); addBox(-b, 0, b, H, 4); addBox(W, 0, b, H, 4);

    // 맵 바깥의 폐허 도시 실루엣
    let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cityM = new THREE.MeshStandardMaterial({ color: '#222a44', roughness: 0.9, flatShading: true });
    const winM = [new THREE.MeshBasicMaterial({ color: 0x3fb6ff }), new THREE.MeshBasicMaterial({ color: 0xff4d5e }), new THREE.MeshBasicMaterial({ color: 0xffc070 })];
    for (let i = 0; i < 90; i++) {
      const side = i % 4, t = rnd(), off = 8 + rnd() * 45, w = 5 + rnd() * 9, d = 5 + rnd() * 9, h = 7 + rnd() * rnd() * 46;
      const x = side < 2 ? t * (W + 80) - 40 : side === 2 ? -off - w : W + off, z = side === 0 ? -off - d : side === 1 ? H + off : t * (H + 80) - 40;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityM); m.position.set(x + w / 2, h / 2, z + d / 2); sc.add(m);
      if (rnd() < 0.6) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.25, d * 1.01), winM[x < W / 2 ? (rnd() < 0.8 ? 0 : 2) : (rnd() < 0.8 ? 1 : 2)]); s2.position.set(x + w / 2, h * (0.4 + rnd() * 0.5), z + d / 2); sc.add(s2); }
    }

    // 조준 표시
    this.aimRing = flat(GEO.ring, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 0.07);
    this.aimRing.scale.setScalar(0.45); sc.add(this.aimRing);
  }

  // Higgsfield 바닥 이미지는 교차 출처라 CORS 가 허용될 때만 텍스처로 쓸 수 있다. 실패하면 코드로 그린 바닥을 유지한다.
  tryGroundImage(src, rx, ry) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(rx, ry); t.needsUpdate = true; this.ground.material.map = t; this.ground.material.needsUpdate = true; };
    img.src = src;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.low ? 1.25 : 2);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.gl.setPixelRatio(dpr); this.gl.setSize(this.vw, this.vh, false);
    this.camera.aspect = this.vw / this.vh; this.camera.updateProjectionMatrix();
    this.odpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(this.vw * this.odpr); this.overlay.height = Math.round(this.vh * this.odpr);
  }

  // 새 게임: 이전 판의 동적 오브젝트를 모두 치운다
  setWorld(world) {
    for (const m of Object.values(this.maps)) m.clear();
    for (const c of [...this.dyn.children]) { this.dyn.remove(c); c.traverse((o) => { if (o.material && o.userData.own) o.material.dispose(); }); }
    this.structAt = {};
    for (const s of world.units) {
      if (!s.struct) continue;
      const m = buildStruct(s, !this.low); this.dyn.add(m.root); this.maps.struct.set(s.id, m); this.structAt[s.x + ',' + s.y] = m;
      m.range = flat(new THREE.RingGeometry(s.def.range * S - 0.12, s.def.range * S, 96), new THREE.MeshBasicMaterial({ color: TEAM_COLOR[s.team], transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), 0.05);
      m.range.position.set(s.x * S, 0.05, s.y * S); m.range.visible = false; this.dyn.add(m.range);
    }
    for (const h of world.heroes) { const m = buildHero(h.def, h.team); this.dyn.add(m.root); this.maps.hero.set(h.id, m); }
  }

  // ───────── 시점 ─────────
  look(dx, dy) {
    this.view.yaw += dx * 0.0026;
    this.view.pitch = clamp(this.view.pitch + dy * 0.0022, -0.12, 1.1);
  }

  // 시뮬레이션 평면에서의 전방/우측 단위 벡터
  basis() { const c = Math.cos(this.view.yaw), s = Math.sin(this.view.yaw); return { fx: c, fy: s, rx: -s, ry: c }; }

  // 화면 중앙 조준점이 가리키는 지면 위치 (시뮬레이션 좌표)
  aimPoint(p) {
    const cam = this.camera.position, dir = this.camera.getWorldDirection(this.tmp);
    let x, y;
    if (dir.y < -0.03) { const t = cam.y / -dir.y; x = (cam.x + dir.x * t) / S; y = (cam.z + dir.z * t) / S; }
    else { x = p.x + Math.cos(this.view.yaw) * 1100; y = p.y + Math.sin(this.view.yaw) * 1100; }
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1, b = this.basis();
    if (dx * b.fx + dy * b.fy < 60) return { x: p.x + b.fx * 140, y: p.y + b.fy * 140 }; // 발밑을 볼 때는 정면 기준
    const k = clamp(d, 140, 1100) / d;
    return { x: p.x + dx * k, y: p.y + dy * k };
  }

  blocked(x, y, z) {
    const sx = x / S, sy = z / S;
    if (sx < 0 || sy < 0 || sx > MAP.w || sy > MAP.h) return y < 4.3;
    if (y > WALL_H + 0.3) return false;
    for (const [wx, wy, ww, wh] of MAP.walls) if (sx > wx - 15 && sx < wx + ww + 15 && sy > wy - 15 && sy < wy + wh + 15) return true;
    return false;
  }

  updateCamera(world, player, dt, mode) {
    const cam = this.camera;
    if (mode === 'demo') {
      const a = this.time * 0.06, cx = (MAP.w * S) / 2, cz = (MAP.h * S) / 2;
      cam.position.set(cx + Math.cos(a) * 46, 24, cz + Math.sin(a) * 34);
      cam.lookAt(cx, 0, cz);
      this.pivot.set(cx, 0, cz);
      return;
    }
    const k = 1 - Math.exp(-dt * 16);
    this.tmp.set(player.x * S, 1.75, player.y * S);
    if (this.pivot.distanceToSquared(this.tmp) > 400) this.pivot.copy(this.tmp); else this.pivot.lerp(this.tmp, k);
    const { yaw, pitch } = this.view, cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dir = this.tmp.set(Math.cos(yaw) * cp, -sp, Math.sin(yaw) * cp);
    const right = this.tmp2.set(-Math.sin(yaw), 0, Math.cos(yaw));
    const full = 6.4, sh = 0.85;
    let dist = full;
    for (let i = 1; i <= 12; i++) { // 벽에 가리면 카메라를 당긴다
      const t = (i / 12) * full;
      if (this.blocked(this.pivot.x - dir.x * t + right.x * sh, this.pivot.y - dir.y * t + 0.35, this.pivot.z - dir.z * t + right.z * sh)) { dist = Math.max(1.2, t - full / 12); break; }
    }
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    cam.position.set(this.pivot.x - dir.x * dist + right.x * sh + sx, Math.max(0.5, this.pivot.y - dir.y * dist + 0.35 + sy), this.pivot.z - dir.z * dist + right.z * sh);
    cam.lookAt(cam.position.x + dir.x, cam.position.y + dir.y, cam.position.z + dir.z);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  // ───────── 프레임 ─────────
  render(world, player, dt, mode = 'play') {
    this.time = world.time; this.real = (this.real || 0) + dt;
    if (mode === 'demo') this.time = this.real;
    this.updateCamera(world, player, dt, mode);
    this.sun.position.set(this.pivot.x - 16, 34, this.pivot.z - 20); this.sun.target.position.set(this.pivot.x, 0, this.pivot.z);
    const t = world.time;

    for (const [id, m] of this.maps.struct) {
      const s = m.s || (m.s = world.units.find((u) => u.id === id));
      m.update(t, s.flashT);
      const near = mode === 'play' && s.alive && s.team !== player.team && Math.hypot(player.x - s.x, player.y - s.y) < s.def.range + 500;
      m.range.visible = near;
      if (near) { const hot = s.target === player; m.range.material.color.set(hot ? '#ffdd55' : TEAM_COLOR[s.team]); m.range.material.opacity = hot ? 0.95 : 0.45; }
    }
    for (const h of world.heroes) {
      const m = this.maps.hero.get(h.id);
      m.update(h, dt, t);
      // 카메라 바로 앞을 가로막는 다른 영웅은 그리지 않는다
      m.root.visible = h === player || mode !== 'play' || Math.hypot(h.x * S - this.camera.position.x, h.y * S - this.camera.position.z) > 2.4;
    }

    const seen = new Set();
    for (const u of world.units) {
      if (u.kind !== 'minion') continue;
      seen.add(u.id);
      let m = this.maps.minion.get(u.id);
      if (!m) { m = buildMinion(u.team); this.dyn.add(m.root); this.maps.minion.set(u.id, m); }
      m.update(u, dt, t, MINION.cd);
    }
    for (const [id, m] of this.maps.minion) if (!seen.has(id)) { this.dyn.remove(m.root); this.maps.minion.delete(id); }

    this.syncSet(this.maps.proj, world.projectiles, (p) => this.makeProjectile(p), (p, o) => {
      o.position.set(p.x * S, 1.2, p.y * S); o.rotation.y = -Math.atan2(p.vy, p.vx);
    });
    this.syncSet(this.maps.zone, world.zones, (z) => this.makeZone(z, player), (z, o) => {
      const k = Math.min(1, (t - z.start) / (z.at - z.start));
      o.userData.fill.scale.setScalar(Math.max(0.01, z.radius * S * k));
      if (o.userData.rock) o.userData.rock.position.set((1 - k) * 9, 1 + (1 - k) * 30, (1 - k) * -5);
    });
    this.syncSet(this.maps.fx, world.fx, (f) => this.makeFx(f, world, player), (f, o) => o.userData.update && o.userData.update(f.t / f.dur, f));

    if (mode === 'play' && player.alive) {
      const a = this.aimPoint(player);
      this.aimRing.visible = true; this.aimRing.position.set(a.x * S, 0.07, a.y * S); this.aimRing.material.color.set(player.def.color);
    } else this.aimRing.visible = false;

    this.gl.render(this.scene, this.camera);
    this.drawOverlay(world, player, mode);
  }

  // 시뮬레이션 객체 목록과 3D 오브젝트를 맞춘다 (새 것은 만들고, 사라진 것은 지운다)
  syncSet(map, list, make, update) {
    for (const it of list) {
      let o = map.get(it);
      if (o === undefined) { o = make(it); map.set(it, o); if (o) this.dyn.add(o); }
      if (o) update(it, o);
    }
    if (map.size > list.length) {
      const live = new Set(list);
      for (const [it, o] of map) if (!live.has(it)) { if (o) { this.dyn.remove(o); o.traverse((c) => { if (c.material) c.material.dispose(); if (c.userData.ownGeo) c.geometry.dispose(); }); } map.delete(it); }
    }
  }

  makeProjectile(p) {
    const g = new THREE.Group(), r = Math.max(0.13, p.radius * S * 1.3);
    const head = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: '#ffffff' })); head.scale.setScalar(r); g.add(head);
    const halo = new THREE.Mesh(GEO.sphere, fxMat(p.color, 0.55)); halo.scale.setScalar(r * 2.1); g.add(halo);
    const len = Math.min(3.2, r * 14), tail = new THREE.Mesh(GEO.cyl, fxMat(p.color, 0.5));
    tail.scale.set(r * 0.8, len, r * 0.8); tail.rotation.z = Math.PI / 2; tail.position.x = -len / 2; g.add(tail);
    return g;
  }

  makeZone(z, player) {
    const col = z.team !== player.team ? '#ff4d5e' : z.color, g = new THREE.Group(), r = z.radius * S;
    g.position.set(z.x * S, 0, z.y * S);
    const base = flat(GEO.disc, fxMat(col, 0.16)); base.scale.setScalar(r); g.add(base);
    const fill = flat(GEO.disc, fxMat(col, 0.3), 0.07); g.add(fill); g.userData.fill = fill;
    const ring = flat(GEO.ring, fxMat(col, 0.95), 0.08); ring.scale.setScalar(r); g.add(ring);
    if (z.eff.fx === 'meteor') { const rock = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: z.color })); rock.scale.setScalar(r * 0.3); const halo = new THREE.Mesh(GEO.sphere, fxMat(z.color, 0.5)); halo.scale.setScalar(1.7); rock.add(halo); g.add(rock); g.userData.rock = rock; }
    return g;
  }

  makeFx(f, world, player) {
    const g = new THREE.Group();
    g.position.set(f.x * S, 0, f.y * S);
    const own = (geo) => { const m = new THREE.Mesh(geo); m.userData.ownGeo = true; return m; };
    switch (f.type) {
      case 'arc': {
        g.rotation.y = -f.a;
        const R = f.range * S;
        const floor = own(new THREE.RingGeometry(R * 0.2, R, 24, 1, -f.half, f.half * 2)); floor.material = fxMat(f.color, 0.3); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06; g.add(floor);
        const sweep = new THREE.Group(); g.add(sweep);
        const blade = own(new THREE.RingGeometry(R * 0.55, R * 1.02, 12, 1, -0.45, 0.9)); blade.material = fxMat('#ffffff', 0.95); blade.rotation.x = -Math.PI / 2; blade.position.y = 1.15; sweep.add(blade);
        const trail = own(new THREE.RingGeometry(R * 0.6, R, 20, 1, -f.half, f.half * 2)); trail.material = fxMat(f.color, 0.5); trail.rotation.x = -Math.PI / 2; trail.position.y = 1.13; g.add(trail);
        g.userData.update = (k) => { sweep.rotation.y = f.half - f.half * 2 * Math.min(1, k * 1.7); floor.material.opacity = 0.3 * (1 - k); blade.material.opacity = 0.95 * (1 - k); trail.material.opacity = 0.5 * (1 - k) * Math.min(1, k * 3); };
        break;
      }
      case 'spin': {
        const R = f.radius * S;
        for (const off of [0, Math.PI]) { const m = own(new THREE.RingGeometry(R * 0.6, R, 18, 1, off, 2.3)); m.material = fxMat(f.color, 0.8); m.rotation.x = -Math.PI / 2; m.position.y = 1.05; g.add(m); }
        const fl = flat(GEO.ring, fxMat(f.color, 0.5)); fl.scale.setScalar(R); g.add(fl);
        g.userData.update = (k) => { g.rotation.y = -this.time * 24; for (const c of g.children) c.material.opacity = 0.8 * (1 - k); };
        break;
      }
      case 'boom': case 'frost': case 'quake': case 'meteor': {
        const col = f.type === 'frost' ? '#8fd8ff' : f.color, R = f.radius * S, big = f.type === 'quake' || f.type === 'meteor';
        const dome = new THREE.Mesh(GEO.sphere, fxMat(col, 0.4)); g.add(dome);
        const ring = flat(GEO.ring, fxMat('#ffffff', 0.9), 0.09); g.add(ring);
        const disc = flat(GEO.disc, fxMat(col, 0.35), 0.07); g.add(disc);
        let pillar = null;
        if (big) { pillar = new THREE.Mesh(GEO.cyl, fxMat(col, 0.5)); pillar.position.y = 6; g.add(pillar); if (Math.hypot(player.x - f.x, player.y - f.y) < 900) this.shake = 0.5; }
        g.userData.update = (k) => {
          const r = R * (0.5 + 0.5 * Math.min(1, k * 2.2)), inv = 1 - k;
          dome.scale.set(r, r * (big ? 0.75 : 0.55), r); dome.material.opacity = 0.4 * inv;
          ring.scale.setScalar(r); ring.material.opacity = 0.9 * inv; disc.scale.setScalar(r); disc.material.opacity = 0.35 * inv;
          if (pillar) { pillar.scale.set(R * 0.35 * inv + 0.05, 12, R * 0.35 * inv + 0.05); pillar.material.opacity = 0.5 * inv; }
        };
        break;
      }
      case 'hit': {
        const m = new THREE.Mesh(GEO.sphere, fxMat(f.color, 0.9)); m.position.y = 1.1; g.add(m);
        g.userData.update = (k) => { m.scale.setScalar(0.2 + k * 0.55); m.material.opacity = 0.9 * (1 - k); };
        break;
      }
      case 'beam': {
        const src = this.structAt[f.x + ',' + f.y], a = new THREE.Vector3(f.x * S, src ? src.top : 4, f.y * S), b = new THREE.Vector3(f.x2 * S, 1, f.y2 * S);
        const d = b.clone().sub(a), len = d.length(), col = TEAM_COLOR[f.team];
        g.position.copy(a).addScaledVector(d, 0.5); g.quaternion.setFromUnitVectors(UP, d.normalize());
        const core = new THREE.Mesh(GEO.cyl, fxMat('#ffffff', 1)), halo = new THREE.Mesh(GEO.cyl, fxMat(col, 0.7)); g.add(core, halo);
        g.userData.update = (k) => { const inv = 1 - k; core.scale.set(0.05 * inv + 0.01, len, 0.05 * inv + 0.01); halo.scale.set(0.2 * inv + 0.02, len, 0.2 * inv + 0.02); core.material.opacity = inv; halo.material.opacity = 0.7 * inv; };
        break;
      }
      case 'trail': {
        g.rotation.y = -f.a;
        const len = f.len * S, m = flat(GEO.plane, fxMat(f.color, 0.55), 0.9); m.scale.set(len, 0.7, 1); m.position.x = len / 2; g.add(m);
        const fl = flat(GEO.plane, fxMat(f.color, 0.3), 0.06); fl.scale.set(len, 1.1, 1); fl.position.x = len / 2; g.add(fl);
        g.userData.update = (k) => { m.material.opacity = 0.55 * (1 - k); fl.material.opacity = 0.3 * (1 - k); m.scale.y = 0.7 * (1 - k) + 0.05; };
        break;
      }
      case 'line': {
        g.rotation.y = -f.a;
        const col = f.team !== player.team ? '#ff4d5e' : f.color, len = f.len * S, w = f.width * S;
        const base = flat(GEO.plane, fxMat(col, 0.2)); base.scale.set(len, w, 1); base.position.x = len / 2; g.add(base);
        const fill = flat(GEO.plane, fxMat(col, 0.38), 0.07); g.add(fill);
        g.userData.update = (k) => { fill.scale.set(Math.max(0.01, len * k), w, 1); fill.position.x = (len * k) / 2; };
        break;
      }
      case 'blink': case 'levelup': case 'ultcast': {
        const col = f.type === 'levelup' ? '#ffe680' : f.color;
        const ring = flat(GEO.ring, fxMat(col, 0.9), 0.08); g.add(ring);
        const pillar = new THREE.Mesh(GEO.cyl, fxMat(col, 0.35)); pillar.position.y = 2.6; g.add(pillar);
        g.userData.update = (k) => {
          if (f.follow) { const u = world.heroes.find((h) => h.id === f.follow); if (u) g.position.set(u.x * S, 0, u.y * S); }
          ring.scale.setScalar(0.5 + k * 2.2); ring.material.opacity = 0.9 * (1 - k);
          pillar.scale.set(0.9 * (1 - k * 0.5), 5.2, 0.9 * (1 - k * 0.5)); pillar.material.opacity = 0.35 * (1 - k);
        };
        break;
      }
      default: return null; // 'num' 은 2D 오버레이에서 그린다
    }
    return g;
  }

  // ───────── 2D 오버레이 (체력바, 이름, 피해 숫자) ─────────
  project(x, h, y) {
    const v = this.tmp.set(x * S, h, y * S), d = v.distanceTo(this.camera.position);
    v.project(this.camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.2) return null;
    return { x: ((v.x + 1) / 2) * this.vw, y: ((1 - v.y) / 2) * this.vh, d };
  }

  // 카메라와 대상 사이를 벽이 가리는지 (선분-상자 교차). 벽 뒤 적의 체력바를 숨기는 데 쓴다
  occluded(x, h, y) {
    const c = this.camera.position, ax = c.x, ay = c.y, az = c.z, dx = x * S - ax, dy = h - ay, dz = y * S - az;
    for (const [wx, wy, ww, wh] of MAP.walls) {
      let t0 = 0, t1 = 1, hit = true;
      for (const [o, d, lo, hi] of [[ax, dx, wx * S, (wx + ww) * S], [ay, dy, 0, WALL_H], [az, dz, wy * S, (wy + wh) * S]]) {
        if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { hit = false; break; } continue; }
        let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) { hit = false; break; }
      }
      if (hit) return true;
    }
    return false;
  }

  drawOverlay(world, player, mode) {
    const c = this.octx;
    c.setTransform(this.odpr, 0, 0, this.odpr, 0, 0);
    c.clearRect(0, 0, this.vw, this.vh);
    if (mode !== 'play') return;
    c.textAlign = 'center';
    const bar = (x, y, w, h, pct, col) => { c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3); c.fillStyle = col; c.fillRect(x - w / 2, y, w * Math.max(0, pct), h); };
    const text = (s, x, y, col) => { c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y); };
    for (const u of world.units) {
      if (!u.alive) continue;
      if (u.kind === 'minion') {
        const p = this.project(u.x, 1.25, u.y); if (!p || p.d > 38 || (u.team !== player.team && this.occluded(u.x, 1, u.y))) continue;
        const k = clamp(13 / p.d, 0.4, 1.2); bar(p.x, p.y, 40 * k, 4 * k + 1, u.hp / u.maxHp, TEAM_COLOR[u.team]);
      } else if (u.struct) {
        const m = this.maps.struct.get(u.id), p = this.project(u.x, m.height, u.y); if (!p || p.d > 75) continue;
        const k = clamp(22 / p.d, 0.4, 1.2), vul = world.vulnerable(u);
        bar(p.x, p.y, 130 * k, 10 * k + 1, u.hp / u.maxHp, vul ? TEAM_COLOR[u.team] : '#77808f');
        if (!vul) { c.font = `bold ${Math.round(15 * k + 3)}px sans-serif`; text('보호 중', p.x, p.y - 7 * k - 2, '#c8d1df'); }
      } else {
        if (u === player && this.view.pitch > 0.9) continue;
        const m = this.maps.hero.get(u.id), p = this.project(u.x, m.height + 0.15, u.y); if (!p || p.d > 60 || (u.team !== player.team && this.occluded(u.x, 1.5, u.y))) continue;
        const k = clamp(12 / p.d, 0.45, 1.15);
        bar(p.x, p.y, 92 * k, 9 * k + 1, u.hp / u.maxHp, u === player ? '#5dfc8a' : TEAM_COLOR[u.team]);
        c.font = `bold ${Math.round(13 * k + 4)}px "Segoe UI","Malgun Gothic",sans-serif`;
        text(`Lv.${u.level} ${u.name}`, p.x, p.y - 6 * k - 2, '#ffffff');
        if (u.stunT > 0) text('★ 기절', p.x, p.y - 22 * k - 6, '#ffe24a');
      }
    }
    for (const f of world.fx) {
      if (f.type !== 'num') continue;
      const mine = f.srcId === player.id || f.tgtId === player.id || !f.srcId;
      if (!mine && f.text !== '무적') continue;
      const k = f.t / f.dur, p = this.project(f.x, 2.3 + k * 1.3, f.y); if (!p) continue;
      c.globalAlpha = Math.min(1, (1 - k) * 1.8);
      c.font = `bold ${Math.round(clamp(260 / p.d, 13, 30))}px "Segoe UI",sans-serif`;
      text(f.text, p.x, p.y, f.srcId === player.id ? '#ffe9a6' : f.color);
      c.globalAlpha = 1;
    }
  }
}
