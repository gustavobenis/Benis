import type { Mesh } from '@babylonjs/core';
import type { CollisionWorld, Shape } from '../physics/CollisionWorld';

export interface GateSpec { x: number; z: number; hx: number; hz: number; h: number }

/**
 * Passagem selada (muralha de teia, barricada…): paredes laterais fixas + uma abertura bloqueada
 * que se desfaz com uma animação. Reutilizável pelas fases que fecham o caminho até um objetivo.
 */
export class SealedGate {
  open = false;
  private shape: Shape; private anim = -1;
  constructor(private world: CollisionWorld, bounds: [number, number, number, number], g: GateSpec, private mesh: Mesh, private baseY: number) {
    const lw = (g.x - g.hx) - bounds[0], rw = bounds[1] - (g.x + g.hx);
    world.add({ kind: 'box', x: bounds[0] + lw / 2, z: g.z, hx: lw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    world.add({ kind: 'box', x: g.x + g.hx + rw / 2, z: g.z, hx: rw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.shape = world.add({ kind: 'box', x: g.x, z: g.z, hx: g.hx, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
  }

  openNow(instant = false): void {
    if (this.open) return;
    this.open = true;
    this.world.shapes.splice(this.world.shapes.indexOf(this.shape), 1);
    this.anim = instant ? 1 : 0;
    if (instant) this.mesh.setEnabled(false);
  }

  close(): void {
    if (!this.open) return;
    this.open = false; this.anim = -1;
    this.world.shapes.push(this.shape);
    this.mesh.setEnabled(true); this.mesh.scaling.y = 1; this.mesh.position.y = this.baseY;
  }

  update(dt: number): void {
    if (this.anim < 0 || this.anim >= 1) return;
    this.anim = Math.min(1, this.anim + dt / 1.8);
    const k = this.anim;
    this.mesh.scaling.y = 1 - k * 0.97; this.mesh.position.y = this.baseY * (1 - k * 0.97);
    if (k >= 1) this.mesh.setEnabled(false);
  }
}
