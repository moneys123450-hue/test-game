import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { characterMaterial, createExpressions } from './character-style.js';

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#101a29');
scene.fog = new THREE.Fog('#101a29', 8, 20);
const camera = new THREE.PerspectiveCamera(34, 1, .02, 60);
scene.add(new THREE.HemisphereLight('#dcefff', '#3c4256', 2.3));
for (const [color, intensity, x, y, z] of [['#fff0e3', 3, 3, 5, 4], ['#4dd9ff', 3, -3, 3, -3]]) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(x, y, z); l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -.0005; l.shadow.normalBias = .008; scene.add(l);
}
const stage = new THREE.Mesh(new THREE.CylinderGeometry(.8, .85, .045, 80), new THREE.MeshStandardMaterial({ color: '#202f42', roughness: .9 }));
stage.position.y = -.03; stage.receiveShadow = true; scene.add(stage);
const ring = new THREE.Mesh(new THREE.TorusGeometry(.79, .005, 6, 80), new THREE.MeshBasicMaterial({ color: '#4abbd0' }));
ring.rotation.x = Math.PI / 2; ring.position.y = -.004; scene.add(ring);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#142031', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.06; floor.receiveShadow = true; scene.add(floor);

let model, mixer, expressions, skeleton, actions = {}, current, request = 0, paused = false;
let angle = .45, pitch = .13, distance = 4.2, targetY = 1.05, elapsed = 0, blinkStart = -10;
function resize() {
  const h = Math.max(230, innerHeight - document.querySelector('.tools').offsetHeight - 38);
  canvas.style.height = `${h}px`; renderer.setSize(innerWidth, h, false);
  camera.aspect = innerWidth / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); new ResizeObserver(resize).observe(document.querySelector('.tools')); resize();
function play(name) {
  const action = actions[name]; if (!action) return;
  if (current) current.fadeOut(.14); action.reset().fadeIn(.14).play(); current = action;
  document.querySelectorAll('[data-clip]').forEach((b) => b.classList.toggle('active', b.dataset.clip === name));
}
async function load(type) {
  const id = ++request; document.querySelector('#status').textContent = '모델 불러오는 중…';
  const files = { anime: './art/kai-blender/kai-anime.glb?v=detail2', previous: './art/kai-blender/kai-anime-v1.glb', block: './art/kai-blender/kai-prototype.glb', sera: './art/sera-ai/sera-triposr-normalized.glb', projected: './art/sera-ai/sera-projected.glb', multiview: './art/sera-ai/sera-multiview.glb', rigged: './art/sera-ai/sera-rigged.glb' };
  try {
    const gltf = await new GLTFLoader().loadAsync(files[type]);
    if (id !== request) return;
    if (model) {
      if (skeleton) { scene.remove(skeleton); skeleton.dispose(); skeleton = null; }
      scene.remove(model); if (mixer) mixer.stopAllAction();
      model.traverse((o) => { o.geometry?.dispose(); for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) m.dispose(); });
    }
    model = gltf.scene;
    if (['sera', 'projected', 'multiview'].includes(type)) model.rotation.y = -Math.PI / 2;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false;
      const style = (m) => characterMaterial(m, !!o.geometry.attributes.color);
      o.material = Array.isArray(o.material) ? o.material.map(style) : style(o.material);
    });
    scene.add(model); mixer = new THREE.AnimationMixer(model); expressions = createExpressions(model);
    if (document.querySelector('#skeleton')) {
      skeleton = new THREE.SkeletonHelper(model); skeleton.material.depthTest = false; skeleton.renderOrder = 10;
      skeleton.visible = document.querySelector('#skeleton').getAttribute('aria-pressed') === 'true'; scene.add(skeleton);
      document.querySelector('#skeleton').disabled = skeleton.bones.length === 0;
    }
    actions = {}; current = null; for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c); play('Idle');
    document.querySelectorAll('[data-clip]').forEach((b) => b.disabled = !actions[b.dataset.clip]);
    document.querySelectorAll('[data-model]').forEach((b) => b.classList.toggle('active', b.dataset.model === type));
    document.querySelector('#blink').disabled = !expressions.supported;
    document.querySelector('#status').textContent = { anime: '개선 모델 · 얼굴 곡면 / 시선 /눈 깜빡임 / 의상 디테일', previous: '직전 버전 · 첫 곡면 캐릭터', block: '초기 버전 · 블록 시제품', sera: '로컬 AI 원본 · 정적 모델 · 뼈대/애니메이션 미적용', projected: '정면 그림만 투영 · 이전 결과', multiview: '정면·뒷면·양쪽 옆면 투영 · 기존 입체 형태 유지 · 정적 모델', rigged: '세라 · 관절 24개 · 대기 / 달리기 / 마법 시전 · 4방향 텍스처 유지' }[type];
    window.__character = { model, mixer, actions, play, expressions, skeleton, type, expressionOverride: null };
  } catch (e) { document.querySelector('#status').textContent = '모델을 불러오지 못했습니다'; console.error(e); }
}
document.querySelectorAll('[data-model]').forEach((b) => b.onclick = () => load(b.dataset.model));
document.querySelectorAll('[data-clip]').forEach((b) => b.onclick = () => play(b.dataset.clip));
document.querySelector('#face').onclick = () => { distance = .9; targetY = 1.79; pitch = .01; angle = .12; };
document.querySelector('#full').onclick = () => { distance = 4.2; targetY = 1.05; pitch = .13; };
document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
  angle = Number(b.dataset.view); distance = 4.2; targetY = 1.05; pitch = .04;
});
document.querySelector('#blink').onclick = () => { blinkStart = elapsed; };
document.querySelector('#skeleton')?.addEventListener('click', (e) => {
  if (skeleton) { skeleton.visible = !skeleton.visible; e.currentTarget.setAttribute('aria-pressed', skeleton.visible); }
});
document.querySelector('#pause-motion').onclick = (e) => {
  paused = !paused; e.currentTarget.textContent = paused ? '계속 재생' : '일시정지'; e.currentTarget.setAttribute('aria-pressed', paused);
};
let drag = null;
canvas.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
canvas.onpointerup = canvas.onpointercancel = () => drag = null;
canvas.onpointermove = (e) => {
  if (!drag) return; angle -= (e.clientX - drag[0]) * .007;
  pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag[1]) * .005, -.6, .8); drag = [e.clientX, e.clientY];
};
canvas.addEventListener('wheel', (e) => { e.preventDefault(); distance = THREE.MathUtils.clamp(distance + e.deltaY * .003, .55, 7); }, { passive: false });
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame); const dt = Math.min(clock.getDelta(), .05);
  if (!paused) {
    elapsed += dt; mixer?.update(dt);
    if (expressions) {
      const since = elapsed - blinkStart;
      const forced = window.__character?.expressionOverride ?? (since < .22 ? Math.max(0, 1 - Math.abs(since - .11) / .11) : null);
      expressions.update(elapsed, 0, forced);
    }
  }
  camera.position.set(Math.sin(angle) * distance * Math.cos(pitch), targetY + Math.sin(pitch) * distance, Math.cos(angle) * distance * Math.cos(pitch));
  camera.lookAt(0, targetY, 0); renderer.render(scene, camera);
}
load(document.body.dataset.character || 'anime'); frame();
