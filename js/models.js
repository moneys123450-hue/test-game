// 3D 모델 생성기 — 도형을 조합해 코드로 만든다 (외부 모델 파일 없음).
// 영웅은 data.js 의 look 명세만 보고 조립하므로, 영웅을 추가해도 이 파일은 고칠 필요가 없다.
// 좌표 규약: 모델의 정면은 +X, 위는 +Y, 오른손 쪽은 +Z. 단위는 미터.
import * as THREE from '../vendor/three.module.min.js';
import { TEAM_COLOR } from './data.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

const modelLoader = new GLTFLoader();
const modelCache = new Map();
function loadModel(url) {
  if (!modelCache.has(url)) modelCache.set(url, modelLoader.loadAsync(url));
  return modelCache.get(url);
}

export const S = 1 / 50; // 시뮬레이션 단위 → 미터

const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, flatShading: true, ...o });
// 발광 재질: 바탕색을 검게 두어 조명에 씻겨 하얗게 뜨지 않고 고유색이 유지되게 한다
const glow = (color, k = 1.8) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: k * 0.55, roughness: 0.4 });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const rot = (m, x, y, z) => { m.rotation.set(x, y, z); return m; };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) * (1 - t);

// ───────── 무기 (손 위치를 원점으로 하는 그룹) ─────────
const WEAPONS = {
  katana(look) {
    const g = new THREE.Group();
    g.add(box(0.22, 0.05, 0.06, solid('#20242e'), 0.05, 0, 0));
    g.add(box(1.35, 0.035, 0.085, glow(look.accent, 2.2), 0.82, 0, 0));
    return { right: g };
  },
  pistols(look) {
    const one = () => { const g = new THREE.Group(); g.add(box(0.09, 0.34, 0.09, solid('#d9dde4'), 0, -0.14, 0)); g.add(box(0.06, 0.1, 0.06, glow(look.accent, 2.4), 0, -0.33, 0)); return g; };
    return { right: one(), left: one() };
  },
  hammer_shield(look) {
    const r = new THREE.Group();
    r.add(rot(mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 6), solid('#3a3f4a'), 0.6, 0, 0), 0, 0, Math.PI / 2));
    r.add(box(0.42, 0.42, 0.62, solid('#7d8594', { metalness: 0.6, roughness: 0.4 }), 1.2, 0, 0));
    r.add(box(0.44, 0.12, 0.64, glow(look.accent, 1.6), 1.2, 0, 0));
    const l = new THREE.Group();
    l.add(box(0.1, 1.05, 0.74, solid('#6b7280', { metalness: 0.6, roughness: 0.4 }), 0.2, 0.15, 0));
    l.add(box(0.11, 0.5, 0.16, glow(look.accent, 1.6), 0.21, 0.15, 0));
    return { right: r, left: l };
  },
  staff(look) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 6), solid('#d8d0f0'), 0, 0.05, 0));
    const orb = mesh(new THREE.IcosahedronGeometry(0.17, 0), glow(look.accent, 2.6), 0, 1.12, 0);
    g.add(orb);
    return { right: g, spin: orb };
  },
};

// 공격 방식별 팔 기본 자세 [오른팔, 왼팔] (rotation.z, 양수 = 앞으로 들어 올림)
const STANCE = { slash: [0.35, 0.1], shoot: [1.35, 1.35], smash: [0.3, 0.55], cast: [0.3, 0.15] };

