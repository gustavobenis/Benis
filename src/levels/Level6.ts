import { Color3, DynamicTexture, Mesh, MeshBuilder, PointLight, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { rng } from './Materials';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import { SealedGate } from './SealedGate';
import { LEVEL6_QUESTS } from '../data/quests';
import { pickValleyDialogue } from '../data/dialogues';
import * as D from './level6Data';

/** Fase 6 — O Vale das Flores (Esperança): pôr do sol dourado, flores gigantes e correntes de ar quente. */
export class Level6 extends LevelBase {
  readonly info: LevelInfo = {
    id: 6, title: 'O Vale das Flores', subtitle: 'Esperança',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL6_QUESTS, mainQuest: 'vale',
    totals: { flower: 4, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: 2, crystal: 2, leaf: 1, photo: 1 },
    fog: { color: [0.8, 0.58, 0.48], density: 0.0105 },
    // Pôr do sol dourado depois da tempestade
    light: { dir: [-0.88, -0.2, 0.32], sun: [1, 0.72, 0.42], sunI: 3.7, sky: [1, 0.76, 0.62], ground: [0.36, 0.26, 0.16], hemiI: 0.72, exposure: 1.2, contrast: 1.15, saturation: 20, shadowHue: 300 },
    shafts: [[-10, -80], [14, -50], [-8, -14], [10, 20], [-4, 52], [4, 78]],
    springs: [[0, 0.5, 60]],
    pickDialogue: (npc, q) => pickValleyDialogue(npc, q),
    birdActive: (p, q) => q.currentObjective('vale')?.id !== 'rita' && p.y < 6 && p.z > -70,
    interactPoints: { garden: { x: D.GARDEN.x, z: D.GARDEN.z - 4 } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: [...D.MUSHROOMS, ...D.GIANT_FLOWERS.map((f) => ({ x: f.x, z: f.z, stem: f.h, capR: f.r, stemR: 1 }))],
    stones: D.STONES, puddles: [], waters: [], goal: { x: D.OVERLOOK.x, z: D.OVERLOOK.z },
    dynamic: () => [{ x1: D.GATE.x - D.GATE.hx, z1: D.GATE.z, x2: D.GATE.x + D.GATE.hx, z2: D.GATE.z, color: this.gate.open ? '#8fe08f' : '#e9b95d' }],
  };
  private gate!: SealedGate; private gateMarker!: Mesh; private gardenMarker!: Mesh;
  private columns: { mat: StandardMaterial; tex: Texture }[] = [];
  private bloomNodes: TransformNode[] = []; private bloomT = -1;
  private lamp: PointLight;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.LOGS.forEach((l) => this.addLog(l));
    D.GIANT_FLOWERS.forEach((f) => this.addGiantFlower(f));
    D.UPDRAFTS.forEach((u) => this.addUpdraft(u));
    this.buildGate();
    this.buildGarden();
    this.buildBloom();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.buildFlowersAndMoss(61, D.BOUNDS, 50);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.OVERLOOK.id, x: D.OVERLOOK.x, z: D.OVERLOOK.z, r: D.OVERLOOK.r, type: 'goal' });
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: D.GATE.z,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.GARDEN.x, z: D.GARDEN.z, r: 9 }],
    });
    this.lamp = new PointLight('gardenL', new Vector3(D.GARDEN.x, 4, D.GARDEN.z), scene);
    this.lamp.diffuse = new Color3(1, 0.8, 0.5); this.lamp.intensity = 0; this.lamp.range = 32;
    this.finishBuild();
  }

  /** Flor gigante: haste, pétalas em disco, miolo e colisor no topo. */
  private addGiantFlower(f: { x: number; z: number; h: number; r: number; color: [number, number, number] }): void {
    const stem = MeshBuilder.CreateCylinder('gstem', { height: f.h, diameterTop: 1.4, diameterBottom: 2.2, tessellation: 12 }, this.scene);
    stem.position.set(f.x, f.h / 2, f.z); stem.material = this.mats.leaves[1]; this.casters.push(stem);
    const pm = new StandardMaterial('gpetal', this.scene); pm.diffuseColor = new Color3(...f.color); pm.emissiveColor = new Color3(...f.color).scale(0.25); pm.backFaceCulling = false;
    const petals: Mesh[] = [];
    for (let k = 0; k < 12; k++) {
      const p = MeshBuilder.CreateSphere('p', { diameter: 1, segments: 8 }, this.scene);
      const a = (k / 12) * Math.PI * 2; p.scaling.set(f.r * 0.62, 0.35, f.r * 0.3);
      p.position.set(Math.cos(a) * f.r * 0.62, 0, Math.sin(a) * f.r * 0.62); p.rotation.y = -a; petals.push(p);
    }
    const head = Mesh.MergeMeshes(petals, true, true) as Mesh; head.material = pm; head.position.set(f.x, f.h - 0.2, f.z); head.receiveShadows = true; this.casters.push(head);
    const core = MeshBuilder.CreateSphere('core', { diameter: f.r * 0.9, segments: 14 }, this.scene); core.scaling.y = 0.45;
    core.position.set(f.x, f.h - 0.05, f.z); core.material = this.mats.glow; core.isPickable = false;
    this.addShape({ kind: 'cyl', x: f.x, z: f.z, r: 1.0, yBase: 0, yTop: f.h - 0.4, surface: 'leaf' });
    this.addShape({ kind: 'cyl', x: f.x, z: f.z, r: f.r * 0.95, yBase: f.h - 0.6, yTop: f.h, surface: 'leaf' });
  }

  /** Corrente de ar quente: zona física + coluna de pólen dourado que sobe. */
  private addUpdraft(u: { id: string; x: number; z: number; r: number; top: number }): void {
    this.world.zones.push({ id: u.id, x: u.x, z: u.z, r: u.r, type: 'updraft', top: u.top });
    const tex = new DynamicTexture('col', { width: 64, height: 256 }, this.scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D; const r = rng(Math.floor(u.x * 7 + u.z));
    c.clearRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,${200 + Math.floor(r() * 50)},120,${0.25 + r() * 0.5})`; c.beginPath(); c.arc(r() * 64, r() * 256, 1 + r() * 3, 0, 7); c.fill(); }
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = g; c.fillRect(0, 0, 64, 256); tex.update(); tex.hasAlpha = true;
    tex.wrapV = Texture.WRAP_ADDRESSMODE; tex.uScale = 2; tex.vScale = 1.5;
    const m = new StandardMaterial('colM', this.scene);
    m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new Color3(1, 0.8, 0.4); m.disableLighting = true; m.backFaceCulling = false; m.alpha = 0.8; m.fogEnabled = false;
    const col = MeshBuilder.CreateCylinder('updraft', { height: u.top, diameter: u.r * 2, tessellation: 20, cap: 0 }, this.scene);
    col.position.set(u.x, u.top / 2, u.z); col.material = m; col.isPickable = false;
    this.columns.push({ mat: m, tex });
  }

  private buildGate(): void {
    const g = D.GATE;
    const vines: Mesh[] = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const v = MeshBuilder.CreateCylinder('vine', { height: 16, diameter: 0.5 + (i % 3) * 0.15, tessellation: 7 }, this.scene);
      v.position.set(g.x - g.hx * 1.15 + (i / (n - 1)) * g.hx * 2.3, 8, g.z + ((i % 2) - 0.5) * 0.5); v.rotation.z = ((i * 53) % 10 - 5) * 0.015; vines.push(v);
    }
    for (const y of [4, 9, 13]) { const b = MeshBuilder.CreateBox('vb', { width: g.hx * 2.6, height: 0.45, depth: 0.45 }, this.scene); b.position.set(g.x, y, g.z - 0.4); vines.push(b); }
    const wall = Mesh.MergeMeshes(vines, true, true) as Mesh; wall.material = this.mats.leaves[2]; this.casters.push(wall);
    this.gate = new SealedGate(this.world, D.BOUNDS, g, wall, 0);
    this.gateMarker = this.makeBeacon(g.x, g.z - 4, 0, 10, new Color3(1, 0.85, 0.5)); this.markers.push(this.gateMarker);
  }

  private buildGarden(): void {
    const a = D.GARDEN;
    const bed = MeshBuilder.CreateDisc('bed', { radius: 5.5, tessellation: 32 }, this.scene);
    bed.rotation.x = Math.PI / 2; bed.position.set(a.x, 0.06, a.z); bed.material = this.mats.soil; bed.isPickable = false;
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2; const st = MeshBuilder.CreateSphere('ring', { diameter: 1.3, segments: 8 }, this.scene);
      st.scaling.y = 0.7; st.position.set(a.x + Math.cos(ang) * 5.8, 0.4, a.z + Math.sin(ang) * 5.8); st.material = this.mats.stone; this.casters.push(st);
    }
    this.gardenMarker = this.makeBeacon(a.x, a.z, 0, 10, new Color3(1, 0.85, 0.5)); this.markers.push(this.gardenMarker);
  }

  /** Flores que desabrocham quando o jardim é replantado. */
  private buildBloom(): void {
    const r = rng(77);
    const cols = [new Color3(1, 0.45, 0.7), new Color3(1, 0.8, 0.25), new Color3(0.75, 0.5, 1), new Color3(1, 0.6, 0.4), new Color3(1, 1, 1)];
    const mats = cols.map((c, i) => { const m = new StandardMaterial('bloomM' + i, this.scene); m.diffuseColor = c; m.emissiveColor = c.scale(0.3); m.backFaceCulling = false; return m; });
    for (let i = 0; i < 56; i++) {
      const ang = r() * Math.PI * 2, dist = 3 + r() * 30;
      const x = D.GARDEN.x + Math.cos(ang) * dist, z = D.GARDEN.z + Math.sin(ang) * dist * 0.9;
      if (z > D.GATE.z - 3 || z < -90 || Math.abs(x) > 54 || this.world.shapes.some((s) => Math.hypot(x - s.x, z - s.z) < 5)) continue;
      const node = new TransformNode('bloom', this.scene); node.position.set(x, 0, z); node.setEnabled(false);
      const h = 2.5 + r() * 4;
      const stem = MeshBuilder.CreateCylinder('bs', { height: h, diameter: 0.22, tessellation: 6 }, this.scene); stem.position.y = h / 2; stem.material = this.mats.leaves[2]; stem.parent = node;
      const petals: Mesh[] = [];
      for (let k = 0; k < 8; k++) { const p = MeshBuilder.CreateSphere('p', { diameter: 1, segments: 6 }, this.scene); p.scaling.set(1.5, 0.12, 0.55); const a = (k / 8) * Math.PI * 2; p.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); p.rotation.y = -a; petals.push(p); }
      const head = Mesh.MergeMeshes(petals, true, true) as Mesh; head.material = mats[Math.floor(r() * mats.length)]; head.position.y = h; head.parent = node;
      this.bloomNodes.push(node);
    }
  }

  /* ---------- estado ---------- */
  private bloom(instant: boolean): void {
    for (const n of this.bloomNodes) { n.setEnabled(true); n.scaling.setAll(instant ? 1 : 0.01); }
    this.bloomT = instant ? 1 : 0;
    this.gate.openNow(instant); this.gateMarker.setEnabled(false); this.gardenMarker.setEnabled(false);
    this.lamp.intensity = 30;
  }
  applyFlags(flags: Set<string>): void { if (flags.has('garden')) this.bloom(true); }
  resetState(): void {
    this.restorePickups(); this.gate.close(); this.lamp.intensity = 0; this.bloomT = -1;
    for (const n of this.bloomNodes) n.setEnabled(false);
  }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.gate.open || Math.hypot(x - D.GARDEN.x, z - D.GARDEN.z) > D.GARDEN.r) return undefined;
    const n = host.inventory.count('flower');
    return {
      prompt: `(${Math.min(n, 4)}/4 flores) Replantar o Jardim da Esperança`,
      run: () => {
        if (host.quests.currentObjective('vale')?.id === 'rita') { host.toast('Converse com Rita primeiro.'); return; }
        if (n < 4) { host.toast(`Faltam ${4 - n} flores raras. Use as correntes de ar dourado!`, 3200); host.audio.warn(); return; }
        host.inventory.remove('flower', 4); this.bloom(false); host.flags.add('garden');
        host.quests.handle({ type: 'interact', target: 'garden' }); host.audio.collect(); host.audio.interact();
        host.toast('O vale floresce e o caminho se abre! 🌸', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    for (const c of this.columns) c.tex.vOffset -= dt * 0.35;
    this.gate.update(dt);
    if (this.bloomT >= 0 && this.bloomT < 1) {
      this.bloomT = Math.min(1, this.bloomT + dt / 2.2);
      const k = this.bloomT * this.bloomT * (3 - 2 * this.bloomT);
      this.bloomNodes.forEach((n, i) => n.scaling.setAll(Math.max(0.01, Math.min(1, k * 1.6 - (i % 7) * 0.08))));
    }
    this.gateMarker.setEnabled(observing && !this.gate.open);
    this.gardenMarker.setEnabled(observing && !this.gate.open);
    if (this.gate.open) this.lamp.intensity = 28 + Math.sin(this.t * 2) * 3;
  }
}
