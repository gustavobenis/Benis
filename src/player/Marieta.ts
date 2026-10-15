import { Mesh, MeshBuilder, TransformNode, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { Materials } from '../levels/Materials';

/** Modelo procedural de Marieta (joaninha): carapaça com élitros, 6 pernas articuladas, antenas e asas. */
export class MarietaModel {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private hips: { hip: TransformNode; knee: TransformNode; side: number; phase: number }[] = [];
  private antennae: TransformNode[] = [];
  private wings: TransformNode[] = [];
  private body: TransformNode;
  private t = 0;
  private wingOpen = 0;
  private blink = 0;
  private eyes: Mesh[] = [];

  constructor(scene: Scene, m: Materials) {
    this.root = new TransformNode('marieta', scene);
    this.body = new TransformNode('marietaBody', scene);
    this.body.parent = this.root;

    const part = (mesh: Mesh, mat: Mesh['material'], parent: TransformNode = this.body): Mesh => {
      mesh.material = mat; mesh.parent = parent; this.meshes.push(mesh); return mesh;
    };
    const sphere = (d: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const s = MeshBuilder.CreateSphere('s', { diameter: d, segments: 18 }, scene);
      s.scaling.set(sx, sy, sz); s.position.set(x, y, z); return s;
    };

    // Carapaça (élitros): elipsoide vermelha brilhante
    const R = { x: 0.52, y: 0.4, z: 0.62 }, C = { y: 0.56 };
    part(sphere(1, R.x * 2, R.y * 2, R.z * 2, 0, C.y, -0.02), m.shell);

    // Peças pretas fundidas num único mesh: abdômen inferior, pronoto, cabeça, linha central e manchas
    const blacks: Mesh[] = [
      sphere(1, 0.95, 0.34, 1.15, 0, 0.34, -0.02),
      sphere(1, 0.74, 0.46, 0.4, 0, 0.6, 0.52),
      sphere(1, 0.62, 0.52, 0.56, 0, 0.5, 0.82),
    ];
    const dirs: [number, number, number][] = [[0.55, 0.8, -0.05], [-0.55, 0.8, -0.05], [0.85, 0.45, 0.25], [-0.85, 0.45, 0.25], [0.8, 0.5, -0.45], [-0.8, 0.5, -0.45], [0, 0.9, -0.55]];
    for (const [dx, dy, dz] of dirs) {
      const l = Math.hypot(dx, dy, dz);
      const sp = sphere(1, 0.17, 0.17, 0.17, 0, 0, 0);
      sp.position.set((dx / l) * R.x * 0.99, C.y + (dy / l) * R.y * 0.99, -0.02 + (dz / l) * R.z * 0.99);
      sp.scaling.set(0.2, 0.2, 0.2);
      blacks.push(sp);
    }
    const path: Vector3[] = [];
    for (let a = -1.25; a <= 1.2; a += 0.12) path.push(new Vector3(0, C.y + R.y * Math.cos(a) * 1.005, -0.02 + R.z * Math.sin(a) * 1.005));
    blacks.push(MeshBuilder.CreateTube('seam', { path, radius: 0.014, tessellation: 6 }, scene));
    const black = Mesh.MergeMeshes(blacks, true, true) as Mesh;
    part(black, m.black);

    // Manchas brancas do pronoto
    const whites = [sphere(1, 0.2, 0.1, 0.17, 0.32, 0.72, 0.58), sphere(1, 0.2, 0.1, 0.17, -0.32, 0.72, 0.58)];
    whites.forEach((w) => { w.rotation.z = 0; });
    part(Mesh.MergeMeshes(whites, true, true) as Mesh, m.white);

    // Olhos grandes e expressivos
    for (const sx of [-1, 1]) {
      const eye = new TransformNode('eye', scene); eye.parent = this.body; eye.position.set(sx * 0.19, 0.58, 1.02);
      const eyeball = part(sphere(0.3, 1, 1.15, 1, 0, 0, 0), m.white, eye);
      eyeball.parent = eye;
      part(sphere(0.17, 1, 1.1, 0.7, sx * -0.01, -0.01, 0.1), m.black, eye);
      const hl = part(sphere(0.06, 1, 1, 1, sx * 0.03, 0.05, 0.15), m.white, eye);
      hl.name = 'hl';
      this.eyes.push(eyeball);
    }

    // Antenas
    for (const sx of [-1, 1]) {
      const a = new TransformNode('ant', scene); a.parent = this.body; a.position.set(sx * 0.12, 0.8, 1.02);
      a.rotation.x = -0.9; a.rotation.z = sx * -0.35;
      const stick = MeshBuilder.CreateCylinder('antStick', { height: 0.55, diameter: 0.04, tessellation: 6 }, scene);
      stick.position.y = 0.27; part(stick, m.black, a);
      const tip = sphere(0.1, 1, 1, 1, 0, 0.56, 0); part(tip, m.black, a);
      this.antennae.push(a);
    }

    // Seis pernas (marcha tripod)
    const defs: [number, number][] = [[-1, 0.32], [1, 0.32], [-1, 0], [1, 0], [-1, -0.32], [1, -0.32]];
    defs.forEach(([side, z], i) => {
      const hip = new TransformNode('hip', scene); hip.parent = this.body; hip.position.set(side * 0.3, 0.34, z);
      const up = MeshBuilder.CreateCylinder('up', { height: 0.3, diameter: 0.07, tessellation: 6 }, scene);
      up.position.y = -0.15; part(up, m.black, hip);
      const knee = new TransformNode('knee', scene); knee.parent = hip; knee.position.y = -0.3;
      const low = MeshBuilder.CreateCylinder('low', { height: 0.28, diameter: 0.055, tessellation: 6 }, scene);
      low.position.y = -0.14; part(low, m.black, knee);
      this.hips.push({ hip, knee, side, phase: i % 2 === 0 ? 0 : Math.PI });
      // alterna: frente-esq/meio-dir/trás-esq = mesma fase
      const group = (i === 0 || i === 3 || i === 4) ? 0 : Math.PI;
      this.hips[i].phase = group;
    });

    // Asas membranosas (aparecem ao planar)
    for (const sx of [-1, 1]) {
      const w = new TransformNode('wing', scene); w.parent = this.body; w.position.set(sx * 0.2, 0.92, -0.1);
      const mesh = sphere(1, 1.25, 0.03, 0.55, sx * 0.62, 0, -0.1);
      const wm = m.white.clone('wingMat'); wm.alpha = 0.5; wm.albedoColor.set(0.85, 0.92, 1); wm.backFaceCulling = false;
      part(mesh, wm, w);
      w.scaling.setAll(0.001);
      this.wings.push(w);
    }
  }

  setVisible(v: boolean): void { this.root.setEnabled(v); }

  /** Animação procedural conforme o estado de movimento. */
  animate(dt: number, speed: number, grounded: boolean, gliding: boolean, climbing: boolean): void {
    this.t += dt * (3 + speed * 1.3);
    const moving = Math.min(1, speed / 4);
    this.hips.forEach(({ hip, knee, side, phase }) => {
      const p = this.t * 2 + phase;
      const swing = grounded || climbing ? Math.sin(p) * 0.55 * moving : 0.25;
      const lift = grounded || climbing ? Math.max(0, Math.cos(p)) * 0.5 * moving : 0.5;
      hip.rotation.z = side * (0.85 + lift * 0.3);
      hip.rotation.x = swing;
      knee.rotation.z = -side * (0.85 + lift * 0.2);
    });
    // Respiração + balanço do corpo
    this.body.position.y = grounded ? Math.sin(this.t * 4) * 0.015 * moving + Math.sin(this.t * 0.7) * 0.006 : 0;
    this.body.rotation.z = grounded ? Math.sin(this.t * 2) * 0.03 * moving : 0;
    this.body.rotation.x = climbing ? -1.3 : gliding ? 0.15 : 0;
    this.antennae.forEach((a, i) => { a.rotation.x = -0.9 + Math.sin(this.t * 1.1 + i) * 0.12 * (0.4 + moving); });
    // Asas
    const target = gliding ? 1 : 0;
    this.wingOpen += (target - this.wingOpen) * (1 - Math.exp(-14 * dt));
    this.wings.forEach((w, i) => {
      const s = Math.max(0.001, this.wingOpen);
      w.scaling.setAll(s);
      w.rotation.z = (i === 0 ? -1 : 1) * (0.25 + Math.sin(this.t * 14) * 0.25 * this.wingOpen);
    });
    // Piscadas
    this.blink -= dt;
    if (this.blink < -3.2) this.blink = 0.12;
    const sy = this.blink > 0 ? 0.15 : 1.15;
    this.eyes.forEach((e) => { e.scaling.y += (sy - e.scaling.y) * 0.5; });
  }
}

/** Tito, o caracol sábio. */
export class SnailModel {
  readonly root: TransformNode;
  private stalks: TransformNode[] = [];
  private t = Math.random() * 10;
  constructor(scene: Scene, m: Materials, readonly meshes: AbstractMesh[] = []) {
    this.root = new TransformNode('tito', scene);
    const add = (mesh: Mesh, mat: Mesh['material'], parent: TransformNode = this.root) => { mesh.material = mat; mesh.parent = parent; this.meshes.push(mesh); return mesh; };
    const sp = (d: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
      const s = MeshBuilder.CreateSphere('s', { diameter: d, segments: 16 }, scene); s.scaling.set(sx, sy, sz); s.position.set(x, y, z); return s;
    };
    add(sp(1, 1.1, 0.7, 2.6, 0, 0.35, 0.1), m.snailBody);
    add(sp(1, 1, 0.9, 1, 0, 0.5, 1.4), m.snailBody);
    const shell = add(sp(1.9, 1, 1, 0.95, 0, 1.25, -0.4), m.snailShell);
    shell.rotation.z = 0.15;
    const ring = MeshBuilder.CreateTorus('ring', { diameter: 1.5, thickness: 0.28, tessellation: 24 }, scene);
    ring.rotation.z = Math.PI / 2; ring.position.set(0, 1.3, -0.4); add(ring, m.snailShell);
    for (const sx of [-1, 1]) {
      const st = new TransformNode('stalk', scene); st.parent = this.root; st.position.set(sx * 0.25, 0.85, 1.55);
      st.rotation.x = -0.2; st.rotation.z = sx * -0.25;
      const c = MeshBuilder.CreateCylinder('c', { height: 0.9, diameter: 0.14, tessellation: 8 }, scene); c.position.y = 0.45; add(c, m.snailBody, st);
      add(sp(0.34, 1, 1, 1, 0, 0.95, 0), m.white, st);
      add(sp(0.17, 1, 1, 1, 0, 0.95, 0.1), m.black, st);
      this.stalks.push(st);
    }
  }
  animate(dt: number): void {
    this.t += dt;
    this.stalks.forEach((s, i) => { s.rotation.x = -0.2 + Math.sin(this.t * 1.4 + i * 1.7) * 0.12; });
    this.root.scaling.y = 1 + Math.sin(this.t * 1.1) * 0.015;
  }
}
