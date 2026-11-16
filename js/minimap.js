// 미니맵 (2D 캔버스). 시뮬레이션 좌표를 그대로 축소해 그린다.
import { MAP, TEAM_COLOR } from './data.js';

const TAU = Math.PI * 2;

export function drawMinimap(canvas, world, player, yaw) {
  const m = canvas.getContext('2d'), W = canvas.width, H = canvas.height, sx = W / MAP.w, sy = H / MAP.h;
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
    if (!h.alive || h === player) continue;
    m.fillStyle = TEAM_COLOR[h.team]; m.strokeStyle = '#fff'; m.lineWidth = 1.5;
    m.beginPath(); m.arc(h.x * sx, h.y * sy, 5, 0, TAU); m.fill(); m.stroke();
  }
  if (player.alive) { // 시야 방향 부채꼴 + 내 위치
    const px = player.x * sx, py = player.y * sy;
    m.fillStyle = 'rgba(93,252,138,0.22)'; m.beginPath(); m.moveTo(px, py); m.arc(px, py, 34, yaw - 0.5, yaw + 0.5); m.closePath(); m.fill();
    m.fillStyle = '#5dfc8a'; m.strokeStyle = '#fff'; m.lineWidth = 1.5;
    m.beginPath(); m.moveTo(px + Math.cos(yaw) * 9, py + Math.sin(yaw) * 9); m.lineTo(px + Math.cos(yaw + 2.5) * 7, py + Math.sin(yaw + 2.5) * 7); m.lineTo(px + Math.cos(yaw - 2.5) * 7, py + Math.sin(yaw - 2.5) * 7); m.closePath(); m.fill(); m.stroke();
  }
}
