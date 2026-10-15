import { Color3, DynamicTexture, Mesh, MeshBuilder, PBRMaterial, TransformNode } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { Materials } from '../levels/Materials';
import { SnailModel } from './Marieta';

export type NpcKind = 'snail' | 'ant' | 'butterfly' | 'beetle' | 'grasshopper' | 'spider' | 'queen';

/** Contrato comum dos personagens secundários. */
export interface NpcModel {
  root: TransformNode;
  meshes: AbstractMesh[];
  /** Quanto o NPC flutua acima do chão (borboleta). */
  hover: number;
  animate(dt: number): void;
}

function pbr(scene: Scene, name: string, c: Color3, rough = 0.4): PBRMaterial {
  const m = new PBRMaterial(name, scene); m.albedoColor = c; m.metallic = 0; m.roughness = rough; m.environmentIntensity = 0.9; return m;
}
function sphere(scene: Scene, d: number, sx: number, sy: number, sz: number, x: number, y: number, z: number): Mesh {
  const s = MeshBuilder.CreateSphere('s', { diameter: d, segments: 16 }, scene); s.scaling.set(sx, sy, sz); s.position.set(x, y, z); return s;
}

class SnailNpc implements NpcModel {
  private m: SnailModel;
  hover = 0;
  constructor(scene: Scene, mats: Materials) { this.m = new SnailModel(scene, mats); }
  get root() { return this.m.root; } get meshes() { return this.m.meshes; }
  animate(dt: number) { this.m.animate(dt); }
}

/** Lino: formiga trabalhadora com capacete amarelo. */
export class AntNpc implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 0;
  private legs: TransformNode[] = []; private ants: TransformNode[] = []; private t = Math.random() * 6; private body: TransformNode;
  constructor(scene: Scene, mats: Materials, queen = false) {
    this.root = new TransformNode(queen ? 'rainha' : 'lino', scene);
    this.body = new TransformNode('linoBody', scene); this.body.parent = this.root;
    const skin = pbr(scene, 'antSkin', new Color3(0.32, 0.12, 0.08), 0.35), hat = pbr(scene, 'hat', new Color3(0.98, 0.78, 0.15), 0.45);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.body) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, queen ? 1.5 : 0.9, queen ? 1.3 : 0.8, queen ? 2.4 : 1.4, 0, queen ? 1.1 : 0.9, queen ? -1.6 : -1.2), skin);   // abdômen
    add(sphere(scene, 1, 0.55, 0.55, 0.8, 0, 0.9, -0.2), skin);  // tórax
    add(sphere(scene, 1, 0.85, 0.8, 0.8, 0, 1.15, 0.65), skin);  // cabeça
    if (queen) {
      const gold = pbr(scene, 'gold', new Color3(0.95, 0.75, 0.2), 0.25);
      const ring = MeshBuilder.CreateTorus('crown', { diameter: 0.8, thickness: 0.12, tessellation: 20 }, scene); ring.position.set(0, 1.62, 0.62); add(ring, gold);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const sp = MeshBuilder.CreateCylinder('cs', { height: 0.35, diameterTop: 0, diameterBottom: 0.16, tessellation: 6 }, scene); sp.position.set(Math.cos(a) * 0.4, 1.82, 0.62 + Math.sin(a) * 0.4); add(sp, gold); }
    } else add(sphere(scene, 0.9, 1, 0.5, 1, 0, 1.6, 0.62), hat);       // capacete
    for (const sx of [-1, 1]) {
      add(sphere(scene, 0.34, 1, 1.1, 0.7, sx * 0.22, 1.2, 1.0), mats.white);
      add(sphere(scene, 0.17, 1, 1, 0.7, sx * 0.22, 1.2, 1.12), mats.black);
      const a = new TransformNode('a', scene); a.parent = this.body; a.position.set(sx * 0.15, 1.5, 0.95); a.rotation.set(-0.8, 0, sx * -0.3);
      const st = MeshBuilder.CreateCylinder('as', { height: 0.7, diameter: 0.05, tessellation: 6 }, scene); st.position.y = 0.35; add(st, skin, a); this.ants.push(a);
    }
    [[-1, 0.3], [1, 0.3], [-1, -0.2], [1, -0.2], [-1, -0.7], [1, -0.7]].forEach(([side, z]) => {
      const hip = new TransformNode('h', scene); hip.parent = this.body; hip.position.set(side * 0.22, 0.75, z); hip.rotation.z = side * 0.9;
      const l = MeshBuilder.CreateCylinder('l', { height: 0.9, diameter: 0.08, tessellation: 6 }, scene); l.position.y = -0.45; add(l, skin, hip); this.legs.push(hip);
    });
    this.root.scaling.setAll(queen ? 1.7 : 1.2);
  }
  /** `speed` > 0 acelera as pernas (formigas operárias andando). */
  walk = 0;
  animate(dt: number) {
    this.t += dt * (1 + this.walk * 3);
    this.body.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.05;
    this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 3 + i) * 0.12; });
    this.ants.forEach((a, i) => { a.rotation.x = -0.8 + Math.sin(this.t * 1.6 + i) * 0.15; });
  }
}

