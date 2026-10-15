import { Color3, Mesh, MeshBuilder, PointLight, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import { SealedGate } from './SealedGate';
import { LEVEL4_QUESTS } from '../data/quests';
import { pickColonyDialogue } from '../data/dialogues';
import { AntNpc, MantisModel } from '../player/Npcs';
import { Patrol, type PatrolOpts } from '../game/Patrol';
import * as D from './level4Data';

const MANTIS: PatrolOpts = { points: D.MANTIS_PATH, speed: 3.4, range: 22, halfCone: 0.8, senseRadius: 4.2, seeTime: 0.9, pause: 2 };

/** Fase 4 — A Colônia (Em Perigo): formigueiro, trilhas de formigas, louva-a-deus e o celeiro. */
export class Level4 extends LevelBase {
  readonly info: LevelInfo = {
    id: 4, title: 'A Colônia', subtitle: 'Em Perigo',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL4_QUESTS, mainQuest: 'colonia',
    totals: { seed: 4, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, crystal: 2, flower: 2, photo: 1, leaf: 2 },
    fog: { color: [0.5, 0.36, 0.27], density: 0.0135 },
    // Fim de tarde âmbar
    light: { dir: [-0.78, -0.34, 0.32], sun: [1, 0.62, 0.35], sunI: 3.0, sky: [0.9, 0.65, 0.5], ground: [0.25, 0.15, 0.1], hemiI: 0.62, exposure: 1.12, contrast: 1.2, saturation: 16, shadowHue: 280 },
    shafts: [[-12, -78], [12, -50], [-8, -18], [10, 14], [-2, 44], [6, 78]],
    springs: [[0, 0.5, 20]],
    pickDialogue: (npc, q) => pickColonyDialogue(npc, q),
    birdActive: (p, q) => q.currentObjective('colonia')?.id !== 'lino' && p.y < 6 && p.z > -70,
    interactPoints: { granary: { x: D.GRANARY.x, z: D.GRANARY.z - 4 } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS,
    stones: [...D.STONES, ...D.MOUND.tiers.map((t) => ({ x: D.MOUND.x, z: D.MOUND.z, r: t.r, h: t.h }))],
    puddles: [], waters: [], goal: { x: D.CHAMBER.x, z: D.CHAMBER.z },
    dynamic: () => [{ x1: D.GATE.x - D.GATE.hx, z1: D.GATE.z, x2: D.GATE.x + D.GATE.hx, z2: D.GATE.z, color: this.gate.open ? '#8fe08f' : '#e9b95d' }],
  };
  private gate!: SealedGate; private gateMarker!: Mesh; private granaryMarker!: Mesh;
  private mantis!: MantisModel; private patrol = new Patrol(MANTIS); private hazard: string | null = null;
  private walkers: { ant: AntNpc; pts: [number, number][]; i: number; x: number; z: number }[] = [];
  private granaryMat!: StandardMaterial; private lamp: PointLight;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.ROOTS.forEach((r) => this.addLog(r));
    D.TUNNELS.forEach((t) => this.addRaisedLog(t));
    this.buildMound();
    this.buildGate();
    this.buildGranary();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.buildFlowersAndMoss(41, D.BOUNDS, 50);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.CHAMBER.id, x: D.CHAMBER.x, z: D.CHAMBER.z, r: D.CHAMBER.r, type: 'goal' });

    this.mantis = new MantisModel(scene, this.mats);
    this.casters.push(...(this.mantis.meshes as Mesh[]));
    this.buildWalkers();
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: D.GATE.z,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.GRANARY.x, z: D.GRANARY.z, r: 8 }, { x: D.MOUND.x, z: D.MOUND.z, r: 16 }],
    });
    this.lamp = new PointLight('colL', new Vector3(D.GRANARY.x, 5, D.GRANARY.z), scene);
    this.lamp.diffuse = new Color3(1, 0.75, 0.4); this.lamp.intensity = 0; this.lamp.range = 30;
    this.finishBuild();
  }

  /** Grande formigueiro em terraços (escaláveis) com entradas escuras. */
  private buildMound(): void {
    const m = D.MOUND;
    m.tiers.forEach((t, i) => {
      const next = m.tiers[i + 1];
      const c = MeshBuilder.CreateCylinder('tier', { height: t.h, diameterBottom: t.r * 2.1, diameterTop: (next ? next.r : t.r * 0.7) * 2, tessellation: 28 }, this.scene);
      c.position.set(m.x, t.h / 2, m.z); c.material = this.mats.soil; c.receiveShadows = true; this.casters.push(c);
      this.addShape({ kind: 'cyl', x: m.x, z: m.z, r: t.r * 0.97, yBase: 0, yTop: t.h, surface: 'soil' });
    });
    const dark = new StandardMaterial('hole', this.scene); dark.diffuseColor = new Color3(0.03, 0.02, 0.02); dark.specularColor = Color3.Black();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4, r = m.tiers[0].r * 0.95;
      const h = MeshBuilder.CreateDisc('hole', { radius: 1.4, tessellation: 16 }, this.scene);
      h.position.set(m.x + Math.cos(a) * r, 1.0, m.z + Math.sin(a) * r); h.rotation.y = -a + Math.PI / 2; h.scaling.y = 1.3; h.material = dark;
    }
  }

  private buildGate(): void {
    const g = D.GATE;
    const sticks: Mesh[] = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const s = MeshBuilder.CreateCylinder('stick', { height: 15, diameter: 0.55 + (i % 3) * 0.1, tessellation: 7 }, this.scene);
      s.position.set(g.x - g.hx * 1.15 + (i / (n - 1)) * g.hx * 2.3, 7.4, g.z + ((i % 2) - 0.5) * 0.4); s.rotation.z = ((i * 37) % 10 - 5) * 0.012; sticks.push(s);
    }
    const bar = MeshBuilder.CreateBox('bar', { width: g.hx * 2.6, height: 0.5, depth: 0.5 }, this.scene); bar.position.set(g.x, 5, g.z - 0.4); sticks.push(bar);
    const bar2 = MeshBuilder.CreateBox('bar2', { width: g.hx * 2.6, height: 0.5, depth: 0.5 }, this.scene); bar2.position.set(g.x, 10, g.z - 0.4); sticks.push(bar2);
    const wall = Mesh.MergeMeshes(sticks, true, true) as Mesh;
    wall.material = this.mats.bark; this.casters.push(wall);
    this.gate = new SealedGate(this.world, D.BOUNDS, g, wall, 0);
    this.gateMarker = this.makeBeacon(g.x, g.z - 4, 0, 10, new Color3(1, 0.8, 0.4)); this.markers.push(this.gateMarker);
  }

  private buildGranary(): void {
    const a = D.GRANARY;
    const clay = new StandardMaterial('clay', this.scene); clay.diffuseColor = new Color3(0.7, 0.4, 0.22); clay.specularPower = 30;
    const pot = MeshBuilder.CreateSphere('pot', { diameter: 5, segments: 16 }, this.scene); pot.scaling.y = 0.85; pot.position.set(a.x, 2.1, a.z); pot.material = clay; this.casters.push(pot);
    this.addShape({ kind: 'cyl', x: a.x, z: a.z, r: 2.3, yBase: 0, yTop: 3.6, surface: 'stone' });
    this.granaryMat = new StandardMaterial('granary', this.scene); this.granaryMat.diffuseColor = new Color3(0.35, 0.22, 0.12); this.granaryMat.emissiveColor = new Color3(0, 0, 0);
    const top = MeshBuilder.CreateDisc('potTop', { radius: 1.9, tessellation: 20 }, this.scene); top.rotation.x = Math.PI / 2; top.position.set(a.x, 4.1, a.z); top.material = this.granaryMat;
    this.granaryMarker = this.makeBeacon(a.x, a.z, 0, 10, new Color3(1, 0.8, 0.4)); this.markers.push(this.granaryMarker);
  }

  /** Operárias carregando folhas em trilhas: vida de colônia. */
  private buildWalkers(): void {
    D.ANT_TRAILS.forEach((pts, k) => {
      for (let n = 0; n < 2; n++) {
        const ant = new AntNpc(this.scene, this.mats); ant.walk = 1; ant.root.scaling.setAll(0.95);
        const leaf = this.makeLeaf('carry', 0.9, 1.3, k + n, 0.3); leaf.parent = ant.root; leaf.position.set(0, 1.9, -0.8); leaf.rotation.set(0.1, 0, 0); leaf.scaling.setAll(0.7);
        this.casters.push(...(ant.meshes as Mesh[]));
        const t = n / 2; const [x0, z0] = pts[0], [x1, z1] = pts[1];
        this.walkers.push({ ant, pts, i: 1, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t });
      }
    });
  }

  /* ---------- estado ---------- */
  applyFlags(flags: Set<string>): void { if (flags.has('granary')) this.fillGranary(true); }
  resetState(): void { this.restorePickups(); this.gate.close(); this.granaryMat.emissiveColor = new Color3(0, 0, 0); this.lamp.intensity = 0; this.patrol = new Patrol(MANTIS); this.hazard = null; }
  private fillGranary(instant = false): void {
    this.gate.openNow(instant); this.gateMarker.setEnabled(false);
    this.granaryMat.emissiveColor = new Color3(0.9, 0.65, 0.2); this.granaryMat.diffuseColor = new Color3(0.95, 0.75, 0.3);
    this.lamp.intensity = 26;
  }

  get alert(): number { return this.patrol.alert; }
  takeHazard(): string | null { const h = this.hazard; this.hazard = null; return h; }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.gate.open || Math.hypot(x - D.GRANARY.x, z - D.GRANARY.z) > D.GRANARY.r) return undefined;
    const n = host.inventory.count('seed');
    return {
      prompt: `(${Math.min(n, 4)}/4 sementes) Abastecer o celeiro`,
      run: () => {
        if (host.quests.currentObjective('colonia')?.id === 'lino') { host.toast('Converse com Lino primeiro.'); return; }
        if (n < 4) { host.toast(`Faltam ${4 - n} sementes. Cuidado com o louva-a-deus!`, 3200); host.audio.warn(); return; }
        host.inventory.remove('seed', 4); this.fillGranary(); host.flags.add('granary');
        host.quests.handle({ type: 'interact', target: 'granary' }); host.audio.collect(); host.audio.interact();
        host.toast('O celeiro está cheio e a barricada se abre! 🌾', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    const covered = this.world.isCovered(playerPos.x, playerPos.z, playerPos.y);
    if (this.patrol.update(dt, playerPos, covered) === 'seen' && this.active) this.hazard = 'O louva-a-deus te viu!';
    this.mantis.root.position.set(this.patrol.x, 0, this.patrol.z); this.mantis.root.rotation.y = this.patrol.yaw;
    this.mantis.setMoving(this.patrol.moving ? 3.4 : 0); this.mantis.animate(dt);
    for (const w of this.walkers) {
      const [tx, tz] = w.pts[w.i]; const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
      if (d < 0.6) w.i = (w.i + 1) % w.pts.length;
      else { w.x += (dx / d) * 2.4 * dt; w.z += (dz / d) * 2.4 * dt; w.ant.root.rotation.y = Math.atan2(dx, dz); }
      w.ant.root.position.set(w.x, 0, w.z); w.ant.animate(dt);
    }
    this.gate.update(dt);
    this.gateMarker.setEnabled(observing && !this.gate.open);
    this.granaryMarker.setEnabled(observing && !this.gate.open);
    if (this.gate.open) this.lamp.intensity = 24 + Math.sin(this.t * 3) * 3;
  }
}
