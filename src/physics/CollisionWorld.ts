/**
 * Mundo de colisão simplificado (sem dependência do Babylon).
 *
 * Os colisores são formas simples e independentes dos modelos visuais:
 * cilindros (hastes, pedras, caules de cogumelo) e caixas orientadas
 * (folhas-plataforma). O chão base fica em y = 0.
 */
export type Surface = 'soil' | 'leaf' | 'stone' | 'wood' | 'moss';

/** Plataforma que se move (folhas flutuantes): oscila em torno de (cx,cz). */
export interface Mover { ax: number; az: number; speed: number; phase: number; cx: number; cz: number; dx: number; dz: number }

interface Base {
  /** Altura da base da forma (parte de baixo). */
  yBase: number;
  /** Altura do topo, onde se pode pisar. */
  yTop: number;
  surface: Surface;
  /** Pode ser escalado por Marieta. */
  climbable?: boolean;
  /** Impede a passagem horizontal por baixo? (padrão: sim quando yBase < altura do corpo) */
  id?: string;
  move?: Mover;
  /** Cogumelo-trampolim: ao pousar, lança para cima com esta velocidade. */
  bounce?: number;
}
export interface CylinderShape extends Base { kind: 'cyl'; x: number; z: number; r: number }
export interface BoxShape extends Base { kind: 'box'; x: number; z: number; hx: number; hz: number; yaw: number }
export type Shape = CylinderShape | BoxShape;

export interface WaterRect { minX: number; maxX: number; minZ: number; maxZ: number; flowX: number; flowZ: number }

export interface Zone { id: string; x: number; z: number; r: number; type: 'puddle' | 'checkpoint' | 'goal' | 'glide' | 'web' | 'updraft'; /** Updraft: altura máxima da corrente de ar. */ top?: number }

export interface Body {
  x: number; y: number; z: number; // y = pés
  vx: number; vy: number; vz: number;
  radius: number;
  height: number;
  grounded: boolean;
  surface: Surface;
  climbing: boolean;
  /** Na água (sem apoio): arrastado pela correnteza. */
  inWater: boolean;
  support: Shape | null;
}

export const GRAVITY = 24;
export const STEP_HEIGHT = 0.7;

export function createBody(x: number, y: number, z: number): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, radius: 0.45, height: 0.7, grounded: false, surface: 'soil', climbing: false, inWater: false, support: null };
}

/** Distância assinada simplificada ponto→forma no plano XZ (negativo = dentro). */
function planarDistance(s: Shape, px: number, pz: number): { d: number; nx: number; nz: number } {
  if (s.kind === 'cyl') {
    const dx = px - s.x, dz = pz - s.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    return { d: len - s.r, nx: dx / len, nz: dz / len };
  }
  const c = Math.cos(-s.yaw), sn = Math.sin(-s.yaw);
  const dx = px - s.x, dz = pz - s.z;
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  const qx = Math.abs(lx) - s.hx, qz = Math.abs(lz) - s.hz;
  let d: number, nlx: number, nlz: number;
  if (qx > 0 || qz > 0) {
    const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    d = Math.hypot(ox, oz);
    nlx = (ox / (d || 1e-6)) * Math.sign(lx || 1);
    nlz = (oz / (d || 1e-6)) * Math.sign(lz || 1);
  } else if (qx > qz) {
    d = qx; nlx = Math.sign(lx || 1); nlz = 0;
  } else {
    d = qz; nlx = 0; nlz = Math.sign(lz || 1);
  }
  const c2 = Math.cos(s.yaw), s2 = Math.sin(s.yaw);
  return { d, nx: nlx * c2 - nlz * s2, nz: nlx * s2 + nlz * c2 };
}

export class CollisionWorld {
  readonly shapes: Shape[] = [];
  readonly zones: Zone[] = [];
  readonly waters: WaterRect[] = [];
  /** Retângulo jogável: [minX, maxX, minZ, maxZ]. */
  bounds: [number, number, number, number] = [-40, 40, -60, 60];
  killY = -8;

  add(s: Shape): Shape { this.shapes.push(s); return s; }

  /** Altura e material do chão sob (x,z) alcançável a partir de `feet`. */
  groundAt(x: number, z: number, feet: number, radius = 0.2): { y: number; surface: Surface; shape: Shape | null } {
    let y = 0;
    let surface: Surface = 'soil';
    let shape: Shape | null = null;
    for (const s of this.shapes) {
      if (s.yTop > feet + STEP_HEIGHT) continue;
      if (s.yTop <= y) continue;
      if (planarDistance(s, x, z).d < radius) { y = s.yTop; surface = s.surface; shape = s; }
    }
    return { y, surface, shape };
  }

  /** Atualiza plataformas móveis para o instante `t` e guarda o deslocamento do quadro (para carregar quem está em cima). */
  updateMovers(t: number): void {
    for (const s of this.shapes) {
      const m = s.move; if (!m) continue;
      const nx = m.cx + Math.sin(t * m.speed + m.phase) * m.ax, nz = m.cz + Math.sin(t * m.speed + m.phase) * m.az;
      m.dx = nx - s.x; m.dz = nz - s.z; s.x = nx; s.z = nz;
    }
  }