/** Luna: borboleta sábia, paira acima do chão. */
class ButterflyNpc implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 2.6;
  private wings: TransformNode[] = []; private t = Math.random() * 6;
  constructor(scene: Scene, mats: Materials) {
    this.root = new TransformNode('luna', scene);
    const body = pbr(scene, 'lunaBody', new Color3(0.18, 0.12, 0.25), 0.5);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.root) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, 0.4, 0.4, 1.7, 0, 0, 0), body);
    add(sphere(scene, 0.55, 1, 1, 1, 0, 0.05, 0.95), body);
    for (const sx of [-1, 1]) {
      add(sphere(scene, 0.3, 1, 1.1, 0.7, sx * 0.17, 0.12, 1.15), mats.white);
      add(sphere(scene, 0.15, 1, 1, 0.7, sx * 0.17, 0.12, 1.26), mats.black);
      const an = MeshBuilder.CreateCylinder('an', { height: 0.9, diameter: 0.03, tessellation: 5 }, scene);
      an.position.set(sx * 0.15, 0.55, 1.25); an.rotation.set(-0.6, 0, sx * -0.4); add(an, body);
    }
    const tex = new DynamicTexture('wingT', { width: 128, height: 128 }, scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(20, 64, 4, 70, 64, 80); g.addColorStop(0, '#b684f0'); g.addColorStop(0.55, '#e990d4'); g.addColorStop(1, '#6fb5f0');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(60 + i * 10, 30 + (i % 3) * 30, 4, 0, 7); c.fill(); }
    tex.update();
    const wm = pbr(scene, 'wingM', new Color3(1, 1, 1), 0.5); wm.albedoTexture = tex; wm.backFaceCulling = false; wm.emissiveColor = new Color3(0.12, 0.06, 0.14);
    for (const sx of [-1, 1]) {
      const w = new TransformNode('w', scene); w.parent = this.root; w.position.set(sx * 0.2, 0.25, 0.2);
      const up = MeshBuilder.CreateDisc('wu', { radius: 1.2, tessellation: 20 }, scene); up.rotation.x = Math.PI / 2; up.scaling.set(1, 0.85, 1); up.position.set(sx * 1.05, 0, 0.3); add(up, wm, w);
      const lo = MeshBuilder.CreateDisc('wl', { radius: 0.8, tessellation: 18 }, scene); lo.rotation.x = Math.PI / 2; lo.position.set(sx * 0.7, 0, -0.55); add(lo, wm, w);
      this.wings.push(w);
    }
    this.root.scaling.setAll(1.2);
  }
  animate(dt: number) {
    this.t += dt;
    const f = Math.sin(this.t * 5) * 0.55;
    this.wings.forEach((w, i) => { w.rotation.z = (i === 0 ? 1 : -1) * (0.25 + f); });
    this.root.position.y += (this.hover + Math.sin(this.t * 1.7) * 0.25 - this.root.position.y) * Math.min(1, dt * 4);
  }
}

