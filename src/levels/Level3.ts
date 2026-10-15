import { Color3, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, PointLight, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import type { Shape } from '../physics/CollisionWorld';
import { LEVEL3_QUESTS } from '../data/quests';
import { pickForestDialogue } from '../data/dialogues';
import { SpiderModel } from '../player/Npcs';
import { Patrol } from '../game/Patrol';
import * as D from './level3Data';

/** Fase 3 — A Floresta (Desafios): troncos-túnel, cogumelos-trampolim, teias, aranha-caçadora e o altar de cristais. */
export class Level3 extends LevelBase {
  readonly info: LevelInfo = {
    id: 3, title: 'A Floresta', subtitle: 'Desafios',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL3_QUESTS, mainQuest: 'floresta',
    totals: { crystal: 3, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: 2, flower: 2, photo: 1, leaf: 1 },
    fog: { color: [0.2, 0.32, 0.26], density: 0.0185 },
    // Floresta fechada: pouca luz solar filtrada, tons verde-azulados
    light: { dir: [-0.2, -0.55, 0.75], sun: [0.8, 1, 0.78], sunI: 2.2, sky: [0.5, 0.72, 0.62], ground: [0.1, 0.18, 0.12], hemiI: 0.62, exposure: 1.18, contrast: 1.2, saturation: 14, shadowHue: 165 },
    shafts: [[-12, -80], [10, -52], [-10, -20], [14, 12], [-6, 38], [4, 72]],
    springs: [[30, 0.5, -40], [-34, 0.5, 40]],
    pickDialogue: (npc, q) => pickForestDialogue(npc, q),
    birdActive: (p, q) => q.currentObjective('floresta')?.id !== 'tico' && p.z > -70 && p.y < 6,
    interactPoints: { altar: { x: D.ALTAR.x, z: D.ALTAR.z - 4 } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS, stones: D.STONES, puddles: [], waters: [], goal: { x: D.CLEARING.x, z: D.CLEARING.z },
    dynamic: () => [{ x1: D.GATE.x - D.GATE.hx, z1: D.GATE.z, x2: D.GATE.x + D.GATE.hx, z2: D.GATE.z, color: this.gateOpen ? '#8fe08f' : '#e9b95d' }],
  };
  gateOpen = false;
  private gateShape!: Shape; private gateWeb!: Mesh; private gateMarker!: Mesh; private altarMarker!: Mesh;
  private gateAnim = -1;
  private hunter!: SpiderModel; private patrol: Patrol; private hazard: string | null = null;
  private sockets: StandardMaterial[] = [];
  private altarLight: PointLight;
  private fireflies: ParticleSystem; private follow = new Vector3();
  private webTex!: DynamicTexture;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    this.webTex = this.makeWebTexture();
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i + 1));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.ROOTS.forEach((r) => this.addLog(r));
    D.RAISED_LOGS.forEach((l) => this.addRaisedLog(l));
    D.WEBS.forEach((w) => this.addWeb(w));
    this.buildGate();
    this.buildAltar();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.buildFlowersAndMoss(31, D.BOUNDS, 60);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.CLEARING.id, x: D.CLEARING.x, z: D.CLEARING.z, r: D.CLEARING.r, type: 'goal' });

    this.hunter = new SpiderModel(scene, this.mats, true);
    this.casters.push(...(this.hunter.meshes as Mesh[]));
    this.patrol = new Patrol({ points: D.HUNTER_PATH, speed: 4.2, range: 15, halfCone: 0.95, senseRadius: 3.8, seeTime: 1.1, pause: 1.4 });
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: D.GATE.z,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.ALTAR.x, z: D.ALTAR.z, r: 8 }],
    });
    this.altarLight = new PointLight('altarL', new Vector3(D.ALTAR.x, 4, D.ALTAR.z), scene);
    this.altarLight.diffuse = new Color3(0.5, 0.8, 1); this.altarLight.intensity = 0; this.altarLight.range = 30;

    // Vaga-lumes: partículas que acompanham Marieta
    const dot = new DynamicTexture('ff', { width: 32, height: 32 }, scene, false);
    const c = dot.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(220,255,140,1)'); g.addColorStop(1, 'rgba(200,255,120,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32); dot.update();
    const ps = new ParticleSystem('fireflies', 70, scene);
    ps.particleTexture = dot as unknown as Texture; ps.emitter = this.follow;
    ps.minEmitBox = new Vector3(-22, 0.5, -22); ps.maxEmitBox = new Vector3(22, 6, 22);
    ps.minLifeTime = 3; ps.maxLifeTime = 7; ps.emitRate = 12; ps.minSize = 0.25; ps.maxSize = 0.55;
    ps.color1 = new Color3(0.85, 1, 0.45).toColor4(1); ps.color2 = new Color3(0.6, 1, 0.7).toColor4(0.8); ps.colorDead = new Color3(0.8, 1, 0.5).toColor4(0);
    ps.direction1 = new Vector3(-0.6, 0.2, -0.6); ps.direction2 = new Vector3(0.6, 0.6, 0.6); ps.minEmitPower = 0.3; ps.maxEmitPower = 1;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD; ps.start();
    this.fireflies = ps;
    this.finishBuild();
  }

  dispose(): void { this.fireflies.dispose(); super.dispose(); }

  private makeWebTexture(): DynamicTexture {
    const t = new DynamicTexture('web', { width: 256, height: 256 }, this.scene, true);
    const c = t.getContext() as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 256); c.strokeStyle = 'rgba(235,245,255,0.9)'; c.lineWidth = 1.6;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); c.stroke(); }
    for (let r = 14; r < 126; r += 14) { c.beginPath(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2, rr = r + (i % 2 ? -3 : 2); c[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } c.stroke(); }
    t.update(); t.hasAlpha = true; return t;
  }

  private webMaterial(alpha: number): StandardMaterial {
    const m = new StandardMaterial('webM', this.scene);
    m.diffuseTexture = this.webTex; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new Color3(0.6, 0.7, 0.8);
    m.specularColor = Color3.Black(); m.backFaceCulling = false; m.alpha = alpha; m.disableLighting = false;
    return m;
  }

  private addWeb(w: { id: string; x: number; z: number; r: number }): void {
    this.world.zones.push({ id: w.id, x: w.x, z: w.z, r: w.r, type: 'web' });
    const d = MeshBuilder.CreateDisc('web', { radius: w.r, tessellation: 32 }, this.scene);
    d.rotation.x = Math.PI / 2; d.position.set(w.x, 0.08, w.z); d.material = this.webMaterial(0.85); d.isPickable = false;
  }

  /** Tronco suspenso sobre dois apoios: forma um túnel de sombra por baixo. */
  private addRaisedLog(l: { x: number; z: number; hx: number; hz: number; yaw: number; yBase: number; yTop: number }): void {
    const node = new TransformNode('rlog', this.scene); node.position.set(l.x, (l.yBase + l.yTop) / 2, l.z); node.rotation.y = l.yaw;
    const log = MeshBuilder.CreateCylinder('rl', { height: l.hz * 2, diameter: l.hx * 2, tessellation: 18 }, this.scene);
    log.rotation.x = Math.PI / 2; log.scaling.z = (l.yTop - l.yBase) / (l.hx * 2); log.parent = node; log.material = this.mats.bark; this.casters.push(log);
    this.addShape({ kind: 'box', x: l.x, z: l.z, hx: l.hx * 0.85, hz: l.hz, yBase: l.yBase, yTop: l.yTop, yaw: -l.yaw, surface: 'wood' });
    for (const sgn of [-1, 1]) {
      const lx = l.x + Math.sin(l.yaw) * sgn * (l.hz - 2.5), lz = l.z + Math.cos(l.yaw) * sgn * (l.hz - 2.5);
      const leg = MeshBuilder.CreateCylinder('leg', { height: l.yBase + 0.5, diameterTop: 2.6, diameterBottom: 3.8, tessellation: 12 }, this.scene);
      leg.position.set(lx, (l.yBase + 0.5) / 2, lz); leg.material = this.mats.bark; this.casters.push(leg);
      this.addShape({ kind: 'cyl', x: lx, z: lz, r: 1.6, yBase: 0, yTop: l.yBase + 0.2, surface: 'wood' });
    }
  }

  private buildGate(): void {
    const g = D.GATE;
    const lw = (g.x - g.hx) - D.BOUNDS[0], rw = D.BOUNDS[1] - (g.x + g.hx);
    this.addShape({ kind: 'box', x: D.BOUNDS[0] + lw / 2, z: g.z, hx: lw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.addShape({ kind: 'box', x: g.x + g.hx + rw / 2, z: g.z, hx: rw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.gateShape = this.addShape({ kind: 'box', x: g.x, z: g.z, hx: g.hx, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    // Muralha de teia: leque de teias empilhadas
    const web = MeshBuilder.CreatePlane('gateWeb', { width: g.hx * 2.4, height: 18 }, this.scene);
    web.position.set(g.x, 9, g.z); web.material = this.webMaterial(0.95); this.gateWeb = web;
    this.gateMarker = this.makeBeacon(g.x, g.z - 4, 0, 10, new Color3(0.6, 0.9, 1)); this.markers.push(this.gateMarker);
  }

  private buildAltar(): void {
    const a = D.ALTAR;
    const base = MeshBuilder.CreateCylinder('altar', { height: 2.2, diameterTop: 3.2, diameterBottom: 4.4, tessellation: 12 }, this.scene);
    base.position.set(a.x, 1.1, a.z); base.material = this.mats.stone; this.casters.push(base);
    this.addShape({ kind: 'cyl', x: a.x, z: a.z, r: 2.1, yBase: 0, yTop: 2.1, surface: 'stone' });
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const m = new StandardMaterial('sock' + i, this.scene); m.diffuseColor = new Color3(0.15, 0.2, 0.3); m.emissiveColor = new Color3(0.02, 0.03, 0.06); m.alpha = 0.9;
      const cr = MeshBuilder.CreatePolyhedron('sc', { type: 1, size: 0.45 }, this.scene); cr.scaling.y = 1.6; cr.position.set(a.x + Math.cos(ang) * 1.0, 2.9, a.z + Math.sin(ang) * 1.0); cr.material = m;
      this.sockets.push(m);
    }
    this.altarMarker = this.makeBeacon(a.x, a.z, 0, 10, new Color3(0.6, 0.9, 1)); this.markers.push(this.altarMarker);
  }

  /* ---------- estado ---------- */
  openGate(instant = false): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.world.shapes.splice(this.world.shapes.indexOf(this.gateShape), 1);
    this.gateMarker.setEnabled(false); this.altarMarker.setEnabled(false);
    for (const m of this.sockets) { m.emissiveColor = new Color3(0.3, 0.7, 1); m.diffuseColor = new Color3(0.4, 0.8, 1); }
    this.altarLight.intensity = 32;
    this.gateAnim = instant ? 1 : 0;
    if (instant) this.gateWeb.setEnabled(false);
  }
  private closeGate(): void {
    if (!this.gateOpen) return;
    this.gateOpen = false; this.gateAnim = -1;
    this.world.shapes.push(this.gateShape);
    this.gateWeb.setEnabled(true); this.gateWeb.scaling.setAll(1); (this.gateWeb.material as StandardMaterial).alpha = 0.95;
    for (const m of this.sockets) { m.emissiveColor = new Color3(0.02, 0.03, 0.06); m.diffuseColor = new Color3(0.15, 0.2, 0.3); }
    this.altarLight.intensity = 0;
  }
  applyFlags(flags: Set<string>): void { if (flags.has('altar')) this.openGate(true); }
  resetState(): void { this.restorePickups(); this.closeGate(); this.patrol = new Patrol({ points: D.HUNTER_PATH, speed: 4.2, range: 15, halfCone: 0.95, senseRadius: 3.8, seeTime: 1.1, pause: 1.4 }); this.hazard = null; }

  get alert(): number { return this.patrol.alert; }
  takeHazard(): string | null { const h = this.hazard; this.hazard = null; return h; }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.gateOpen || Math.hypot(x - D.ALTAR.x, z - D.ALTAR.z) > D.ALTAR.r) return undefined;
    const n = host.inventory.count('crystal');
    return {
      prompt: `(${Math.min(n, 3)}/3 cristais) Acender o altar`,
      run: () => {
        if (host.quests.currentObjective('floresta')?.id === 'tico') { host.toast('Converse com Tico primeiro.'); return; }
        if (n < 3) { host.toast(`Faltam ${3 - n} cristais de luz. Quique nos cogumelos cor-de-rosa!`, 3200); host.audio.warn(); return; }
        host.inventory.remove('crystal', 3); this.openGate(); host.flags.add('altar');
        host.quests.handle({ type: 'interact', target: 'altar' }); host.audio.collect(); host.audio.interact();
        host.toast('O altar brilha e a muralha de teia se desfaz! ✨', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    this.follow.copyFrom(playerPos);
    const covered = this.world.isCovered(playerPos.x, playerPos.z, playerPos.y);
    if (this.patrol.update(dt, playerPos, covered) === 'seen') this.hazard = 'A aranha-caçadora te viu!';
    this.hunter.root.position.set(this.patrol.x, 0, this.patrol.z); this.hunter.root.rotation.y = this.patrol.yaw;
    this.hunter.setMoving(this.patrol.moving ? 4.2 : 0); this.hunter.animate(dt);
    this.gateMarker.setEnabled(observing && !this.gateOpen);
    this.altarMarker.setEnabled(observing && !this.gateOpen);
    if (this.gateAnim >= 0 && this.gateAnim < 1) {
      this.gateAnim = Math.min(1, this.gateAnim + dt / 1.8);
      const k = this.gateAnim; this.gateWeb.scaling.setAll(1 + k * 0.1); (this.gateWeb.material as StandardMaterial).alpha = 0.95 * (1 - k);
      if (k >= 1) this.gateWeb.setEnabled(false);
    }
    this.altarLight.intensity = this.gateOpen ? 30 + Math.sin(this.t * 3) * 4 : 0;
  }
}
