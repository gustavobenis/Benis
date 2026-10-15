import type { LevelBase } from '../levels/LevelBase';

export interface MapState {
  level: LevelBase; x: number; z: number; yaw: number; showItems: boolean;
  /** Alvo do objetivo atual (ponto dourado; nas bordas vira seta). */
  target?: { x: number; z: number };
}

/**
 * Desenha o mapa. `half` > 0: radar circular centrado em Marieta (HUD), mostrando ±half unidades.
 * `half` = 0: mapa completo da fase (menu de pausa). Norte = +Z no topo.
 */
export function drawMap(c: HTMLCanvasElement, s: MapState, half = 0): void {
  const g = c.getContext('2d'); if (!g) return;
  const m = s.level.map;
  const [minX, maxX, minZ, maxZ] = m.bounds;
  const W = c.width, H = c.height;
  const local = half > 0;
  const k = local ? W / 2 / half : Math.min((W - 12) / (maxX - minX), (H - 12) / (maxZ - minZ));
  const ox = local ? W / 2 - s.x * k : W / 2 - ((minX + maxX) / 2) * k;
  const oy = local ? H / 2 + s.z * k : H / 2 + ((minZ + maxZ) / 2) * k;
  const sx = (x: number) => ox + x * k, sy = (z: number) => oy - z * k;

  g.clearRect(0, 0, W, H);
  g.save();
  if (local) { g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, 7); g.clip(); g.fillStyle = '#143a26'; g.fillRect(0, 0, W, H); }
  g.fillStyle = 'rgba(46,122,74,0.9)'; g.fillRect(sx(minX), sy(maxZ), (maxX - minX) * k, (maxZ - minZ) * k);
  g.fillStyle = 'rgba(90,170,200,0.75)';
  for (const w of m.waters) g.fillRect(sx(w.minX), sy(w.maxZ), (w.maxX - w.minX) * k, (w.maxZ - w.minZ) * k);
  g.fillStyle = 'rgba(120,200,110,0.75)';
  for (const l of m.leaves) { g.save(); g.translate(sx(l.x), sy(l.z)); g.rotate(l.yaw); g.beginPath(); g.ellipse(0, 0, l.hx * k, l.hz * k, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = 'rgba(210,95,75,0.9)';
  for (const mu of m.mushrooms) { g.beginPath(); g.arc(sx(mu.x), sy(mu.z), mu.capR * k, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(140,140,130,0.95)';
  for (const t of m.stones) { g.beginPath(); g.arc(sx(t.x), sy(t.z), t.r * k, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(90,170,200,0.8)';
  for (const p of m.puddles) { g.beginPath(); g.ellipse(sx(p.x), sy(p.z), p.r * k, p.r * 0.75 * k, 0, 0, 7); g.fill(); }
  g.lineWidth = Math.max(2, 3 * (local ? 1 : 1));
  for (const l of m.dynamic?.() ?? []) { g.strokeStyle = l.color; g.beginPath(); g.moveTo(sx(l.x1), sy(l.z1)); g.lineTo(sx(l.x2), sy(l.z2)); g.stroke(); }
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(sx(m.goal.x), sy(m.goal.z), local ? 4 : 5, 0, 7); g.fill();
  g.fillStyle = '#f5c98a';
  for (const n of s.level.npcs) { g.beginPath(); g.arc(sx(n.x), sy(n.z), local ? 3 : 3.5, 0, 7); g.fill(); }
  if (s.showItems) for (const p of s.level.pickups) if (!p.taken) { g.fillStyle = '#a8f0ff'; g.beginPath(); g.arc(sx(p.def.x), sy(p.def.z), 2.4, 0, 7); g.fill(); }
  g.restore();

  // alvo do objetivo
  if (s.target) {
    let tx = sx(s.target.x), ty = sy(s.target.z);
    const cx = W / 2, cy = H / 2, R = (local ? W / 2 : Math.max(W, H)) - 10;
    const d = Math.hypot(tx - cx, ty - cy);
    const edge = local && d > R;
    if (edge) { tx = cx + ((tx - cx) / d) * R; ty = cy + ((ty - cy) / d) * R; }
    g.fillStyle = '#ffd24a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(tx, ty, edge ? 5 : 6, 0, 7); g.fill(); g.stroke();
  }

  // jogador (seta); no radar fica no centro
  g.save(); g.translate(local ? W / 2 : sx(s.x), local ? H / 2 : sy(s.z)); g.rotate(s.yaw);
  g.fillStyle = '#ff4455'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 2.5); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  if (local) { g.strokeStyle = 'rgba(233,185,93,0.85)'; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 2, 0, 7); g.stroke(); }
}
