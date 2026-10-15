import { Color3, Mesh, MeshBuilder, ParticleSystem, PointLight, TransformNode, Vector3, VertexBuffer, DynamicTexture, StandardMaterial } from '@babylonjs/core';
import type { AbstractMesh, Scene, Texture } from '@babylonjs/core';
import { CollisionWorld } from '../physics/CollisionWorld';
import type { Shape } from '../physics/CollisionWorld';
import { Materials, rng } from './Materials';
import { Grass } from './Grass';
import { SnailModel } from '../player/Marieta';
import * as D from './level1Data';

export interface Pickup { def: D.PickupDef; node: TransformNode; taken: boolean; marker: Mesh }
export interface Npc { id: string; x: number; z: number; model: SnailModel; marker: Mesh; baseYaw: number }

/** Constrói a Fase 1 — O Jardim das Gotas — e registra os colisores simples. */
export class Level1 {
  readonly world = new CollisionWorld();
  readonly mats: Materials;
  readonly pickups: Pickup[] = [];
  readonly npcs: Npc[] = [];
  readonly casters: AbstractMesh[] = [];
  readonly receivers: AbstractMesh[] = [];
  readonly reflectionList: AbstractMesh[] = [];
  grass!: Grass;
  gateOpen = false;
  private gateMesh!: Mesh;
  private gateShape!: Shape;
  private gateMarker!: Mesh;
  private shelterMarker!: Mesh;
  private gateAnim = -1;
  private sparkle: ParticleSystem;
  private markers: Mesh[] = [];
  private t = 0;
  private lamp: PointLight;

