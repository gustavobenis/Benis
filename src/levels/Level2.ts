import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { rng } from './Materials';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import type { Shape } from '../physics/CollisionWorld';
import { LEVEL2_QUESTS } from '../data/quests';
import { pickRioDialogue } from '../data/dialogues';
import * as D from './level2Data';

/** Fase 2 — O Rio (Novos Amigos): correnteza, pedras, folhas flutuantes e a ponte de Lino. */
export class Level2 extends LevelBase {
  readonly info: LevelInfo = {
    id: 2, title: 'O Rio', subtitle: 'Novos Amigos',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL2_QUESTS, mainQuest: 'rio',
    totals: { dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: D.PICKUPS.filter((p) => p.kind === 'seed').length, leaf: 4, crystal: 2, flower: 2, photo: 1 },
    fog: { color: [0.72, 0.85, 0.84], density: 0.0115 },
    // Dia claro e fresco junto à água
    light: { dir: [-0.3, -0.85, 0.35], sun: [1, 0.97, 0.88], sunI: 3.2, sky: [0.8, 0.95, 1], ground: [0.25, 0.4, 0.35], hemiI: 0.8, exposure: 1.12, contrast: 1.12, saturation: 8 },
    shafts: [[-8, -80], [16, -56], [-10, -30], [4, 44], [-6, 74]],
    springs: [[0, 0.5, 10], [-30, 0.5, 10], [30, 0.5, 10]],
    pickDialogue: (npc, q, flags) => pickRioDialogue(npc, q, flags),
    // O pássaro só ronda as margens, nunca sobre a ponte
    birdActive: (p, q) => q.currentObjective('rio')?.id !== 'lino' && (p.z < -9 || p.z > 28) && p.y < 6,
    rescue: D.RESCUE,
    interactPoints: { bridge: { x: D.BRIDGE_SITE.x, z: D.BRIDGE_SITE.z } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: [...D.LEAVES], mushrooms: D.MUSHROOMS, stones: [...D.STONES, ...D.RIVER_STONES], puddles: [],
    waters: [D.RIVER], goal: { x: D.NPCS[2].x, z: D.NPCS[2].z },
    dynamic: () => (this.bridgeBuilt ? [{ x1: D.BRIDGE.x, z1: D.BRIDGE.z - D.BRIDGE.hz, x2: D.BRIDGE.x, z2: D.BRIDGE.z + D.BRIDGE.hz, color: '#e9b95d' }] : []),
  };
  bridgeBuilt = false;
  private bridgeMesh!: Mesh;
  private bridgeShape: Shape | null = null;
  private bridgeAnim = -1;
  private siteMarker!: Mesh;
  private water!: StandardMaterial;
  private floaters: { mesh: Mesh; shape: Shape }[] = [];
  private striders: { node: Mesh; r: number; s: number; ph: number; cx: number; cz: number }[] = [];

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.world.waters.push(D.RIVER);
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    this.buildRiver();
    D.STONES.forEach((s) => this.addStone(s));
    D.RIVER_STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.LOGS.forEach((l) => this.addLog(l));
    this.buildFloatingLeaves();
    this.buildBridge();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.buildFlowersAndMoss(7, D.BOUNDS, 30);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.NORTH.id, x: D.NORTH.x, z: D.NORTH.z, r: D.NORTH.r, type: 'goal' });
    this.siteMarker = this.makeBeacon(D.BRIDGE_SITE.x, D.BRIDGE_SITE.z, 0, 9, new Color3(1, 0.85, 0.4));
    this.markers.push(this.siteMarker);
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: 9999,
      avoid: (x, z) => !!this.world.waterAt(x, z) || (z > D.RIVER.minZ - 2 && z < D.RIVER.maxZ + 2 && Math.abs(x) < 7),
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 }))],
    });    this.finishBuild();
  }

  private buildRiver(): void {
    const w = D.RIVER.maxX - D.RIVER.minX, h = D.RIVER.maxZ - D.RIVER.minZ;
    const plane = MeshBuilder.CreateGround('river', { width: w, height: h }, this.scene);
    plane.position.set(0, 0.14, (D.RIVER.minZ + D.RIVER.maxZ) / 2); plane.isPickable = false;
    const bump = new DynamicTexture('rb', { width: 256, height: 256 }, this.scene, true);
    const c = bump.getContext() as CanvasRenderingContext2D; const r = rng(5);
    c.fillStyle = '#808080'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(${r() > 0.5 ? 255 : 40},${r() > 0.5 ? 255 : 40},255,0.25)`; c.lineWidth = 1 + r() * 3; c.beginPath(); const y = r() * 256; c.moveTo(0, y); c.bezierCurveTo(80, y + 10 * (r() - 0.5) * 6, 170, y - 10 * (r() - 0.5) * 6, 256, y); c.stroke(); }
    bump.update(); bump.wrapU = bump.wrapV = Texture.WRAP_ADDRESSMODE; bump.uScale = w / 14; bump.vScale = h / 14;
    const m = new StandardMaterial('riverM', this.scene);
    m.diffuseColor = new Color3(0.1, 0.36, 0.43); m.emissiveColor = new Color3(0.02, 0.09, 0.12);
    m.specularColor = new Color3(0.7, 0.8, 0.85); m.specularPower = 110; m.alpha = 0.78; m.bumpTexture = bump; bump.level = 0.45;
    plane.material = m; this.water = m;
    // Insetos aquáticos deslizando na superfície
    const legM = new StandardMaterial('strM', this.scene); legM.diffuseColor = new Color3(0.1, 0.1, 0.08);
    for (let i = 0; i < 7; i++) {
      const body = MeshBuilder.CreateSphere('strider', { diameter: 0.5, segments: 6 }, this.scene); body.scaling.set(0.6, 0.5, 1.5); body.material = legM; body.isPickable = false;
      const legs: Mesh[] = [];
      for (let k = 0; k < 6; k++) { const l = MeshBuilder.CreateCylinder('l', { height: 1.1, diameter: 0.04, tessellation: 4 }, this.scene); l.rotation.z = (k % 2 ? 1 : -1) * 1.3; l.rotation.y = (k >> 1) * 0.6 - 0.6; l.position.set((k % 2 ? 1 : -1) * 0.5, 0, (k >> 1) * 0.35 - 0.35); legs.push(l); }
      const merged = Mesh.MergeMeshes([body, ...legs], true, true, undefined, false, false) as Mesh; merged.material = legM; merged.isPickable = false;
      this.striders.push({ node: merged, r: 3 + r() * 4, s: 0.4 + r() * 0.5, ph: r() * 6, cx: -50 + r() * 100, cz: 0 + r() * 20 });
    }
  }

  private buildFloatingLeaves(): void {
    D.FLOATING_LEAVES.forEach((f, i) => {
      const shape = this.addShape({ kind: 'box', x: f.cx, z: f.z, hx: 2.6, hz: 3, yBase: 0.1, yTop: 0.5, yaw: 0, surface: 'leaf', move: { ax: 9, az: 0, speed: f.speed, phase: f.phase, cx: f.cx, cz: f.z, dx: 0, dz: 0 } });
      const mesh = this.makeLeaf('float', 3.2, 3.7, i, 0.15); mesh.position.set(f.cx, 0.42, f.z);
      this.floaters.push({ mesh, shape });
    });
  }

  private buildBridge(): void {
    const b = D.BRIDGE;
    this.bridgeMesh = this.makeLeaf('bridge', b.hx + 0.5, b.hz + 0.5, 1, 0.03);
    this.bridgeMesh.position.set(b.x, b.y - 0.04, b.z); this.bridgeMesh.setEnabled(false);
  }

  /* ---------- estado ---------- */
  buildBridgeNow(instant = false): void {
    if (this.bridgeBuilt) return;
    this.bridgeBuilt = true;
    const b = D.BRIDGE;
    this.bridgeShape = this.addShape({ kind: 'box', x: b.x, z: b.z, hx: b.hx, hz: b.hz, yBase: 0.1, yTop: b.y, yaw: 0, surface: 'leaf' });
    this.bridgeMesh.setEnabled(true); this.siteMarker.setEnabled(false);
    this.bridgeAnim = instant ? 1 : 0;
    if (instant) { this.bridgeMesh.scaling.z = 1; this.bridgeMesh.position.z = b.z; }
  }
  private removeBridge(): void {
    if (!this.bridgeBuilt) return;
    this.bridgeBuilt = false; this.bridgeAnim = -1;
    if (this.bridgeShape) this.world.shapes.splice(this.world.shapes.indexOf(this.bridgeShape), 1);
    this.bridgeShape = null; this.bridgeMesh.setEnabled(false);
  }
  applyFlags(flags: Set<string>): void { if (flags.has('bridge')) this.buildBridgeNow(true); }
  resetState(): void { this.restorePickups(); this.removeBridge(); }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.bridgeBuilt || Math.hypot(x - D.BRIDGE_SITE.x, z - D.BRIDGE_SITE.z) > D.BRIDGE_SITE.r) return undefined;
    const n = host.inventory.count('leaf');
    return {
      prompt: `(${Math.min(n, 3)}/3 folhas) Construir a ponte com Lino`,
      run: () => {
        if (host.quests.currentObjective('rio')?.id === 'lino') { host.toast('Converse com Lino primeiro.'); return; }
        if (n < 3) { host.toast(`Faltam ${3 - n} folhas especiais para a ponte.`, 3200); host.audio.warn(); return; }
        host.inventory.remove('leaf', 3); this.buildBridgeNow(); host.flags.add('bridge');
        host.quests.handle({ type: 'interact', target: 'bridge' }); host.audio.collect(); host.audio.interact();
        host.toast('Lino e Marieta constroem a ponte de folhas! 🍃', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    this.world.updateMovers(this.t);
    for (const f of this.floaters) f.mesh.position.set(f.shape.x, 0.42 + Math.sin(this.t * 2 + f.shape.z) * 0.03, f.shape.z);
    const bump = this.water.bumpTexture as Texture; bump.uOffset += dt * 0.02; bump.vOffset += dt * 0.004;
    for (const s of this.striders) { const a = this.t * s.s + s.ph; s.node.position.set(s.cx + Math.cos(a) * s.r, 0.17, s.cz + Math.sin(a) * s.r * 0.6); s.node.rotation.y = -a + Math.PI / 2; }
    this.siteMarker.setEnabled(observing && !this.bridgeBuilt);
    if (this.bridgeAnim >= 0 && this.bridgeAnim < 1) {
      this.bridgeAnim = Math.min(1, this.bridgeAnim + dt / 1.6);
      const k = this.bridgeAnim, b = D.BRIDGE;
      this.bridgeMesh.scaling.z = Math.max(0.02, k); this.bridgeMesh.position.z = (b.z - b.hz) + b.hz * k;
    }
  }
}
