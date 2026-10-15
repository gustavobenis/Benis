import { DynamicTexture, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { Difficulty } from '../systems/Settings';

export type BirdEvent = 'warn' | 'caught' | null;

const CFG: Record<Difficulty, { speed: number; radius: number; catchAfter: number; interval: number }> = {
  calm: { speed: 15, radius: 4, catchAfter: Infinity, interval: 70 },
  balanced: { speed: 20, radius: 4.5, catchAfter: 0.3, interval: 52 },
  explorer: { speed: 24, radius: 5.5, catchAfter: 0.2, interval: 40 },
};

/**
 * Sombra de um pássaro que cruza o jardim. Marieta deve procurar cobertura (folhas, cogumelos)
 * ou sair da trajetória. Se for pega, volta ao último checkpoint — sem violência.
 */
export class BirdShadow {
  readonly mesh: Mesh;
  active = false;
  private x = 0; private z = 0; private dx = 0; private dz = 0; private traveled = 0; private total = 0;
  private exposure = 0;
  private nextAt = 38;
  private clock = 0;
  /** 0..1 — proximidade da sombra (para o alerta visual e a trilha de tensão). */
  danger = 0;

  constructor(scene: Scene) {
    const tex = new DynamicTexture('birdTex', { width: 256, height: 256 }, scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 256); c.fillStyle = 'rgba(0,0,0,0.62)';
    c.beginPath(); c.ellipse(128, 128, 22, 52, 0, 0, 7); c.fill();                                // corpo
    c.beginPath(); c.moveTo(118, 100); c.quadraticCurveTo(40, 80, 8, 128); c.quadraticCurveTo(60, 120, 118, 140); c.fill(); // asa esq.
    c.beginPath(); c.moveTo(138, 100); c.quadraticCurveTo(216, 80, 248, 128); c.quadraticCurveTo(196, 120, 138, 140); c.fill(); // asa dir.
    c.beginPath(); c.moveTo(118, 170); c.lineTo(128, 224); c.lineTo(138, 170); c.fill();            // cauda
    tex.update(); tex.hasAlpha = true;
    const mat = new StandardMaterial('birdMat', scene);
    mat.diffuseTexture = tex; mat.useAlphaFromDiffuseTexture = true; mat.specularColor.set(0, 0, 0); mat.emissiveColor.set(0, 0, 0); mat.disableLighting = true; mat.backFaceCulling = false;
    this.mesh = MeshBuilder.CreateGround('birdShadow', { width: 1, height: 1 }, scene);
    this.mesh.material = mat; this.mesh.isPickable = false; this.mesh.setEnabled(false);
  }

  reset(): void { this.active = false; this.mesh.setEnabled(false); this.exposure = 0; this.danger = 0; this.clock = 0; this.nextAt = 38; }

  update(dt: number, p: { x: number; y: number; z: number; vx: number; vz: number }, world: CollisionWorld, diff: Difficulty, allowed: boolean): BirdEvent {
    const cfg = CFG[diff];
    this.clock += dt;
    let ev: BirdEvent = null;
    if (!this.active && allowed && this.clock >= this.nextAt) {
      this.spawnThrough(p.x + p.vx * 2.2, p.z + p.vz * 2.2, Math.random() * Math.PI * 2, diff);
      ev = 'warn';
    }
    if (!this.active) { this.danger = Math.max(0, this.danger - dt); return ev; }
    this.x += this.dx * cfg.speed * dt; this.z += this.dz * cfg.speed * dt; this.traveled += cfg.speed * dt;
    this.mesh.position.set(this.x, 0.07, this.z);
    const dist = Math.hypot(p.x - this.x, p.z - this.z);
    this.danger = Math.max(0, Math.min(1, 1 - dist / 55));
    const under = dist < cfg.radius && !world.isCovered(p.x, p.z, p.y);
    this.exposure = under ? this.exposure + dt : Math.max(0, this.exposure - dt * 2);
    if (this.exposure > cfg.catchAfter) { this.deactivate(cfg.interval); return 'caught'; }
    if (this.traveled > this.total) this.deactivate(cfg.interval);
    return ev;
  }

  /** Inicia uma passagem cuja trajetória cruza (tx, tz) vindo da direção `angle`. Público para testes. */
  spawnThrough(tx: number, tz: number, angle: number, diff: Difficulty): void {
    const cfg = CFG[diff];
    this.dx = Math.sin(angle); this.dz = Math.cos(angle);
    this.total = 150; this.traveled = 0;
    this.x = tx - (this.dx * this.total) / 2; this.z = tz - (this.dz * this.total) / 2;
    this.active = true; this.exposure = 0; this.mesh.setEnabled(true);
    this.mesh.scaling.set(cfg.radius * 2.4, 1, cfg.radius * 2.4);
    this.mesh.rotation.y = Math.atan2(this.dx, this.dz);
  }

  private deactivate(interval: number): void {
    this.active = false; this.mesh.setEnabled(false); this.exposure = 0;
    this.nextAt = this.clock + interval * (0.8 + Math.random() * 0.5);
  }
}
