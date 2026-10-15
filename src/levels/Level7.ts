import { Color3, Mesh, TransformNode, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import { LEVEL7_QUESTS } from '../data/quests';
import { pickNestDialogue } from '../data/dialogues';
import * as D from './level7Data';

/** Fase 7 — O Ninho Verde (Um Novo Lar): juntar folhas, erguer paredes e telhado, e a escolha de confiar em Dário. */
export class Level7 extends LevelBase {
  readonly info: LevelInfo = {
    id: 7, title: 'O Ninho Verde', subtitle: 'Um Novo Lar',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL7_QUESTS, mainQuest: 'ninho',
    totals: { leaf: 7, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: 3, crystal: 2, flower: 2, photo: 1 },
    fog: { color: [0.66, 0.8, 0.58], density: 0.0105 },
    // Tarde verde e acolhedora
    light: { dir: [-0.52, -0.56, 0.4], sun: [1, 0.92, 0.66], sunI: 3.3, sky: [0.8, 0.96, 0.85], ground: [0.28, 0.4, 0.2], hemiI: 0.78, exposure: 1.15, contrast: 1.15, saturation: 16, shadowHue: 150 },
    weather: { rain: 0, wind: 1.4 },
    shafts: [[-12, -78], [12, -50], [-8, -14], [10, 18], [-4, 44], [4, 66]],
    springs: [[30, 0.5, 30]],
    pickDialogue: (npc, q, flags) => pickNestDialogue(npc, q, flags),
    birdActive: (p, q) => q.currentObjective('ninho')?.id !== 'caramujo' && p.y < 6 && p.z > -70,
    interactPoints: { walls: { x: D.WALLS_SITE.x, z: D.WALLS_SITE.z }, roof: { x: D.ROOF_SITE.x, z: D.ROOF_SITE.z } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS, stones: D.STONES, puddles: [], waters: [], goal: { x: D.NEST.x, z: D.NEST.z },
  };
  wallsBuilt = false; roofBuilt = false;
  private wallNodes: TransformNode[] = []; private roofNodes: TransformNode[] = [];
  private wallT = -1; private roofT = -1;
  private wallsMarker!: Mesh; private roofMarker!: Mesh;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.LOGS.forEach((l) => this.addLog(l));
    this.buildNest();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.addWalkers(D.TRAILS, 2);
    this.buildFlowersAndMoss(71, D.BOUNDS, 50);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.NEST.id, x: D.NEST.x, z: D.NEST.z, r: D.NEST.r, type: 'goal' });
    this.wallsMarker = this.makeBeacon(D.WALLS_SITE.x, D.WALLS_SITE.z, 0, 9, new Color3(1, 0.85, 0.5)); this.markers.push(this.wallsMarker);
    this.roofMarker = this.makeBeacon(D.ROOF_SITE.x, D.ROOF_SITE.z, 0, 9, new Color3(1, 0.85, 0.5)); this.markers.push(this.roofMarker);
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: 9999,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 })), { x: D.NEST.x, z: D.NEST.z, r: 12 }, { x: 0, z: 48, r: 12 }],
    });
    this.finishBuild();
  }

  /** Ninho: paredes de folhas em círculo (com entrada ao sul) e telhado em cúpula. Aparecem ao serem construídos. */
  private buildNest(): void {
    const cx = D.NEST.x, cz = D.NEST.z + 2, R = 8.5;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      if (Math.sin(a) < -0.8) continue; // entrada voltada para o sul (−z)
      const node = new TransformNode('wall', this.scene); node.position.set(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R); node.rotation.y = -a + Math.PI / 2; node.setEnabled(false);
      const leaf = this.makeLeaf('wl', 1.8, 3.4, k, 0.2); leaf.parent = node; leaf.rotation.x = -1.35; leaf.position.set(0, 3.2, 0.4);
      this.wallNodes.push(node);
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const node = new TransformNode('roof', this.scene); node.position.set(cx + Math.cos(a) * 4.6, 6.4, cz + Math.sin(a) * 4.6); node.rotation.y = -a + Math.PI / 2; node.setEnabled(false);
      const leaf = this.makeLeaf('rl', 2.4, 4.6, k + 1, 0.15); leaf.parent = node; leaf.rotation.x = -0.55; leaf.position.set(0, 0, 0);
      this.roofNodes.push(node);
    }
  }

  private raise(nodes: TransformNode[], instant: boolean): void { for (const n of nodes) { n.setEnabled(true); n.scaling.setAll(instant ? 1 : 0.01); } }

  /* ---------- estado ---------- */
  private buildWalls(instant: boolean): void { if (this.wallsBuilt) return; this.wallsBuilt = true; this.raise(this.wallNodes, instant); this.wallT = instant ? 1 : 0; this.wallsMarker.setEnabled(false); }
  private buildRoof(instant: boolean): void { if (this.roofBuilt) return; this.roofBuilt = true; this.raise(this.roofNodes, instant); this.roofT = instant ? 1 : 0; this.roofMarker.setEnabled(false); }
  applyFlags(flags: Set<string>): void { if (flags.has('walls')) this.buildWalls(true); if (flags.has('roof')) this.buildRoof(true); this.applyDario(flags.has('dario')); }
  resetState(): void {
    this.restorePickups(); this.wallsBuilt = false; this.roofBuilt = false; this.wallT = this.roofT = -1;
    for (const n of [...this.wallNodes, ...this.roofNodes]) n.setEnabled(false);
    this.applyDario(false);
  }
  /** Com a paz feita, Dário vai ajudar no ninho. */
  private applyDario(friend: boolean): void {
    const d = this.npcs.find((n) => n.id === 'dario'); if (!d) return;
    const x = friend ? -7 : -34, z = friend ? 60 : -36;
    d.x = x; d.z = z; d.model.root.position.set(x, 0, z);
  }
  talked(npc: string, flags: Set<string>): void { if (npc === 'dario' && flags.has('dario')) this.applyDario(true); }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    const near = (s: { x: number; z: number; r: number }) => Math.hypot(x - s.x, z - s.z) <= s.r;
    const n = host.inventory.count('leaf');
    if (!this.wallsBuilt && near(D.WALLS_SITE)) {
      return {
        prompt: `(${Math.min(n, 3)}/3 folhas) Erguer as paredes do ninho`,
        run: () => {
          if (host.quests.currentObjective('ninho')?.id === 'caramujo') { host.toast('Converse com o Sr. Caramujo primeiro.'); return; }
          if (n < 3) { host.toast(`Faltam ${3 - n} folhas macias para as paredes.`, 3200); host.audio.warn(); return; }
          host.inventory.remove('leaf', 3); this.buildWalls(false); host.flags.add('walls');
          host.quests.handle({ type: 'interact', target: 'walls' }); host.audio.collect(); host.audio.interact();
          host.toast('As paredes do Ninho Verde se erguem! 🍃', 3200); host.changed();
        },
      };
    }
    if (this.wallsBuilt && !this.roofBuilt && near(D.ROOF_SITE)) {
      return {
        prompt: `(${Math.min(n, 3)}/3 folhas) Cobrir o ninho com o telhado`,
        run: () => {
          if (n < 3) { host.toast(`Faltam ${3 - n} folhas macias para o telhado.`, 3200); host.audio.warn(); return; }
          host.inventory.remove('leaf', 3); this.buildRoof(false); host.flags.add('roof');
          host.quests.handle({ type: 'interact', target: 'roof' }); host.audio.collect(); host.audio.interact();
          host.toast('O telhado cobre o ninho: um novo lar! 🏡', 3200); host.changed();
        },
      };
    }
    return undefined;
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    const grow = (nodes: TransformNode[], t: number): number => {
      if (t < 0 || t >= 1) return t;
      const nt = Math.min(1, t + dt / 2.2);
      nodes.forEach((n, i) => { const k = Math.max(0, Math.min(1, nt * 1.7 - (i / nodes.length) * 0.7)); n.scaling.setAll(Math.max(0.01, k * k * (3 - 2 * k))); });
      return nt;
    };
    this.wallT = grow(this.wallNodes, this.wallT); this.roofT = grow(this.roofNodes, this.roofT);
    this.wallsMarker.setEnabled(observing && !this.wallsBuilt);
    this.roofMarker.setEnabled(observing && this.wallsBuilt && !this.roofBuilt);
  }
}