  waterAt(x: number, z: number): WaterRect | undefined {
    return this.waters.find((w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ);
  }

  /** Há algo acima da cabeça que cubra (x,z)? Usado para "abrigo" contra o pássaro. */
  isCovered(x: number, z: number, y: number): boolean {
    for (const s of this.shapes) {
      if (s.yBase > y + 1.2 && planarDistance(s, x, z).d < 0.1) return true;
    }
    return false;
  }

  zoneAt(x: number, z: number, type?: Zone['type']): Zone | undefined {
    return this.zones.find((zn) => (!type || zn.type === type) && Math.hypot(x - zn.x, z - zn.z) <= zn.r);
  }

  /**
   * Avança o corpo `dt` segundos. `wishX/wishZ` é a velocidade horizontal desejada.
   * `jump` dispara um salto se estiver no chão; `glide` reduz a queda.
   * Retorna eventos úteis ao jogo (aterrissagem, salto).
   */
  step(b: Body, dt: number, wishX: number, wishZ: number, opts: { accel: number; jump: boolean; jumpSpeed: number; glide: boolean; climb: boolean; climbSpeed: number }): { landed: boolean; jumped: boolean; bounced: boolean } {
    const ev = { landed: false, jumped: false, bounced: false };
    // Corrente de ar quente (térmica): no ar, empurra para cima até a altura máxima da zona
    for (const zn of this.zones) {
      if (zn.type !== 'updraft' || b.grounded || b.climbing) continue;
      if (Math.hypot(b.x - zn.x, b.z - zn.z) <= zn.r && b.y < (zn.top ?? 24) && b.vy < 7) b.vy = Math.min(7, b.vy + 46 * dt);
    }

    // Carregado por plataforma móvel
    if (b.grounded && b.support?.move) { b.x += b.support.move.dx; b.z += b.support.move.dz; }

    // Aceleração horizontal suave
    const k = 1 - Math.exp(-opts.accel * dt);
    b.vx += (wishX - b.vx) * k;
    b.vz += (wishZ - b.vz) * k;

    // Escalada em superfícies autorizadas
    b.climbing = false;
    if (opts.climb) {
      for (const s of this.shapes) {
        if (!s.climbable) continue;
        if (b.y > s.yTop - 0.2 || b.y + b.height < s.yBase) continue;
        const pd = planarDistance(s, b.x, b.z);
        if (pd.d < b.radius + 0.25) { b.climbing = true; break; }
      }
    }

    // Horizontal com colisão (sub-passos para não atravessar objetos finos)
    const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vz) * dt) / 0.25));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * sdt;
      b.z += b.vz * sdt;
      this.pushOut(b);
    }
    const [minX, maxX, minZ, maxZ] = this.bounds;
    b.x = Math.min(maxX, Math.max(minX, b.x));
    b.z = Math.min(maxZ, Math.max(minZ, b.z));

    // Vertical
    const g = this.groundAt(b.x, b.z, b.y, b.radius * 0.6);
    // Água: sem apoio e no nível da água, a correnteza arrasta
    const water = this.waterAt(b.x, b.z);
    b.inWater = !!water && b.grounded && g.shape === null && b.y <= 0.05;
    if (b.inWater && water) { b.x += water.flowX * dt; b.z += water.flowZ * dt; }
    if (b.climbing) {
      b.vy = opts.climbSpeed;
      b.y += b.vy * dt;
      b.grounded = false;
    } else {
      if (b.grounded && opts.jump) { b.vy = opts.jumpSpeed; b.grounded = false; ev.jumped = true; }
      const gravity = opts.glide && b.vy < 0 ? GRAVITY * 0.12 : GRAVITY;
      b.vy -= gravity * dt;
      if (opts.glide && b.vy < -2.2) b.vy = -2.2;
      b.y += b.vy * dt;
      // Teto
      if (b.vy > 0) {
        for (const s of this.shapes) {
          if (s.yBase > b.y + b.height * 0.5 && s.yBase < b.y + b.height + 0.05 && planarDistance(s, b.x, b.z).d < b.radius * 0.8) { b.vy = 0; b.y = s.yBase - b.height - 0.05; }
        }
      }
      if (b.y <= g.y && b.vy <= 0) {
        if (!b.grounded && b.vy < -4) ev.landed = true;
        b.y = g.y; b.vy = 0; b.grounded = true; b.surface = g.surface; b.support = g.shape;
      } else if (b.y - g.y > 0.08) {
        b.grounded = false;
      } else if (b.vy <= 0) {
        b.y = g.y; b.vy = 0; b.grounded = true; b.surface = g.surface; b.support = g.shape;
      }
    }
    // Trampolim
    if (b.grounded && !b.climbing && b.support?.bounce) { b.vy = b.support.bounce; b.grounded = false; b.support = null; ev.bounced = true; }
    return ev;
  }

  /** Empurra o corpo para fora de formas que bloqueiam (paredes). */
  private pushOut(b: Body): void {
    for (const s of this.shapes) {
      // Só bloqueia se os pés estão abaixo do degrau e a cabeça acima da base
      if (b.y >= s.yTop - STEP_HEIGHT) continue;
      if (b.y + b.height <= s.yBase) continue;
      const pd = planarDistance(s, b.x, b.z);
      const pen = b.radius - pd.d;
      if (pen > 0) {
        b.x += pd.nx * pen;
        b.z += pd.nz * pen;
        // Remove a componente de velocidade contra a parede
        const vn = b.vx * pd.nx + b.vz * pd.nz;
        if (vn < 0) { b.vx -= vn * pd.nx; b.vz -= vn * pd.nz; }
      }
    }
  }

  /** Recua a câmera ao longo do raio se atravessar um colisor. Retorna a fração segura (0..1]. */
  cameraClip(from: [number, number, number], to: [number, number, number], margin = 0.4): number {
    const n = 12;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t;
      const z = from[2] + (to[2] - from[2]) * t;
      if (y < margin) return Math.max(0.15, (i - 1) / n);
      for (const s of this.shapes) {
        if (y < s.yBase - margin || y > s.yTop + margin) continue;
        if (planarDistance(s, x, z).d < margin) return Math.max(0.15, (i - 1) / n);
      }
    }
    return 1;
  }
}