/** Beto: besouro de carapaça verde-esmeralda com detalhes âmbar. */
class BeetleNpc implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 0;
  private ants: TransformNode[] = []; private t = Math.random() * 6; private body: TransformNode;
  constructor(scene: Scene, mats: Materials) {
    this.root = new TransformNode('beto', scene);
    this.body = new TransformNode('betoBody', scene); this.body.parent = this.root;
    const shell = pbr(scene, 'betoShell', new Color3(0.07, 0.55, 0.36), 0.2); shell.clearCoat.isEnabled = true; shell.clearCoat.intensity = 1; shell.clearCoat.roughness = 0.05;
    const dark = pbr(scene, 'betoDark', new Color3(0.04, 0.12, 0.09), 0.35), amber = pbr(scene, 'amber', new Color3(0.95, 0.62, 0.12), 0.3);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.body) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, 1.5, 1.1, 1.9, 0, 0.95, -0.1), shell);
    add(sphere(scene, 1, 1.4, 0.5, 1.7, 0, 0.55, -0.1), dark);
    const seam = MeshBuilder.CreateBox('seam', { width: 0.04, height: 0.04, depth: 1.7 }, scene); seam.position.set(0, 1.5, -0.1); add(seam, amber);
    add(sphere(scene, 1, 1.0, 0.7, 0.7, 0, 0.95, 1.0), dark);
    add(sphere(scene, 1, 0.85, 0.85, 0.85, 0, 0.95, 1.35), dark);
    for (const sx of [-1, 1]) {
      add(sphere(scene, 0.4, 1, 1.15, 1, sx * 0.26, 1.05, 1.62), mats.white);
      add(sphere(scene, 0.22, 1, 1, 0.7, sx * 0.26, 1.05, 1.77), mats.black);
      const a = new TransformNode('a', scene); a.parent = this.body; a.position.set(sx * 0.2, 1.3, 1.6); a.rotation.set(-0.7, sx * -0.3, 0);
      const st = MeshBuilder.CreateCylinder('as', { height: 0.9, diameter: 0.06, tessellation: 6 }, scene); st.position.y = 0.45; add(st, amber, a);
      add(sphere(scene, 0.16, 1, 1, 1, 0, 0.92, 0), amber, a); this.ants.push(a);
      for (const z of [0.6, 0, -0.6]) {
        const hip = new TransformNode('h', scene); hip.parent = this.body; hip.position.set(sx * 0.6, 0.55, z); hip.rotation.z = sx * 0.9;
        const l = MeshBuilder.CreateCylinder('l', { height: 0.7, diameter: 0.1, tessellation: 6 }, scene); l.position.y = -0.35; add(l, dark, hip);
      }
    }
    this.root.scaling.setAll(1.15);
  }
  animate(dt: number) {
    this.t += dt;
    this.body.position.y = Math.sin(this.t * 1.6) * 0.02;
    this.ants.forEach((a, i) => { a.rotation.x = -0.7 + Math.sin(this.t * 1.3 + i) * 0.12; });
  }
}

/** Aranha de 8 patas: Dona Olívia (protetora, roxa) ou a caçadora da floresta (escura, olhos vermelhos). */
export class SpiderModel implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 0;
  private legs: { hip: TransformNode; knee: TransformNode; side: number; phase: number }[] = [];
  private t = Math.random() * 6; private body: TransformNode; private moving = 0;
  constructor(scene: Scene, mats: Materials, readonly hunter = false) {
    this.root = new TransformNode(hunter ? 'hunter' : 'olivia', scene);
    this.body = new TransformNode('spBody', scene); this.body.parent = this.root;
    const skin = pbr(scene, 'spSkin', hunter ? new Color3(0.09, 0.07, 0.06) : new Color3(0.42, 0.2, 0.5), 0.5);
    const mark = pbr(scene, 'spMark', hunter ? new Color3(0.5, 0.12, 0.08) : new Color3(0.95, 0.85, 0.6), 0.45);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.body) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, 1.5, 1.2, 1.8, 0, 1.1, -1.1), skin);
    add(sphere(scene, 1, 0.5, 0.35, 0.9, 0, 1.75, -1.0), mark);
    add(sphere(scene, 1, 1.0, 0.8, 1.1, 0, 0.95, 0.5), skin);
    const eyeMat = hunter ? pbr(scene, 'hEye', new Color3(0.9, 0.1, 0.05), 0.2) : mats.white;
    eyeMat.emissiveColor = hunter ? new Color3(0.6, 0.05, 0.02) : eyeMat.emissiveColor;
    for (const sx of [-1, 1]) {
      add(sphere(scene, hunter ? 0.22 : 0.42, 1, 1.1, 0.8, sx * 0.24, 1.2, 1.0), eyeMat);
      if (!hunter) add(sphere(scene, 0.22, 1, 1, 0.8, sx * 0.24, 1.2, 1.17), mats.black);
      add(sphere(scene, 0.14, 1, 1, 1, sx * 0.45, 1.05, 0.95), eyeMat);
    }
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1, row = i >> 1;
      const hip = new TransformNode('h', scene); hip.parent = this.body; hip.position.set(side * 0.4, 1.0, 0.85 - row * 0.45);
      hip.rotation.y = side * (0.35 + row * 0.35 - 0.45); hip.rotation.z = side * 1.0;
      const up = MeshBuilder.CreateCylinder('u', { height: 1.3, diameter: 0.12, tessellation: 6 }, scene); up.position.y = -0.65; add(up, skin, hip);
      const knee = new TransformNode('k', scene); knee.parent = hip; knee.position.y = -1.3; knee.rotation.z = -side * 1.5;
      const lo = MeshBuilder.CreateCylinder('lo', { height: 1.5, diameter: 0.09, tessellation: 6 }, scene); lo.position.y = -0.75; add(lo, skin, knee);
      this.legs.push({ hip, knee, side, phase: (i + row) % 2 ? 0 : Math.PI });
    }
    this.root.scaling.setAll(hunter ? 1.1 : 1.5);
  }
  /** `speed` em unidades/s: anima as patas ao andar. */
  setMoving(speed: number): void { this.moving = Math.min(1, speed / 4); }
  animate(dt: number) {
    this.t += dt;
    this.body.position.y = Math.sin(this.t * 1.5) * 0.03;
    this.legs.forEach((l) => { l.hip.rotation.x = Math.sin(this.t * 9 + l.phase) * 0.35 * this.moving + Math.sin(this.t + l.phase) * 0.03; });
  }
}

