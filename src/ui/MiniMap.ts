import * as D from '../levels/level1Data';
import type { Level1 } from '../levels/Level1';

export interface MapState { level: Level1; x: number; z: number; yaw: number; showItems: boolean; gateOpen: boolean }

/** Desenha o mapa simplificado do jardim (norte = +Z no topo). */
export function drawMap(c: HTMLCanvasElement, s: MapState): void {
  const g = c.getContext('2d'); if (!g) return;
  const [minX, maxX, minZ, maxZ] = D.BOUNDS;
  const W = c.width, H = c.height, pad = 6;
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX)) * (W - pad * 2);
  const sy = (z: number) => H - pad - ((z - minZ) / (maxZ - minZ)) * (H - pad * 2);
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(40,80,48,0.8)'; g.fillRect(pad, pad, W - pad * 2, H - pad * 2);
  // folhas e cogumelos
  g.fillStyle = 'rgba(120,200,110,0.7)';
  for (const l of D.LEAVES) { g.save(); g.translate(sx(l.x), sy(l.z)); g.rotate(l.yaw); g.beginPath(); g.ellipse(0, 0, l.hx * (W / 116) * 0.8, l.hz * (H / 196) * 0.8, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = 'rgba(200,90,70,0.8)';
  for (const m of D.MUSHROOMS) { g.beginPath(); g.arc(sx(m.x), sy(m.z), m.capR * (W / 116) * 0.8, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(130,130,120,0.9)';
  for (const t of D.STONES) { g.beginPath(); g.arc(sx(t.x), sy(t.z), t.r * (W / 116) * 0.8, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(90,170,200,0.7)';
  for (const p of D.PUDDLES) { g.beginPath(); g.ellipse(sx(p.x), sy(p.z), p.r * (W / 116), p.r * 0.75 * (H / 196), 0, 0, 7); g.fill(); }
  // portão
  g.strokeStyle = s.gateOpen ? '#8fe08f' : '#e9b95d'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(sx(D.GATE.x - D.GATE.hx), sy(D.GATE.z)); g.lineTo(sx(D.GATE.x + D.GATE.hx), sy(D.GATE.z)); g.stroke();
  // abrigo
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(sx(D.SHELTER.x), sy(D.SHELTER.z), 5, 0, 7); g.fill();
  // npcs
  g.fillStyle = '#f5c98a';
  for (const n of s.level.npcs) { g.beginPath(); g.arc(sx(n.x), sy(n.z), 3.5, 0, 7); g.fill(); }
  // itens (somente com assistência visual)
  if (s.showItems) for (const p of s.level.pickups) if (!p.taken) { g.fillStyle = p.def.kind === 'dew' ? '#a8f0ff' : '#ffb070'; g.beginPath(); g.arc(sx(p.def.x), sy(p.def.z), 2.4, 0, 7); g.fill(); }
  // jogador (seta)
  g.save(); g.translate(sx(s.x), sy(s.z)); g.rotate(s.yaw);
  g.fillStyle = '#ff4455'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
}
