import { FreeCamera, Vector3, Scalar } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { CollisionWorld } from '../physics/CollisionWorld';

export type CameraMode = 'third' | 'first' | 'orbital';
export const CAMERA_MODES: CameraMode[] = ['third', 'first', 'orbital'];
export const CAMERA_LABEL: Record<CameraMode, string> = { third: 'Terceira pessoa', first: 'Primeira pessoa', orbital: 'Câmera orbital' };

/**
 * Câmera única com três modos. Em todos os modos o movimento é relativo ao `yaw` da câmera,
 * então alternar não muda a orientação percebida nem teleporta o personagem.
 */
export class CameraRig {
  readonly camera: FreeCamera;
  mode: CameraMode = 'third';
  yaw = 0;
  pitch = 0.45; // positivo = olhando para baixo
  private dist = 7.5;
  private targetDist = 7.5;
  private pos = new Vector3();
  private lookAtPos = new Vector3();
  private fovBase = 1.0;
  private bobT = 0;
  distanceScale = 1;
  reduceMotion = false;

  constructor(scene: Scene, public world: CollisionWorld) {
    this.camera = new FreeCamera('cam', new Vector3(0, 4, -10), scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 600;
    this.camera.fov = this.fovBase;
    this.camera.inputs.clear(); // controle 100% por código
    scene.activeCamera = this.camera;
  }

  setMode(m: CameraMode): void {
    this.mode = m;
    if (m === 'third') { this.targetDist = 7.5; this.pitch = Math.min(Math.max(this.pitch, 0.15), 1.2); }
    if (m === 'orbital') { this.targetDist = 11; }
    if (m === 'first') this.pitch = Math.min(Math.max(this.pitch, -1.2), 1.2);
  }
  cycle(): CameraMode {
    this.setMode(CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length]);
    return this.mode;
  }

  /** Aplica rotação/zoom da entrada. */
  look(dx: number, dy: number, zoom: number): void {
    this.yaw += dx;
    const [lo, hi] = this.mode === 'first' ? [-1.35, 1.35] : this.mode === 'orbital' ? [-0.5, 1.45] : [-0.05, 1.3];
    this.pitch = Scalar.Clamp(this.pitch + dy, lo, hi);
    if (this.mode !== 'first') {
      const [dlo, dhi] = this.mode === 'orbital' ? [3, 22] : [3, 14];
      this.targetDist = Scalar.Clamp(this.targetDist + zoom, dlo, dhi);
    }
  }

  /** Vetor "frente" no plano horizontal para o yaw atual (convenção Babylon: +Z é yaw 0). */
  forward(): [number, number] { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }

  update(dt: number, feet: Vector3, speed01: number, snap = false): void {
    const follow = snap ? 1 : 1 - Math.exp(-14 * dt);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw) * cp, fy = -sp, fz = Math.cos(this.yaw) * cp; // direção do olhar

    let wantPos: Vector3, wantLook: Vector3;
    if (this.mode === 'first') {
      this.bobT += dt * (6 + 6 * speed01);
      const bob = this.reduceMotion ? 0 : Math.sin(this.bobT) * 0.035 * speed01;
      wantPos = new Vector3(feet.x + Math.sin(this.yaw) * 0.5, feet.y + 0.62 + bob, feet.z + Math.cos(this.yaw) * 0.5);
      wantLook = wantPos.add(new Vector3(fx, fy, fz));
      this.pos.copyFrom(wantPos); // 1ª pessoa não suaviza posição: evita enjoo e atraso
      this.lookAtPos.copyFrom(wantLook);
    } else {
      this.dist += (this.targetDist * this.distanceScale - this.dist) * (1 - Math.exp(-8 * dt));
      const pivot = new Vector3(feet.x, feet.y + 0.9, feet.z);
      const desired = new Vector3(pivot.x - fx * this.dist, pivot.y - fy * this.dist, pivot.z - fz * this.dist);
      const t = this.world.cameraClip([pivot.x, pivot.y, pivot.z], [desired.x, desired.y, desired.z]);
      wantPos = Vector3.Lerp(pivot, desired, t);
      wantLook = pivot;
      Vector3.LerpToRef(this.pos, wantPos, t < 1 ? 1 : follow, this.pos);
      Vector3.LerpToRef(this.lookAtPos, wantLook, follow, this.lookAtPos);
    }
    const targetFov = this.mode === 'first' ? 1.15 : this.fovBase + 0.08 * speed01 * (this.reduceMotion ? 0 : 1);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
    this.camera.position.copyFrom(this.pos);
    this.camera.setTarget(this.lookAtPos);
  }

  /** Posição para o áudio 3D. */
  get position(): Vector3 { return this.camera.position; }
}