/** Louva-a-deus: caçador alto e discreto, de braços raptoriais. */
export class MantisModel implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 0;
  private legs: { hip: TransformNode; phase: number }[] = []; private arms: TransformNode[] = []; private t = Math.random() * 6; private moving = 0; private body: TransformNode;
  constructor(scene: Scene, mats: Materials) {
    this.root = new TransformNode('mantis', scene);
    this.body = new TransformNode('mBody', scene); this.body.parent = this.root;
    const skin = pbr(scene, 'mSkin', new Color3(0.55, 0.8, 0.25), 0.4), dark = pbr(scene, 'mDark', new Color3(0.25, 0.4, 0.1), 0.5);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.body) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, 0.8, 0.7, 3.4, 0, 2.2, -1.4), skin);
    const th = add(sphere(scene, 1, 0.55, 0.55, 2.6, 0, 2.9, 0.7), skin); th.rotation.x = -0.5;
    add(sphere(scene, 1, 0.9, 0.7, 0.9, 0, 3.9, 1.5), skin);
    for (const sx of [-1, 1]) {
      add(sphere(scene, 0.55, 1, 1.2, 1, sx * 0.5, 4.0, 1.55), mats.white);
      add(sphere(scene, 0.25, 1, 1, 0.8, sx * 0.5, 4.0, 1.78), mats.black);
      const arm = new TransformNode('arm', scene); arm.parent = this.body; arm.position.set(sx * 0.35, 3.2, 1.0); arm.rotation.x = -0.6;
      const up = MeshBuilder.CreateCylinder('au', { height: 1.7, diameter: 0.22, tessellation: 6 }, scene); up.position.set(0, 0, 0.4); up.rotation.x = Math.PI / 2 - 0.2; add(up, skin, arm);
      const lo = MeshBuilder.CreateCylinder('al', { height: 1.5, diameterTop: 0.05, diameterBottom: 0.2, tessellation: 6 }, scene); lo.position.set(0, -0.6, 1.2); lo.rotation.x = 0.3; add(lo, dark, arm);
      this.arms.push(arm);
      for (const z of [0.0, -1.4]) {
        const hip = new TransformNode('mh', scene); hip.parent = this.body; hip.position.set(sx * 0.45, 2.0, z); hip.rotation.z = sx * 0.7;
        const l = MeshBuilder.CreateCylinder('ml', { height: 2.2, diameter: 0.1, tessellation: 5 }, scene); l.position.y = -1.1; add(l, skin, hip);
        this.legs.push({ hip, phase: (z === 0 ? 0 : Math.PI) + (sx > 0 ? Math.PI : 0) });
      }
    }
    this.root.scaling.setAll(1.15);
  }
  setMoving(speed: number): void { this.moving = Math.min(1, speed / 4); }
  animate(dt: number) {
    this.t += dt;
    this.body.position.y = Math.sin(this.t * 2.4) * 0.05 * (0.3 + this.moving);
    this.arms.forEach((a, i) => { a.rotation.x = -0.6 + Math.sin(this.t * 1.5 + i) * 0.12; });
    this.legs.forEach((l) => { l.hip.rotation.x = Math.sin(this.t * 6 + l.phase) * 0.4 * this.moving; });
  }
}