  constructor(private scene: Scene, grassMax: number) {
    this.mats = new Materials(scene);
    this.world.bounds = D.BOUNDS;
    this.world.killY = -8;

    this.buildGround();
    this.buildProps();
    this.buildGate();
    this.buildShelter();
    this.buildPickups();
    this.buildNpcs();
    this.buildFlowersAndMoss();
    for (const z of D.CHECKPOINTS) this.world.zones.push({ id: z.id, x: z.x, z: z.z, r: z.r, type: 'checkpoint' });
    for (const p of D.PUDDLES) { this.world.zones.push({ id: p.id, x: p.x, z: p.z, r: p.r, type: 'puddle' }); this.buildPuddle(p.x, p.z, p.r); }
    this.world.zones.push({ id: 'shelter', x: D.SHELTER.x, z: D.SHELTER.z, r: D.SHELTER.r, type: 'goal' });

    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: D.GATE.z,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.SHELTER.x, z: D.SHELTER.z, r: 9 }],
    });

    // Brilho ao coletar
    const dot = new DynamicTexture('spark', { width: 32, height: 32 }, scene, false);
    const c = dot.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(160,230,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32); dot.update();
    this.sparkle = new ParticleSystem('sparkle', 80, scene);
    this.sparkle.particleTexture = dot as unknown as Texture;
    this.sparkle.emitter = new Vector3();
    this.sparkle.minEmitBox = this.sparkle.maxEmitBox = Vector3.Zero();
    this.sparkle.minLifeTime = 0.4; this.sparkle.maxLifeTime = 0.9; this.sparkle.minSize = 0.15; this.sparkle.maxSize = 0.4;
    this.sparkle.direction1 = new Vector3(-3, 2, -3); this.sparkle.direction2 = new Vector3(3, 5, 3);
    this.sparkle.gravity = new Vector3(0, -6, 0); this.sparkle.emitRate = 0;
    this.sparkle.blendMode = ParticleSystem.BLENDMODE_ADD; this.sparkle.start();

    this.lamp = new PointLight('lamp', new Vector3(D.SHELTER.x, 3, D.SHELTER.z), scene);
    this.lamp.diffuse = new Color3(1, 0.8, 0.45); this.lamp.intensity = 40; this.lamp.range = 28;
  }

  /* ---------- construção ---------- */
  private buildGround(): void {
    const w = D.BOUNDS[1] - D.BOUNDS[0] + 80, h = D.BOUNDS[3] - D.BOUNDS[2] + 80;
    const ground = MeshBuilder.CreateGround('ground', { width: w, height: h, subdivisions: 1 }, this.scene);
    ground.material = this.mats.soil; ground.receiveShadows = true; ground.isPickable = false;
    (this.mats.soil.albedoTexture as Texture).uScale = w / 4; (this.mats.soil.albedoTexture as Texture).vScale = h / 4;
    this.receivers.push(ground); this.reflectionList.push(ground);
  }

  /** Folha com curvatura natural e forma pontuda (malha editada). */
  makeLeaf(name: string, hx: number, hz: number, tint: number, curl = 0.1): Mesh {
    const leaf = MeshBuilder.CreateGround(name, { width: 2, height: 2, subdivisions: 14, updatable: true }, this.scene);
    const pos = leaf.getVerticesData(VertexBuffer.PositionKind)!;
    const uvs = leaf.getVerticesData(VertexBuffer.UVKind)!;
    for (let i = 0; i < pos.length; i += 3) {
      const u = pos[i] / 2 + 0.5, v = pos[i + 2] / 2 + 0.5; // 0..1
      const prof = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, v * 0.96 + 0.02))), 0.55);
      const x = pos[i] * prof; // -1..1 * perfil da folha
      pos[i] = x * hx;
      pos[i + 2] = (v - 0.5) * 2 * hz;
      pos[i + 1] = -curl * x * x * hx * 0.6 - Math.max(0, v - 0.7) * hz * 0.12 * (v - 0.7) * 3;
      uvs[(i / 3) * 2] = u; uvs[(i / 3) * 2 + 1] = v;
    }
    leaf.updateVerticesData(VertexBuffer.PositionKind, pos);
    leaf.updateVerticesData(VertexBuffer.UVKind, uvs);
    leaf.createNormals(true);
    leaf.refreshBoundingInfo();
    leaf.material = this.mats.leaves[tint % this.mats.leaves.length];
    leaf.receiveShadows = true; this.casters.push(leaf); this.receivers.push(leaf);
    return leaf;
  }

  private add(s: Shape): void { this.world.add(s); }

  private buildProps(): void {
    const r = rng(11);
    // Pedras
    for (const s of D.STONES) {
      const m = MeshBuilder.CreateSphere('stone', { diameter: 2, segments: 14 }, this.scene);
      m.scaling.set(s.r, s.h, s.r); m.position.set(s.x, 0, s.z); m.rotation.y = r() * 6;
      // Irregularidade
      const p = m.getVerticesData(VertexBuffer.PositionKind)!;
      for (let i = 0; i < p.length; i += 3) { const k = 1 + (Math.sin(p[i] * 5 + p[i + 2] * 3) * 0.05); p[i] *= k; p[i + 2] *= k; }
      m.updateVerticesData(VertexBuffer.PositionKind, p); m.createNormals(true);
      m.material = this.mats.stone; m.receiveShadows = true; this.casters.push(m); this.reflectionList.push(m);
      this.add({ kind: 'cyl', x: s.x, z: s.z, r: s.r * 0.9, yBase: 0, yTop: s.h * 0.88, surface: 'stone' });
    }
    // Folhas-plataforma + talos que as sustentam
    D.LEAVES.forEach((l, i) => {
      const leaf = this.makeLeaf('leaf', l.hx, l.hz, i);
      leaf.position.set(l.x, l.y - 0.05, l.z); leaf.rotation.y = l.yaw;
      this.add({ kind: 'box', x: l.x, z: l.z, hx: l.hx * 0.72, hz: l.hz * 0.78, yBase: l.y - 0.35, yTop: l.y, yaw: -l.yaw, surface: 'leaf' });
      // talo fino até o chão na ponta traseira da folha (visual)
      const bx = l.x - Math.sin(l.yaw) * (l.hz * 0.95), bz = l.z - Math.cos(l.yaw) * (l.hz * 0.95);
      const stalk = MeshBuilder.CreateCylinder('stalk', { height: l.y + 0.2, diameterTop: 0.35, diameterBottom: 0.7, tessellation: 8 }, this.scene);
      stalk.position.set(bx, (l.y + 0.2) / 2 - 0.1, bz); stalk.material = this.mats.leaves[2]; this.casters.push(stalk);
    });
    // Cogumelos
    for (const m of D.MUSHROOMS) {
      const stem = MeshBuilder.CreateCylinder('stem', { height: m.stem, diameterTop: m.stemR * 1.5, diameterBottom: m.stemR * 2.2, tessellation: 14 }, this.scene);
      stem.position.set(m.x, m.stem / 2, m.z); stem.material = this.mats.mushStem; this.casters.push(stem); this.reflectionList.push(stem);
      const capH = m.capR * 0.42;
      const cap = MeshBuilder.CreateSphere('cap', { diameter: m.capR * 2, segments: 20, slice: 0.5 }, this.scene);
      cap.scaling.y = capH / m.capR; cap.position.set(m.x, m.stem - 0.05, m.z); cap.material = this.mats.mushCap;
      cap.receiveShadows = true; this.casters.push(cap); this.reflectionList.push(cap);
      this.add({ kind: 'cyl', x: m.x, z: m.z, r: m.stemR * 1.1, yBase: 0, yTop: m.stem, surface: 'wood' });
      this.add({ kind: 'cyl', x: m.x, z: m.z, r: m.capR * 0.8, yBase: m.stem - 0.6, yTop: m.stem + capH * 0.7, surface: 'moss' });
    }
    // Caules escaláveis
    for (const s of D.STEMS) {
      const st = MeshBuilder.CreateCylinder('climb', { height: s.h, diameterTop: s.r * 1.6, diameterBottom: s.r * 2.3, tessellation: 12 }, this.scene);
      st.position.set(s.x, s.h / 2, s.z); st.material = this.mats.leaves[1]; this.casters.push(st); this.reflectionList.push(st);
      this.add({ kind: 'cyl', x: s.x, z: s.z, r: s.r, yBase: 0, yTop: s.h, surface: 'leaf', climbable: true });
      // nós do caule (ajuda a ler "escalável")
      for (let k = 1; k < 6; k++) { const ring = MeshBuilder.CreateTorus('node', { diameter: s.r * 2.2, thickness: 0.18, tessellation: 14 }, this.scene); ring.position.set(s.x, (k * s.h) / 6, s.z); ring.material = this.mats.leaves[0]; }
      this.markers.push(this.makeBeacon(s.x, s.z, 0, 8, new Color3(0.5, 1, 0.6)));
    }
    // Troncos caídos
    for (const l of D.LOGS) {
      const log = MeshBuilder.CreateCylinder('log', { height: l.hz * 2, diameter: l.h * 2, tessellation: 14 }, this.scene);
      log.rotation.x = Math.PI / 2; log.rotation.z = 0; log.position.y = l.h * 0.5;
      const node = new TransformNode('logN', this.scene); node.position.set(l.x, 0, l.z); node.rotation.y = l.yaw; log.parent = node;
      log.material = this.mats.bark; this.casters.push(log);
      this.add({ kind: 'box', x: l.x, z: l.z, hx: l.hx * 0.95, hz: l.hz, yBase: 0, yTop: l.h * 0.95, yaw: -l.yaw, surface: 'wood' });
    }
  }

  private buildPuddle(x: number, z: number, rad: number): void {
    const d = MeshBuilder.CreateDisc('puddle', { radius: rad, tessellation: 40 }, this.scene);
    d.rotation.x = Math.PI / 2; d.position.set(x, 0.04, z); d.scaling.z = 0.75; d.material = this.mats.water; d.isPickable = false;
  }

  private buildGate(): void {
    const g = D.GATE;
    // Muralha de raízes/grama nas laterais (colisor) — visual é a relva alta
    const lw = (g.x - g.hx) - D.BOUNDS[0], rw = D.BOUNDS[1] - (g.x + g.hx);
    this.add({ kind: 'box', x: D.BOUNDS[0] + lw / 2, z: g.z, hx: lw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.add({ kind: 'box', x: g.x + g.hx + rw / 2, z: g.z, hx: rw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.gateShape = this.add2({ kind: 'box', x: g.x, z: g.z, hx: g.hx, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    // Folha seca enrolada
    const gate = MeshBuilder.CreateCylinder('gate', { height: 15, diameter: g.hx * 2.1, arc: 0.62, tessellation: 24, sideOrientation: 2 }, this.scene);
    gate.position.set(g.x, 7.5, g.z); gate.rotation.y = Math.PI * 0.69; gate.scaling.z = 0.35;
    const m = this.mats.leaves[0].clone('gateMat');
    m.albedoColor = new Color3(0.85, 0.72, 0.4); m.emissiveColor = new Color3(0.08, 0.05, 0.0);
    gate.material = m; this.gateMesh = gate; this.casters.push(gate);
    this.gateMarker = this.makeBeacon(g.x, g.z - 4, 0, 10, new Color3(1, 0.85, 0.4));
    this.markers.push(this.gateMarker);
  }
  private add2(s: Shape): Shape { this.world.add(s); return s; }

  private buildShelter(): void {
    const s = D.SHELTER;
    const a = this.makeLeaf('shelterL', 3.2, 5.5, 0, 0.0), b = this.makeLeaf('shelterR', 3.2, 5.5, 1, 0.0);
    a.position.set(s.x - 3, 0.1, s.z); a.rotation.set(0, 0, -1.0); a.rotation.y = 0;
    b.position.set(s.x + 3, 0.1, s.z); b.rotation.set(0, 0, 1.0);
    for (const l of [a, b]) l.scaling.setAll(1.55);
    const glow = MeshBuilder.CreateSphere('lantern', { diameter: 1 }, this.scene);
    glow.position.set(s.x, 1.4, s.z); glow.material = this.mats.glow;
    this.shelterMarker = this.makeBeacon(s.x, s.z, 0, 14, new Color3(1, 0.85, 0.4));
    this.markers.push(this.shelterMarker);
    // pequeno riacho decorativo ao lado do abrigo (origem do som espacial)
    const water = MeshBuilder.CreateGround('brook', { width: 4, height: 18 }, this.scene);
    water.position.set(s.x + 12, 0.05, s.z + 2); water.material = this.mats.water;
  }

  private buildPickups(): void {
    for (const d of D.PICKUPS) {
      const node = new TransformNode(d.id, this.scene);
      node.position.set(d.x, d.y, d.z);
      if (d.kind === 'dew') {
        const drop = MeshBuilder.CreateSphere('dew', { diameter: 1.0, segments: 16 }, this.scene);
        drop.scaling.set(1, 1.15, 1); drop.material = this.mats.dew; drop.parent = node;
        const hl = MeshBuilder.CreateSphere('hl', { diameter: 0.2 }, this.scene);
        hl.position.set(-0.17, 0.25, -0.2); hl.material = this.mats.white; hl.parent = node;
      } else {
        const seed = MeshBuilder.CreateSphere('seed', { diameter: 0.7, segments: 12 }, this.scene);
        seed.scaling.set(0.7, 1.1, 0.7); seed.material = this.mats.seed; seed.parent = node; seed.rotation.z = 0.5;
        const halo = MeshBuilder.CreateSphere('halo', { diameter: 1.2 }, this.scene);
        halo.material = this.mats.glow; halo.parent = node;
      }
      const marker = this.makeBeacon(d.x, d.z, d.y - 0.5, 7, d.kind === 'dew' ? new Color3(0.5, 0.9, 1) : new Color3(1, 0.6, 0.3));
      this.markers.push(marker);
      this.pickups.push({ def: d, node, taken: false, marker });
    }
  }

  private buildNpcs(): void {
    for (const n of D.NPCS) {
      const model = new SnailModel(this.scene, this.mats);
      model.root.position.set(n.x, 0, n.z); model.root.rotation.y = n.yaw; model.root.scaling.setAll(1.3);
      this.casters.push(...(model.meshes as Mesh[]));
      const marker = this.makeBeacon(n.x, n.z, 0, 6, n.id === 'tito' ? new Color3(1, 0.85, 0.4) : new Color3(0.5, 0.9, 1));
      this.markers.push(marker);
      this.npcs.push({ id: n.id, x: n.x, z: n.z, model, marker, baseYaw: n.yaw });
      this.world.add({ kind: 'cyl', x: n.x, z: n.z, r: 1.3, yBase: 0, yTop: 1.6, surface: 'soil' });
    }
  }

  private makeBeacon(x: number, z: number, y: number, h: number, color: Color3): Mesh {
    const b = MeshBuilder.CreateCylinder('beacon', { height: h, diameterTop: 0.12, diameterBottom: 0.7, tessellation: 10 }, this.scene);
    b.position.set(x, y + h / 2, z); b.isPickable = false; b.setEnabled(false);
    const m = new StandardMaterial('beaconM', this.scene);
    m.emissiveColor = color; m.disableLighting = true; m.alpha = 0.28; m.fogEnabled = false;
    b.material = m;
    return b;
  }

  private buildFlowersAndMoss(): void {
    const r = rng(99);
    const petalColors = [new Color3(0.95, 0.4, 0.6), new Color3(0.7, 0.45, 0.95), new Color3(1, 0.85, 0.3), new Color3(1, 1, 1)];
    const mats = petalColors.map((c, i) => { const m = new StandardMaterial('petal' + i, this.scene); m.diffuseColor = c; m.emissiveColor = c.scale(0.25); m.backFaceCulling = false; return m; });
    for (let i = 0; i < 18; i++) {
      const edge = r() < 0.6;
      const x = edge ? (r() < 0.5 ? -1 : 1) * (36 + r() * 18) : -50 + r() * 100;
      const z = -90 + r() * 170;
      if (this.world.shapes.some((s) => Math.hypot(x - s.x, z - s.z) < 6)) continue;
      const h = 4 + r() * 6;
      const stem = MeshBuilder.CreateCylinder('fs', { height: h, diameter: 0.25, tessellation: 6 }, this.scene);
      stem.position.set(x, h / 2, z); stem.material = this.mats.leaves[2];
      const pm = mats[Math.floor(r() * mats.length)];
      const petals: Mesh[] = [];
      for (let k = 0; k < 8; k++) {
        const p = MeshBuilder.CreateSphere('p', { diameter: 1, segments: 6 }, this.scene);
        p.scaling.set(1.6, 0.12, 0.6);
        const a = (k / 8) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); p.rotation.y = -a; petals.push(p);
      }
      const head = Mesh.MergeMeshes(petals, true, true) as Mesh;
      head.material = pm; head.position.set(x, h, z); head.rotation.x = 0.35;
      const c = MeshBuilder.CreateSphere('core', { diameter: 0.7 }, this.scene);
      c.position.set(x, h + 0.08, z); c.material = this.mats.glow;
      this.casters.push(head);
    }
    // Manchas de musgo
    const mm = new StandardMaterial('moss', this.scene);
    const t = new DynamicTexture('mossT', { width: 128, height: 128 }, this.scene, true);
    const c = t.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(70,120,40,0.95)'); g.addColorStop(0.6, 'rgba(60,105,40,0.6)'); g.addColorStop(1, 'rgba(60,100,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.update(); t.hasAlpha = true;
    mm.diffuseTexture = t; mm.useAlphaFromDiffuseTexture = true; mm.specularColor = Color3.Black(); mm.backFaceCulling = false;
    for (let i = 0; i < 46; i++) {
      const d = MeshBuilder.CreateDisc('m', { radius: 1, tessellation: 12 }, this.scene);
      d.rotation.x = Math.PI / 2; const s = 2 + r() * 5;
      d.scaling.set(s, s * (0.6 + r() * 0.4), 1);
      d.position.set(-55 + r() * 110, 0.03, -95 + r() * 190); d.material = mm; d.isPickable = false; d.receiveShadows = true;
    }
  }

  /* ---------- interação ---------- */
  nearestPickup(x: number, y: number, z: number, radius: number): Pickup | undefined {
    let best: Pickup | undefined, bd = radius;
    for (const p of this.pickups) {
      if (p.taken) continue;
      const d = Math.hypot(p.def.x - x, (p.def.y - 0.5 - y) * 0.7, p.def.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  collect(p: Pickup): void {
    p.taken = true; p.node.setEnabled(false); p.marker.setEnabled(false);
    (this.sparkle.emitter as Vector3).copyFrom(p.node.position);
    this.sparkle.manualEmitCount = 28;
  }

  setCollected(ids: string[]): void { for (const p of this.pickups) if (ids.includes(p.def.id)) this.collect(p); this.sparkle.manualEmitCount = 0; }

  openGate(instant = false): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.world.shapes.splice(this.world.shapes.indexOf(this.gateShape), 1);
    this.gateMarker.setEnabled(false);
    this.gateAnim = instant ? 1 : 0;
    if (instant) this.gateMesh.setEnabled(false);
  }

  /** Fecha o portão de novo (novo jogo / recarregar save). */
  reopenGate(): void {
    if (!this.gateOpen) return;
    this.gateOpen = false; this.gateAnim = -1;
    this.world.shapes.push(this.gateShape);
    this.gateMesh.setEnabled(true); this.gateMesh.scaling.y = 1; this.gateMesh.position.y = 7.5;
    (this.gateMesh.material as unknown as { albedoColor: Color3 }).albedoColor = new Color3(0.85, 0.72, 0.4);
  }

  nearestNpc(x: number, z: number, radius: number): Npc | undefined {
    let best: Npc | undefined, bd = radius;
    for (const n of this.npcs) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  nearGate(x: number, z: number): boolean { return !this.gateOpen && Math.hypot(x - D.GATE.x, z - D.GATE.z) < 7.5; }

  /** Posições de interesse para o mapa e as dicas. */
  get gatePos() { return { x: D.GATE.x, z: D.GATE.z }; }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.t += dt;
    this.grass.update(this.t, !toneByPostFx);
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.node.position.y = p.def.y + Math.sin(this.t * 2 + p.def.x) * 0.12;
      p.node.rotation.y += dt * 1.2;
    }
    for (const n of this.npcs) {
      n.model.animate(dt);
      const dx = playerPos.x - n.x, dz = playerPos.z - n.z;
      if (Math.hypot(dx, dz) < 14) { // vira-se devagar para a joaninha
        const want = Math.atan2(dx, dz);
        let diff = want - n.model.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.model.root.rotation.y += diff * Math.min(1, dt * 2);
      }
    }
    for (const p of this.pickups) p.marker.setEnabled(observing && !p.taken);
    for (const n of this.npcs) n.marker.setEnabled(observing);
    this.gateMarker.setEnabled(observing && !this.gateOpen);
    this.shelterMarker.setEnabled(observing);
    for (const m of this.markers) if (m.material) (m.material as StandardMaterial).alpha = 0.22 + 0.12 * Math.sin(this.t * 3);
    if (this.gateAnim >= 0 && this.gateAnim < 1) {
      this.gateAnim = Math.min(1, this.gateAnim + dt / 1.8);
      const k = this.gateAnim;
      this.gateMesh.scaling.y = 1 - k * 0.97; this.gateMesh.position.y = 7.5 * (1 - k * 0.97);
      (this.gateMesh.material as unknown as { albedoColor: Color3 }).albedoColor = Color3.Lerp(new Color3(0.85, 0.72, 0.4), new Color3(0.3, 0.6, 0.25), k);
      if (k >= 1) this.gateMesh.setEnabled(false);
    }
    this.lamp.intensity = 36 + Math.sin(this.t * 3) * 5;
  }
}