export function buildHero(def, team) {
  const L = def.look, k = L.bulk || 1;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(L.scale || 1);

  const skin = solid(L.skin), torsoM = solid(L.torso), accent = glow(L.accent, 1.8);
  body.add(box(0.3 * k, 0.62, 0.5 * k, torsoM, 0, 1.3, 0));
  body.add(box(0.31 * k, 0.07, 0.42 * k, accent, 0, 1.42, 0));
  body.add(box(0.05, 0.5, 0.06, accent, 0.16 * k, 1.28, 0));
  body.add(box(0.26 * k, 0.16, 0.44 * k, solid(L.legs || L.robe), 0, 0.95, 0));
  const head = new THREE.Group(); head.position.set(0, 1.79, 0); body.add(head);
  head.add(box(0.27, 0.29, 0.27, skin));
  head.add(box(0.03, 0.05, 0.2, solid('#101218'), 0.135, 0.03, 0));

  const hairM = solid(L.hair.color);
  if (L.hair.style === 'spiky') {
    for (let i = 0; i < 6; i++) { const c = mesh(new THREE.ConeGeometry(0.075, 0.24, 4), i === 1 && L.hair.streak ? glow(L.hair.streak, 1.5) : hairM, -0.1 + (i % 3) * 0.1, 0.22, -0.08 + Math.floor(i / 3) * 0.16); c.rotation.z = 0.5 - (i % 3) * 0.35; head.add(c); }
    head.add(box(0.29, 0.1, 0.29, hairM, -0.01, 0.13, 0));
  } else if (L.hair.style === 'ponytail') {
    head.add(box(0.29, 0.12, 0.29, hairM, -0.01, 0.12, 0));
    const tail = mesh(new THREE.ConeGeometry(0.09, 0.75, 5), hairM, -0.32, -0.08, 0); tail.rotation.z = -2.2; head.add(tail);
    head.add(box(0.16, 0.05, 0.26, solid('#2a2f3a'), 0.08, 0.17, 0));
  } else if (L.hair.style === 'long') {
    head.add(box(0.3, 0.12, 0.3, hairM, -0.01, 0.12, 0));
    head.add(box(0.1, 0.8, 0.3, hairM, -0.15, -0.3, 0));
  } else if (L.hair.style === 'beard') {
    head.add(box(0.29, 0.07, 0.29, hairM, -0.01, 0.14, 0));
    head.add(box(0.12, 0.2, 0.26, hairM, 0.1, -0.16, 0));
  }

  const limb = (len, w, mat) => { const p = new THREE.Group(); p.add(box(w, len, w, mat, 0, -len / 2, 0)); return p; };
  const armR = limb(0.62, 0.14 * k, torsoM), armL = limb(0.62, 0.14 * k, torsoM);
  armR.position.set(0, 1.56, 0.33 * k); armL.position.set(0, 1.56, -0.33 * k);
  armR.add(box(0.13, 0.12, 0.13, skin, 0, -0.66, 0)); armL.add(box(0.13, 0.12, 0.13, skin, 0, -0.66, 0));
  body.add(armR, armL);
  if (L.pauldrons) for (const z of [0.36 * k, -0.36 * k]) body.add(mesh(new THREE.IcosahedronGeometry(0.24, 0), solid(L.pauldrons, { metalness: 0.6, roughness: 0.4 }), 0, 1.62, z));
  if (L.bulk) body.add(mesh(new THREE.IcosahedronGeometry(0.15, 0), accent, -0.22 * k, 1.35, 0));

  let legR = null, legL = null;
  if (L.robe) { const c = mesh(new THREE.ConeGeometry(0.46, 1.05, 7), solid(L.robe), 0, 0.5, 0); body.add(c); body.add(rot(mesh(new THREE.TorusGeometry(0.4, 0.025, 4, 14), accent, 0, 0.12, 0), Math.PI / 2, 0, 0)); }
  else {
    legR = limb(0.9, 0.17 * k, solid(L.legs)); legL = limb(0.9, 0.17 * k, solid(L.legs));
    legR.position.set(0, 0.9, 0.13 * k); legL.position.set(0, 0.9, -0.13 * k);
    body.add(legR, legL);
  }

  const w = WEAPONS[L.weapon](L);
  if (w.right) { w.right.position.set(0, -0.68, 0); armR.add(w.right); }
  if (w.left) { w.left.position.set(0, L.weapon === 'pistols' ? -0.68 : -0.4, 0); armL.add(w.left); }

  // Keep the procedural body while loading, or if the optional asset fails.
  if (L.model && new URLSearchParams(location.search).get('model') !== 'original') {
    loadModel(L.model).then((gltf) => {
      const model = gltf.scene.clone(true);
      model.rotation.y = Math.PI / 2;
      const originals = [];
      body.traverse((o) => { if (o.isMesh) originals.push(o); });
      originals.forEach((o) => { o.visible = false; });
      body.add(model);
      const pivots = [armR, armL, legR, legL].filter(Boolean);
      const poses = pivots.map((o) => o.rotation.clone());
      pivots.forEach((o) => o.rotation.set(0, 0, 0));
      root.updateMatrixWorld(true);
      const parts = [];
      model.traverse((o) => { if (o.isMesh) parts.push(o); });
      for (const o of parts) {
        o.material = o.material.clone(); o.castShadow = true;
        const p = body.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
        const right = p.z > 0;
        let pivot;
        if (/^(Upper_arm|Elbow|Forearm_gauntlet|Glove|Katana|Blade|Energy_edge)/.test(o.name)) pivot = right ? armR : armL;
        else if (/^(Thigh|Knee|Shin|Boot)/.test(o.name)) pivot = right ? legR : legL;
        if (pivot) pivot.attach(o);
      }
      pivots.forEach((o, i) => o.rotation.copy(poses[i]));
      root.userData.modelSource = L.model;
    }).catch((err) => console.warn('Character model unavailable; using procedural model', err));
  }

  // 발밑 진영 표시, 피격 섬광, 보호막
  const ring = new THREE.Mesh(new THREE.RingGeometry(def.r * S * 1.15, def.r * S * 1.4, 28), new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; root.add(ring);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.y = 1.1; root.add(flash);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  shield.position.y = 1.1; shield.visible = false; root.add(shield);

  const recall = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 5, 18, 1, true), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  recall.position.y = 2.5; recall.visible = false; root.add(recall);
  const healFx = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8), new THREE.MeshBasicMaterial({ color: '#5dfc8a', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
  healFx.position.y = 1.1; healFx.visible = false; root.add(healFx);

  const st = { phase: 0, fall: 0 };
  const stance = STANCE[L.anim] || STANCE.slash;

  // h: 시뮬레이션 영웅, time: 시뮬레이션 시각
  function update(h, dt, time) {
    root.position.set(h.x * S, 0, h.y * S);
    root.rotation.y = -h.face;
    ring.visible = h.alive;
    if (!h.alive) { // 쓰러진 뒤 사라진다
      st.fall = Math.min(1, st.fall + dt * 2.5);
      body.rotation.set(0, 0, st.fall * 1.5); body.position.y = 0;
      body.visible = time - h.deathT < 2.5;
      flash.material.opacity = 0; shield.visible = false; recall.visible = false; healFx.visible = false;
      return;
    }
    st.fall = 0; body.visible = true;
    const sp = Math.hypot(h.vx, h.vy), run = Math.min(1, sp / 280);
    st.phase += sp * S * dt * 3.4;
    const sw = Math.sin(st.phase) * run;
    if (legR) { legR.rotation.z = sw * 0.85; legL.rotation.z = -sw * 0.85; }
    let aR = stance[0] - sw * 0.5 * (L.anim === 'shoot' ? 0.1 : 1), aL = stance[1] + sw * 0.5 * (L.anim === 'shoot' ? 0.1 : 1);
    let lean = -run * 0.12, twist = 0, roll = 0;

    // 공격 동작
    const sk = h.castSlot && h.def.skills[h.castSlot];
    const dur = sk ? Math.max(0.28, sk.lock + 0.12) : 0.3, t = (time - h.castT) / dur;
    if (sk && t >= 0 && t < 1 && h.castSlot !== 'space') {
      if (L.anim === 'slash' || L.anim === 'smash') { aR = t < 0.25 ? lerp(stance[0], 2.9, t / 0.25) : lerp(2.9, -0.35, ease((t - 0.25) / 0.75)); twist = lerp(0.5, -0.5, t); lean -= 0.18; }
      else if (L.anim === 'shoot') { const kick = (1 - t) * 0.35; aR = 1.57 + kick; aL = 1.57 + (sk.ult || h.castSlot === 'rmb' ? kick : 0); lean += kick * 0.2; }
      else { aR = lerp(2.5, stance[0], ease(t)); aL = lerp(1.6, stance[1], ease(t)); }
    }
    if (h.dash) { lean = -0.55; if (h.invulnT > 0 && h.dash.eff.toMove) roll = -(1 - h.dash.t / h.dash.eff.dur) * Math.PI * 2; }
    armR.rotation.z = aR; armL.rotation.z = aL;
    body.rotation.set(h.stunT > 0 ? Math.sin(time * 14) * 0.18 : 0, twist, lean + roll);
    body.position.y = (L.hover ? 0.22 + Math.sin(time * 2.2) * 0.07 : Math.abs(Math.sin(st.phase)) * 0.05 * run) + (roll ? 0.5 : 0);
    if (w.spin) w.spin.rotation.y += dt * 2;
    flash.material.opacity = h.flashT > 0 ? 0.35 : 0;
    shield.visible = h.buffs.some((b) => b.fx === 'shield');
    healFx.visible = h.buffs.some((b) => b.potion);
    recall.visible = !!h.recall;
    if (h.recall) { const k = 1 - h.recall.t / 4; recall.material.opacity = 0.2 + k * 0.45; recall.scale.set(1.15 - k * 0.5, 1, 1.15 - k * 0.5); recall.rotation.y = time * 4; }
    body.traverse((o) => { if (o.material && o.material.transparent !== (h.invulnT > 0)) { o.material.transparent = h.invulnT > 0; o.material.opacity = h.invulnT > 0 ? 0.5 : 1; o.material.needsUpdate = true; } });
  }
  return { root, update, height: 2.15 * (L.scale || 1) };
}

// ───────── 미니언 ─────────
const minionGeo = { body: new THREE.SphereGeometry(0.42, 8, 6), visor: new THREE.BoxGeometry(0.12, 0.1, 0.5), blade: new THREE.BoxGeometry(0.55, 0.05, 0.12), ring: new THREE.RingGeometry(0.46, 0.56, 16) };
const minionMat = [0, 1].map((t) => ({ body: solid(t ? '#6b424a' : '#465678', { metalness: 0.4, roughness: 0.5 }), glow: glow(TEAM_COLOR[t], 2), ring: new THREE.MeshBasicMaterial({ color: TEAM_COLOR[t], transparent: true, opacity: 0.7, depthWrite: false }) }));
export function buildMinion(team) {
  const root = new THREE.Group(), body = new THREE.Group(), m = minionMat[team];
  root.add(body);
  const b = mesh(minionGeo.body, m.body); b.scale.y = 0.75; body.add(b);
  body.add(mesh(minionGeo.visor, m.glow, 0.36, 0.05, 0));
  body.add(mesh(minionGeo.blade, m.glow, 0.45, -0.1, 0.38), mesh(minionGeo.blade, m.glow, 0.45, -0.1, -0.38));
  const ring = new THREE.Mesh(minionGeo.ring, m.ring); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
  function update(u, dt, time, cdMax) {
    root.position.set(u.x * S, 0, u.y * S); root.rotation.y = -u.face;
    const lunge = Math.max(0, 1 - (cdMax - u.cd) / 0.25); // 공격 직후 앞으로 찌른다
    body.position.set(lunge * 0.45, 0.6 + Math.sin(time * 4 + u.id) * 0.07, 0);
    body.rotation.z = u.stunT > 0 ? Math.sin(time * 14) * 0.3 : -0.1;
  }
  return { root, update, height: 1.25 };
}

// ───────── 건물 ─────────
export function buildStruct(s, lights = true) {
  const col = TEAM_COLOR[s.team], root = new THREE.Group(), live = new THREE.Group(), dead = new THREE.Group();
  root.position.set(s.x * S, 0, s.y * S); root.add(live, dead); dead.visible = false;
  const metal = solid(s.team ? '#6a3a44' : '#3a4a70', { metalness: 0.45, roughness: 0.5 }), dark = solid('#2a3348'), g = glow(col, 2.4);
  const r = s.r * S;
  let crystal, top;
  if (s.kind === 'core') {
    root.add(mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.2, 0.7, 6), dark, 0, 0.35, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; live.add(box(0.4, 2.8, 0.4, metal, Math.cos(a) * r * 0.85, 2.1, Math.sin(a) * r * 0.85)); live.add(box(0.3, 0.3, 0.3, g, Math.cos(a) * r * 0.85, 3.65, Math.sin(a) * r * 0.85)); }
    crystal = mesh(new THREE.OctahedronGeometry(1.15, 0), g, 0, 3.1, 0); crystal.scale.y = 1.6; top = 3.1;
  } else {
    root.add(mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.15, 0.5, 8), dark, 0, 0.25, 0));
    live.add(mesh(new THREE.CylinderGeometry(0.45, 0.9, 3.4, 6), metal, 0, 2.2, 0));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; const f = box(0.12, 2.2, 0.7, metal, Math.cos(a) * 0.75, 1.6, Math.sin(a) * 0.75); f.rotation.y = -a; live.add(f); }
    live.add(rot(mesh(new THREE.TorusGeometry(0.75, 0.07, 5, 16), g, 0, 3.95, 0), Math.PI / 2, 0, 0));
    crystal = mesh(new THREE.OctahedronGeometry(0.55, 0), g, 0, 4.75, 0); crystal.scale.y = 1.5; top = 4.75;
    if (s.tier === 2) live.add(rot(mesh(new THREE.TorusGeometry(0.95, 0.06, 5, 16), g, 0, 3.4, 0), Math.PI / 2, 0, 0));
  }
  live.add(crystal);
  if (lights) { const light = new THREE.PointLight(col, 14, 18, 1.8); light.position.y = top; live.add(light); }
  for (let i = 0; i < 7; i++) { const b = box(0.5 + (i % 3) * 0.3, 0.4 + (i % 2) * 0.4, 0.6, dark, Math.cos(i * 2.1) * r * 0.6, 0.6, Math.sin(i * 2.1) * r * 0.6); b.rotation.set(i, i * 0.7, i * 0.3); dead.add(b); }
  function update(time, flashT) {
    live.visible = s.alive; dead.visible = !s.alive;
    crystal.rotation.y = time * 1.2; crystal.position.y = top + Math.sin(time * 1.6 + s.id) * 0.12;
    crystal.material.emissiveIntensity = flashT > 0 ? 3 : 1.3;
  }
  return { root, update, top, height: top + 1.4 };
}
