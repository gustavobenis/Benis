import { Color3, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, PointLight, StandardMaterial, Texture, TransformNode, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { rng } from './Materials';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import { LEVEL8_QUESTS } from '../data/quests';
import { pickDawnDialogue } from '../data/dialogues';
import * as D from './level8Data';

/** Fase 8 — Juntos Sempre (O Vale do Novo Amanhecer): a comunidade reunida, o mural da jornada e o nascer do sol com Beto. */
export class Level8 extends LevelBase {
  readonly info: LevelInfo = {
    id: 8, title: 'Juntos Sempre', subtitle: 'Final',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL8_QUESTS, mainQuest: 'amanhecer',
    totals: { photo: 4, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: 1, crystal: 2, flower: 2, leaf: 1 },
    fog: { color: [0.92, 0.72, 0.66], density: 0.0092 },
    // Amanhecer rosado-dourado
    light: { dir: [-0.92, -0.18, 0.22], sun: [1, 0.78, 0.55], sunI: 3.7, sky: [1, 0.82, 0.78], ground: [0.42, 0.3, 0.25], hemiI: 0.82, exposure: 1.25, contrast: 1.12, saturation: 22, shadowHue: 330 },
    shafts: [[-12, -76], [12, -44], [-8, -8], [10, 26], [-4, 60], [4, 82]],
    springs: [[30, 0.5, 40]],
    pickDialogue: (npc, q) => pickDawnDialogue(npc, q),
    birdActive: () => false, // o final é uma celebração, sem perigos
    interactPoints: { board: { x: D.BOARD.x, z: D.BOARD.z } },
    cinematic: { npc: 'beto', objective: 'beto' },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS, stones: D.STONES, puddles: [], waters: [], goal: { x: D.SUNRISE.x, z: D.SUNRISE.z },
  };
  boardBuilt = false;
  private frames: TransformNode[] = []; private boardT = -1;
  private boardMarker!: Mesh; private lamp: PointLight;
  private petals: ParticleSystem; private follow = new Vector3();

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    D.STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    this.buildBloomField();
    this.buildBoard();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    this.buildFlowersAndMoss(81, D.BOUNDS, 40);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.SUNRISE.id, x: D.SUNRISE.x, z: D.SUNRISE.z, r: D.SUNRISE.r, type: 'goal' });
    this.boardMarker = this.makeBeacon(D.BOARD.x, D.BOARD.z, 0, 9, new Color3(1, 0.85, 0.5)); this.markers.push(this.boardMarker);
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: 9999,
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 5 })), { x: D.BOARD.x, z: D.BOARD.z, r: 9 }],
    });
    this.lamp = new PointLight('boardL', new Vector3(D.BOARD.x, 5, D.BOARD.z), scene);
    this.lamp.diffuse = new Color3(1, 0.82, 0.55); this.lamp.intensity = 0; this.lamp.range = 30;

    // Pétalas caindo suavemente em volta de Marieta
    const tex = new DynamicTexture('petal', { width: 32, height: 32 }, scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(16, 16, 1, 16, 16, 14); g.addColorStop(0, 'rgba(255,200,220,1)'); g.addColorStop(1, 'rgba(255,150,190,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32); tex.update();
    const ps = new ParticleSystem('petals', 120, scene);
    ps.particleTexture = tex as unknown as Texture; ps.emitter = this.follow;
    ps.minEmitBox = new Vector3(-22, 14, -22); ps.maxEmitBox = new Vector3(22, 16, 22);
    ps.direction1 = new Vector3(-0.6, -0.8, -0.4); ps.direction2 = new Vector3(0.6, -0.5, 0.4); ps.minEmitPower = 1; ps.maxEmitPower = 2.4;
    ps.minLifeTime = 6; ps.maxLifeTime = 9; ps.emitRate = 14; ps.minSize = 0.35; ps.maxSize = 0.7; ps.minAngularSpeed = -2; ps.maxAngularSpeed = 2;
    ps.color1 = new Color3(1, 0.7, 0.8).toColor4(0.95); ps.color2 = new Color3(1, 0.9, 0.7).toColor4(0.9); ps.colorDead = new Color3(1, 0.8, 0.9).toColor4(0);
    ps.gravity = new Vector3(0.3, -0.5, 0.1); ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; ps.start();
    this.petals = ps;
    this.finishBuild();
  }

  dispose(): void { this.petals.dispose(); super.dispose(); }

  /** O vale já está florido: muitas flores espalhadas (sem colisão). */
  private buildBloomField(): void {
    const r = rng(88);
    const cols = [new Color3(1, 0.45, 0.7), new Color3(1, 0.8, 0.25), new Color3(0.75, 0.5, 1), new Color3(1, 0.6, 0.4), new Color3(1, 1, 1)];
    const mats = cols.map((c, i) => { const m = new StandardMaterial('bfM' + i, this.scene); m.diffuseColor = c; m.emissiveColor = c.scale(0.3); m.backFaceCulling = false; return m; });
    for (let i = 0; i < 90; i++) {
      const x = -54 + r() * 108, z = -94 + r() * 188;
      if (this.world.shapes.some((s) => Math.hypot(x - s.x, z - s.z) < 5) || D.NPCS.some((n) => Math.hypot(x - n.x, z - n.z) < 4)) continue;
      const h = 2.5 + r() * 4.5;
      const stem = MeshBuilder.CreateCylinder('bs', { height: h, diameter: 0.22, tessellation: 6 }, this.scene); stem.position.set(x, h / 2, z); stem.material = this.mats.leaves[2];
      const petals: Mesh[] = [];
      for (let k = 0; k < 8; k++) { const p = MeshBuilder.CreateSphere('p', { diameter: 1, segments: 6 }, this.scene); p.scaling.set(1.5, 0.12, 0.55); const a = (k / 8) * Math.PI * 2; p.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85); p.rotation.y = -a; petals.push(p); }
      const head = Mesh.MergeMeshes(petals, true, true) as Mesh; head.material = mats[Math.floor(r() * mats.length)]; head.position.set(x, h, z);
    }
  }

  /** Mural da jornada na praça: quatro molduras que surgem quando as fotos são colocadas. */
  private buildBoard(): void {
    const b = D.BOARD;
    const post = MeshBuilder.CreateCylinder('post', { height: 6, diameter: 0.8, tessellation: 8 }, this.scene); post.position.set(b.x, 3, b.z + 3); post.material = this.mats.bark; this.casters.push(post);
    const frameMat = new StandardMaterial('frame', this.scene); frameMat.diffuseColor = new Color3(0.55, 0.35, 0.18);
    const photoMat = new StandardMaterial('pframe', this.scene); photoMat.diffuseColor = new Color3(0.95, 0.9, 0.75); photoMat.emissiveColor = new Color3(0.35, 0.3, 0.2);
    for (let k = 0; k < 4; k++) {
      const node = new TransformNode('frameN', this.scene); node.position.set(b.x + (k - 1.5) * 2.6, 5.4 + (k % 2) * 1.2, b.z + 2.6); node.rotation.y = (k - 1.5) * -0.12; node.setEnabled(false);
      const fr = MeshBuilder.CreateBox('fr', { width: 2.2, height: 2.6, depth: 0.18 }, this.scene); fr.material = frameMat; fr.parent = node;
      const ph = MeshBuilder.CreateBox('ph', { width: 1.8, height: 2.2, depth: 0.2 }, this.scene); ph.material = photoMat; ph.parent = node; ph.position.z = -0.03;
      this.frames.push(node);
    }
    const base = MeshBuilder.CreateCylinder('plaza', { height: 0.3, diameter: 14, tessellation: 28 }, this.scene); base.position.set(b.x, 0.15, b.z); base.material = this.mats.stone; base.receiveShadows = true;
  }

  /* ---------- estado ---------- */
  private buildBoardNow(instant: boolean): void {
    if (this.boardBuilt) return;
    this.boardBuilt = true;
    for (const n of this.frames) { n.setEnabled(true); n.scaling.setAll(instant ? 1 : 0.01); }
    this.boardT = instant ? 1 : 0; this.boardMarker.setEnabled(false); this.lamp.intensity = 24;
  }
  applyFlags(flags: Set<string>): void { if (flags.has('board')) this.buildBoardNow(true); }
  resetState(): void { this.restorePickups(); this.boardBuilt = false; this.boardT = -1; this.lamp.intensity = 0; for (const n of this.frames) n.setEnabled(false); }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.boardBuilt || Math.hypot(x - D.BOARD.x, z - D.BOARD.z) > D.BOARD.r) return undefined;
    const n = host.inventory.count('photo');
    return {
      prompt: `(${Math.min(n, 4)}/4 fotos) Montar o mural da jornada`,
      run: () => {
        if (host.quests.currentObjective('amanhecer')?.id === 'rita') { host.toast('Converse com Rita primeiro.'); return; }
        if (n < 4) { host.toast(`Faltam ${4 - n} fotos dos amigos da jornada.`, 3200); host.audio.warn(); return; }
        host.inventory.remove('photo', 4); this.buildBoardNow(false); host.flags.add('board');
        host.quests.handle({ type: 'interact', target: 'board' }); host.audio.collect(); host.audio.interact();
        host.toast('O mural da jornada ilumina a praça! 📷', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    this.follow.copyFrom(playerPos);
    if (this.boardT >= 0 && this.boardT < 1) {
      this.boardT = Math.min(1, this.boardT + dt / 2);
      this.frames.forEach((n, i) => { const k = Math.max(0, Math.min(1, this.boardT * 1.8 - i * 0.2)); n.scaling.setAll(Math.max(0.01, k * k * (3 - 2 * k))); });
    }
    this.boardMarker.setEnabled(observing && !this.boardBuilt);
    if (this.boardBuilt) this.lamp.intensity = 22 + Math.sin(this.t * 2) * 3;
  }
}
