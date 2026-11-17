// 헤드리스 검증: 봇 6명으로 한 판을 끝까지 돌려 런타임 오류/밸런스를 확인한다.  node tools/sim.mjs [seed] [difficulty]
import { World } from '../js/world.js';
import { updateBot } from '../js/ai.js';
const seed = Number(process.argv[2] || 7), diff = Number(process.argv[3] ?? 1);
const roster = [
  { hero: 'kai', team: 0, lane: 'top' }, { hero: 'lyra', team: 0, lane: 'bot' }, { hero: 'brom', team: 0, lane: 'top' },
  { hero: 'sera', team: 1, lane: 'top' }, { hero: 'brom', team: 1, lane: 'bot' }, { hero: 'lyra', team: 1, lane: 'bot' },
];
const w = new World({ roster, difficulty: diff, seed });
const dt = 1 / 60;
let maxUnits = 0;
while (w.over === null && w.time < 45 * 60) {
  for (const h of w.heroes) updateBot(w, h, dt);
  w.step(dt);
  maxUnits = Math.max(maxUnits, w.units.length);
  for (const u of w.units) if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) throw new Error('NaN in unit ' + u.kind);
}
console.log(`seed ${seed} diff ${diff}: winner=${w.over} time=${(w.time / 60).toFixed(1)}m kills=${w.kills} maxUnits=${maxUnits}`);
console.log(w.heroes.map((h) => `${h.team ? 'R' : 'B'}:${h.def.id} L${h.level} ${h.k}/${h.d}/${h.a} [${h.items.join(',')}] p${h.potions} g${Math.round(h.gold)}`).join('\n'));
console.log('towers alive', w.towers.filter((t) => t.alive).map((t) => `${t.team ? 'R' : 'B'}${t.lane[0]}${t.tier}`).join(' '), 'cores', w.cores.map((c) => Math.round(c.hp)).join('/'));