/** Tico: gafanhoto alegre, de pernas traseiras grandes. */
class GrasshopperNpc implements NpcModel {
  readonly root: TransformNode; readonly meshes: AbstractMesh[] = []; hover = 0;
  private ants: TransformNode[] = []; private hind: TransformNode[] = []; private t = Math.random() * 6; private body: TransformNode;
  constructor(scene: Scene, mats: Materials) {
    this.root = new TransformNode('tico', scene);
    this.body = new TransformNode('ticoBody', scene); this.body.parent = this.root;
    const skin = pbr(scene, 'ghSkin', new Color3(0.45, 0.72, 0.15), 0.4), belly = pbr(scene, 'ghBelly', new Color3(0.85, 0.85, 0.35), 0.5);
    const add = (m: Mesh, mat: Mesh['material'], parent: TransformNode = this.body) => { m.material = mat; m.parent = parent; this.meshes.push(m); return m; };
    add(sphere(scene, 1, 0.7, 0.6, 2.4, 0, 1.3, -0.5), skin);
    add(sphere(scene, 1, 0.6, 0.4, 2.0, 0, 1.05, -0.5), belly);
    add(sphere(scene, 1, 0.75, 0.9, 0.95, 0, 1.55, 0.95), skin);
    for (const sx of [-1, 1]) {
      add(sphere(scene, 0.42, 1, 1.2, 0.9, sx * 0.3, 1.8, 1.2), mats.white);
      add(sphere(scene, 0.22, 1, 1, 0.8, sx * 0.3, 1.8, 1.38), mats.black);
      const a = new TransformNode('a', scene); a.parent = this.body; a.position.set(sx * 0.15, 2.0, 1.2); a.rotation.set(-0.5, sx * -0.3, 0);
      const st = MeshBuilder.CreateCylinder('as', { height: 1.6, diameter: 0.05, tessellation: 5 }, scene); st.position.y = 0.8; add(st, skin, a); this.ants.push(a);
      const hip = new TransformNode('hh', scene); hip.parent = this.body; hip.position.set(sx * 0.4, 1.3, -1.0); hip.rotation.set(0.0, 0, sx * 0.2);
      const th = MeshBuilder.CreateCylinder('th', { height: 1.5, diameter: 0.26, tessellation: 7 }, scene); th.rotation.x = Math.PI / 2 - 0.5; th.position.set(0, 0.35, -0.65); add(th, skin, hip);
      const sh = MeshBuilder.CreateCylinder('sh', { height: 1.6, diameter: 0.1, tessellation: 6 }, scene); sh.position.set(0, -0.1, -1.35); sh.rotation.x = 0.4; add(sh, skin, hip); this.hind.push(hip);
      for (const z of [0.5, 0.0]) { const l = MeshBuilder.CreateCylinder('l', { height: 1.0, diameter: 0.08, tessellation: 5 }, scene); l.position.set(sx * 0.45, 0.6, z); l.rotation.z = sx * 0.2; add(l, skin); }
    }
    this.root.scaling.setAll(1.1);
  }
  animate(dt: number) {
    this.t += dt;
    this.body.position.y = Math.abs(Math.sin(this.t * 2)) * 0.05;
    this.ants.forEach((a, i) => { a.rotation.x = -0.5 + Math.sin(this.t * 1.8 + i * 2) * 0.2; });
    this.hind.forEach((h, i) => { h.rotation.x = Math.sin(this.t * 1.2 + i) * 0.05; });
  }
}

export function createNpcModel(kind: NpcKind, scene: Scene, mats: Materials): NpcModel {
  switch (kind) {
    case 'ant': return new AntNpc(scene, mats);
    case 'queen': return new AntNpc(scene, mats, true);
    case 'butterfly': return new ButterflyNpc(scene, mats);
    case 'beetle': return new BeetleNpc(scene, mats);
    case 'grasshopper': return new GrasshopperNpc(scene, mats);
    case 'spider': return new SpiderModel(scene, mats, false);
    default: return new SnailNpc(scene, mats);
  }
}
