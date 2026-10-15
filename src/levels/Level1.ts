import { Color3, Mesh, MeshBuilder, PointLight, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import { LEVEL1_QUESTS } from '../data/quests';
import { pickDialogue } from '../data/dialogues';
import * as D from './level1Data';

/** Fase 1 — O Jardim das Gotas. */
export class Level1 extends LevelBase {
  readonly info: LevelInfo = {
    id: 1, title: 'O Jardim', subtitle: 'Início da Jornada',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL1_QUESTS, mainQuest: 'jardim',
    totals: { dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: D.PICKUPS.filter((p) => p.kind === 'seed').length },
    fog: { color: [0.76, 0.84, 0.66], density: 0.0105 },
    shafts: [[-6, -80], [14, -62], [-12, -38], [8, 20], [-2, 62], [10, 86]],
    springs: [[D.SHELTER.x + 12, 0.5, D.SHELTER.z + 2]],
    pickDialogue: (npc, q) => pickDialogue(npc, q),
    birdActive: (p, q, flags) => !flags.has('gate') && p.z > -45 && p.y < 6 && q.currentObjective('jardim')?.id !== 'tito',
    interactPoints: { leafgate: { x: D.GATE.x, z: D.GATE.z - 5 } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS, stones: D.STONES, puddles: D.PUDDLES, waters: [], goal: { x: D.SHELTER.x, z: D.SHELTER.z },
    dynamic: () => [{ x1: D.GATE.x - D.GATE.hx, z1: D.GATE.z, x2: D.GATE.x + D.GATE.hx, z2: D.GATE.z, color: this.gateOpen ? '#8fe08f' : '#e9b95d' }],
  };
  gateOpen = false;
  private gateMesh!: Mesh;
  private gateShape!: ReturnType<LevelBase['world']['add']>;
  private gateMarker!: Mesh;
  private shelterMarker!: Mesh;
  private gateAnim = -1;
  private lamp: PointLight;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.STEMS.forEach((s) => this.addClimbStem(s));
    D.LOGS.forEach((l) => this.addLog(l));
    this.buildGate();
    this.buildShelter();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS.map((n) => ({ ...n, kind: 'snail' as const, name: 'Tito' })));
    this.buildFlowersAndMoss(99, D.BOUNDS);
    this.addCheckpoints(D.CHECKPOINTS);
    D.PUDDLES.forEach((p) => this.addPuddle(p));
    this.world.zones.push({ id: 'shelter', x: D.SHELTER.x, z: D.SHELTER.z, r: D.SHELTER.r, type: 'goal' });
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: D.GATE.z,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.SHELTER.x, z: D.SHELTER.z, r: 9 }],
    });
    this.lamp = new PointLight('lamp', new Vector3(D.SHELTER.x, 3, D.SHELTER.z), scene);
    this.lamp.diffuse = new Color3(1, 0.8, 0.45); this.lamp.intensity = 40; this.lamp.range = 28;    this.finishBuild();
  }

  private buildGate(): void {
    const g = D.GATE;
    const lw = (g.x - g.hx) - D.BOUNDS[0], rw = D.BOUNDS[1] - (g.x + g.hx);
    this.addShape({ kind: 'box', x: D.BOUNDS[0] + lw / 2, z: g.z, hx: lw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.addShape({ kind: 'box', x: g.x + g.hx + rw / 2, z: g.z, hx: rw / 2, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    this.gateShape = this.addShape({ kind: 'box', x: g.x, z: g.z, hx: g.hx, hz: g.hz, yBase: 0, yTop: g.h, yaw: 0, surface: 'leaf' });
    const gate = MeshBuilder.CreateCylinder('gate', { height: 15, diameter: g.hx * 2.1, arc: 0.62, tessellation: 24, sideOrientation: 2 }, this.scene);
    gate.position.set(g.x, 7.5, g.z); gate.rotation.y = Math.PI * 0.69; gate.scaling.z = 0.35;
    const m = this.mats.leaves[0].clone('gateMat');
    m.albedoColor = new Color3(0.85, 0.72, 0.4); m.emissiveColor = new Color3(0.08, 0.05, 0.0);
    gate.material = m; this.gateMesh = gate; this.casters.push(gate);
    this.gateMarker = this.makeBeacon(g.x, g.z - 4, 0, 10, new Color3(1, 0.85, 0.4));
    this.markers.push(this.gateMarker);
  }

  private buildShelter(): void {
    const s = D.SHELTER;
    const a = this.makeLeaf('shelterL', 3.2, 5.5, 0, 0.0), b = this.makeLeaf('shelterR', 3.2, 5.5, 1, 0.0);
    a.position.set(s.x - 3, 0.1, s.z); a.rotation.set(0, 0, -1.0);
    b.position.set(s.x + 3, 0.1, s.z); b.rotation.set(0, 0, 1.0);
    for (const l of [a, b]) l.scaling.setAll(1.55);
    const glow = MeshBuilder.CreateSphere('lantern', { diameter: 1 }, this.scene);
    glow.position.set(s.x, 1.4, s.z); glow.material = this.mats.glow;
    this.shelterMarker = this.makeBeacon(s.x, s.z, 0, 14, new Color3(1, 0.85, 0.4));
    this.markers.push(this.shelterMarker);
    const water = MeshBuilder.CreateGround('brook', { width: 4, height: 18 }, this.scene);
    water.position.set(s.x + 12, 0.05, s.z + 2); water.material = this.mats.water;
  }

  /* ---------- estado ---------- */
  openGate(instant = false): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.world.shapes.splice(this.world.shapes.indexOf(this.gateShape), 1);
    this.gateMarker.setEnabled(false);
    this.gateAnim = instant ? 1 : 0;
    if (instant) this.gateMesh.setEnabled(false);
  }
  private closeGate(): void {
    if (!this.gateOpen) return;
    this.gateOpen = false; this.gateAnim = -1;
    this.world.shapes.push(this.gateShape);
    this.gateMesh.setEnabled(true); this.gateMesh.scaling.y = 1; this.gateMesh.position.y = 7.5;
    (this.gateMesh.material as unknown as { albedoColor: Color3 }).albedoColor = new Color3(0.85, 0.72, 0.4);
  }
  applyFlags(flags: Set<string>): void { if (flags.has('gate')) this.openGate(true); }
  resetState(): void { this.restorePickups(); this.closeGate(); }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.gateOpen || Math.hypot(x - D.GATE.x, z - D.GATE.z) > 7.5) return undefined;
    const n = host.inventory.count('dew');
    return {
      prompt: `(${Math.min(n, 5)}/5 gotas) Molhar a folha-portão`,
      run: () => {
        if (n < 5) { host.toast(`A folha está seca e enrolada. Faltam ${5 - n} gotas de orvalho.`, 3200); host.audio.warn(); return; }
        if (host.quests.currentObjective('jardim')?.id !== 'portao') { host.toast('Converse com Tito primeiro.'); return; }
        host.inventory.remove('dew', 5); this.openGate(); host.flags.add('gate');
        host.quests.handle({ type: 'interact', target: 'leafgate' }); host.audio.collect(); host.audio.interact();
        host.toast('A folha-portão se desenrola e abre o caminho! 🍃', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    this.gateMarker.setEnabled(observing && !this.gateOpen);
    this.shelterMarker.setEnabled(observing);
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
