import { Color3, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, StandardMaterial, TransformNode, Vector3, VertexBuffer } from '@babylonjs/core';
import type { AbstractMesh, BaseTexture, Light, Material, Observer, Scene, Texture } from '@babylonjs/core';
import { CollisionWorld } from '../physics/CollisionWorld';
import type { Shape, Surface } from '../physics/CollisionWorld';
import { Materials, rng } from './Materials';
import { Grass } from './Grass';
import { createNpcModel, type NpcKind, type NpcModel } from '../player/Npcs';
import type { ItemId, Inventory } from '../systems/Inventory';
import type { GameEvent, QuestDef, QuestLog } from '../systems/Quests';
import type { DialogueDef } from '../systems/Dialogue';
import type { GameAudio } from '../engine/Audio';
import type { LightPreset } from './Environment';
import type { Difficulty } from '../systems/Settings';

export interface PickupDef { id: string; kind: ItemId; x: number; y: number; z: number }
export interface NpcDef { id: string; kind: NpcKind; name: string; x: number; z: number; yaw: number }
export interface StoneDef { x: number; z: number; r: number; h: number }
export interface LeafDef { x: number; z: number; y: number; hx: number; hz: number; yaw: number }
export interface MushroomDef { x: number; z: number; stem: number; capR: number; stemR: number; /** Trampolim: velocidade de lançamento. */ bounce?: number; /** Chapéu luminoso (cor RGB 0..1). */ glow?: [number, number, number] }
export interface StemDef { x: number; z: number; h: number; r: number }
export interface LogDef { x: number; z: number; hx: number; hz: number; h: number; yaw: number }
export interface PuddleDef { id: string; x: number; z: number; r: number }
export interface CheckpointDef { id: string; x: number; z: number; r: number }

export interface Pickup { def: PickupDef; node: TransformNode; taken: boolean; marker: Mesh }
export interface Npc { id: string; name: string; x: number; z: number; model: NpcModel; marker: Mesh }

/** Dados para desenhar o mapa simplificado. */
export interface MapData {
  bounds: [number, number, number, number];
  leaves: LeafDef[]; mushrooms: MushroomDef[]; stones: StoneDef[]; puddles: { x: number; z: number; r: number }[];
  waters: { minX: number; maxX: number; minZ: number; maxZ: number }[];
  goal: { x: number; z: number };
  /** Linhas que mudam com o jogo (portão, ponte). */
  dynamic?: () => { x1: number; z1: number; x2: number; z2: number; color: string }[];
}

/** O que a fase precisa do jogo (sem conhecer a classe Game). */
export interface LevelHost {
  inventory: Inventory; quests: QuestLog; flags: Set<string>;
  toast(text: string, ms?: number): void;
  audio: GameAudio;
  changed(): void;
}
export interface Interaction { prompt: string; run(): void }

export interface LevelInfo {
  id: number; title: string; subtitle: string;
  start: { x: number; z: number };
  quests: QuestDef[]; mainQuest: string;
  totals: Partial<Record<ItemId, number>>;
  fog: { color: [number, number, number]; density: number };
  light: LightPreset;
  shafts: [number, number][];
  /** Clima da fase: chuva 0..1 e vento visual nas plantas (1 = brisa). */
  weather?: { rain: number; wind: number };
  springs: [number, number, number][];
  pickDialogue(npc: string, q: QuestLog, flags: Set<string>): DialogueDef;
  birdActive(p: { x: number; y: number; z: number }, q: QuestLog, flags: Set<string>): boolean;
  /** Fase com rio: primeiro resgate narrativo. */
  rescue?: { x: number; z: number; npc: string };
  /** Pontos de interação para o indicador de objetivo (alvos `interact`). */
  interactPoints: Record<string, { x: number; z: number }>;
  onTalk?(npc: string, host: LevelHost): void;
}

/** Base das fases: construtores de cenário reutilizáveis, coletáveis, NPCs e descarte limpo. */
export abstract class LevelBase {
  abstract readonly info: LevelInfo;
  abstract readonly map: MapData;
  readonly world = new CollisionWorld();
  readonly mats: Materials;
  readonly pickups: Pickup[] = [];
  readonly npcs: Npc[] = [];
  readonly casters: AbstractMesh[] = [];
  grass!: Grass;
  protected markers: Mesh[] = [];
  /** Clarão de relâmpago (0..1) lido pelo jogo a cada quadro. */
  flash = 0;
  /** Vento (unidades/s) que empurra Marieta quando ela não está coberta. */
  wind = { x: 0, z: 0 };
  /** Fila de eventos sonoros/avisos da fase ('thunder', 'gust'), consumida pelo jogo. */
  readonly events: string[] = [];
  difficulty: Difficulty = 'balanced';
  /** Verdadeiro somente enquanto o jogador está jogando (não em menu, diálogo ou pausa): perigos só contam aqui. */
  active = false;
  protected t = 0;
  private sparkle: ParticleSystem;
  private owned: { meshes: AbstractMesh[]; materials: Material[]; textures: BaseTexture[]; lights: Light[]; nodes: TransformNode[] } = { meshes: [], materials: [], textures: [], lights: [], nodes: [] };
  private obs: Observer<unknown>[] = [];

  constructor(protected scene: Scene) {
    this.obs.push(
      scene.onNewMeshAddedObservable.add((m) => this.owned.meshes.push(m)) as Observer<unknown>,
      scene.onNewMaterialAddedObservable.add((m) => this.owned.materials.push(m)) as Observer<unknown>,
      scene.onNewTextureAddedObservable.add((t) => this.owned.textures.push(t)) as Observer<unknown>,
      scene.onNewLightAddedObservable.add((l) => this.owned.lights.push(l)) as Observer<unknown>,
      scene.onNewTransformNodeAddedObservable.add((n) => this.owned.nodes.push(n)) as Observer<unknown>,
    );
    this.mats = new Materials(scene);
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
  }

  /**
   * Encerra o rastreio de recursos: só o que foi criado durante a construção pertence à fase.
   * (Recursos criados depois, como as texturas do pós-processamento, não podem ser descartados com ela.)
   */
  protected finishBuild(): void { for (const o of this.obs) o.remove(); this.obs = []; }

  /** Estado dinâmico da fase (portão, ponte…) a partir das flags salvas. */
  abstract applyFlags(flags: Set<string>): void;
  /** Volta ao estado inicial (novo jogo). */
  abstract resetState(): void;
  /** Interação específica da fase perto de (x,z), se houver. */
  abstract interaction(x: number, z: number, host: LevelHost): Interaction | undefined;
  abstract update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void;

  /** Chamado pelo jogo quando uma conversa com `npc` termina. */
  talked(_npc: string): void { /* por padrão, nada */ }

  /** Alerta de predador da fase (0..1) para o indicador de perigo. */
  get alert(): number { return 0; }
  /** Perigo pendente (ex.: foi vista pela aranha): devolve a mensagem uma única vez. */
  takeHazard(): string | null { return null; }

  /** Ao receber um evento de zona (ex.: chegar à outra margem). */
  zoneEvent(id: string): GameEvent { return { type: 'reach', target: id }; }

  dispose(): void {
    for (const o of this.obs) o.remove();
    this.sparkle.dispose();
    this.grass?.mesh.dispose();
    for (const m of this.owned.meshes) if (!m.isDisposed()) m.dispose(false, false);
    for (const n of this.owned.nodes) if (!n.isDisposed()) n.dispose();
    for (const l of this.owned.lights) l.dispose();
    for (const m of this.owned.materials) m.dispose(false, false);
    for (const t of this.owned.textures) t.dispose();
  }

  /* ---------- construtores de cenário ---------- */
  protected buildGround(w: number, h: number): void {
    const ground = MeshBuilder.CreateGround('ground', { width: w, height: h, subdivisions: 1 }, this.scene);
    ground.material = this.mats.soil; ground.receiveShadows = true; ground.isPickable = false;
    (this.mats.soil.albedoTexture as Texture).uScale = w / 4; (this.mats.soil.albedoTexture as Texture).vScale = h / 4;
  }

  /** Folha com curvatura natural e forma pontuda (malha editada). */
  makeLeaf(name: string, hx: number, hz: number, tint: number, curl = 0.1): Mesh {
    const leaf = MeshBuilder.CreateGround(name, { width: 2, height: 2, subdivisions: 14, updatable: true }, this.scene);
    const pos = leaf.getVerticesData(VertexBuffer.PositionKind)!;
    const uvs = leaf.getVerticesData(VertexBuffer.UVKind)!;
    for (let i = 0; i < pos.length; i += 3) {
      const u = pos[i] / 2 + 0.5, v = pos[i + 2] / 2 + 0.5;
      const prof = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, v * 0.96 + 0.02))), 0.55);
      const x = pos[i] * prof;
      pos[i] = x * hx;
      pos[i + 2] = (v - 0.5) * 2 * hz;
      pos[i + 1] = -curl * x * x * hx * 0.6 - Math.max(0, v - 0.7) * hz * 0.12 * (v - 0.7) * 3;
      uvs[(i / 3) * 2] = u; uvs[(i / 3) * 2 + 1] = v;
    }
    leaf.updateVerticesData(VertexBuffer.PositionKind, pos);
    leaf.updateVerticesData(VertexBuffer.UVKind, uvs);
    leaf.createNormals(true); leaf.refreshBoundingInfo();
    leaf.material = this.mats.leaves[tint % this.mats.leaves.length];
    leaf.receiveShadows = true; this.casters.push(leaf);
    return leaf;
  }

  protected addShape(s: Shape): Shape { return this.world.add(s); }

  protected addStone(s: StoneDef, surface: Surface = 'stone'): void {
    const r = rng(Math.floor(s.x * 31 + s.z * 17));
    const m = MeshBuilder.CreateSphere('stone', { diameter: 2, segments: 14 }, this.scene);
    m.scaling.set(s.r, s.h, s.r); m.position.set(s.x, 0, s.z); m.rotation.y = r() * 6;
    const p = m.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < p.length; i += 3) { const k = 1 + Math.sin(p[i] * 5 + p[i + 2] * 3) * 0.05; p[i] *= k; p[i + 2] *= k; }
    m.updateVerticesData(VertexBuffer.PositionKind, p); m.createNormals(true);
    m.material = this.mats.stone; m.receiveShadows = true; this.casters.push(m);
    this.addShape({ kind: 'cyl', x: s.x, z: s.z, r: s.r * 0.9, yBase: 0, yTop: s.h * 0.88, surface });
  }

  protected addLeafPlatform(l: LeafDef, tint: number): void {
    const leaf = this.makeLeaf('leaf', l.hx, l.hz, tint);
    leaf.position.set(l.x, l.y - 0.05, l.z); leaf.rotation.y = l.yaw;
    this.addShape({ kind: 'box', x: l.x, z: l.z, hx: l.hx * 0.72, hz: l.hz * 0.78, yBase: l.y - 0.35, yTop: l.y, yaw: -l.yaw, surface: 'leaf' });
    const bx = l.x - Math.sin(l.yaw) * (l.hz * 0.95), bz = l.z - Math.cos(l.yaw) * (l.hz * 0.95);
    const stalk = MeshBuilder.CreateCylinder('stalk', { height: l.y + 0.2, diameterTop: 0.35, diameterBottom: 0.7, tessellation: 8 }, this.scene);
    stalk.position.set(bx, (l.y + 0.2) / 2 - 0.1, bz); stalk.material = this.mats.leaves[2]; this.casters.push(stalk);
  }

  protected addMushroom(m: MushroomDef): void {
    const stem = MeshBuilder.CreateCylinder('stem', { height: m.stem, diameterTop: m.stemR * 1.5, diameterBottom: m.stemR * 2.2, tessellation: 14 }, this.scene);
    stem.position.set(m.x, m.stem / 2, m.z); stem.material = this.mats.mushStem; this.casters.push(stem);
    const capH = m.capR * 0.42;
    const cap = MeshBuilder.CreateSphere('cap', { diameter: m.capR * 2, segments: 20, slice: 0.5 }, this.scene);
    cap.scaling.y = capH / m.capR; cap.position.set(m.x, m.stem - 0.05, m.z); cap.material = this.mats.mushCap;
    cap.receiveShadows = true; this.casters.push(cap);
    this.addShape({ kind: 'cyl', x: m.x, z: m.z, r: m.stemR * 1.1, yBase: 0, yTop: m.stem, surface: 'wood' });
    const capShape = this.addShape({ kind: 'cyl', x: m.x, z: m.z, r: m.capR * 0.8, yBase: m.stem - 0.6, yTop: m.stem + capH * 0.7, surface: 'moss' });
    if (m.bounce) capShape.bounce = m.bounce;
    if (m.glow) {
      const g = new StandardMaterial('glowCap', this.scene);
      g.diffuseColor = new Color3(...m.glow).scale(0.55); g.emissiveColor = new Color3(...m.glow).scale(0.75); g.specularPower = 60;
      cap.material = g;
    }
  }

  protected addClimbStem(s: StemDef): void {
    const st = MeshBuilder.CreateCylinder('climb', { height: s.h, diameterTop: s.r * 1.6, diameterBottom: s.r * 2.3, tessellation: 12 }, this.scene);
    st.position.set(s.x, s.h / 2, s.z); st.material = this.mats.leaves[1]; this.casters.push(st);
    this.addShape({ kind: 'cyl', x: s.x, z: s.z, r: s.r, yBase: 0, yTop: s.h, surface: 'leaf', climbable: true });
    for (let k = 1; k < 6; k++) { const ring = MeshBuilder.CreateTorus('node', { diameter: s.r * 2.2, thickness: 0.18, tessellation: 14 }, this.scene); ring.position.set(s.x, (k * s.h) / 6, s.z); ring.material = this.mats.leaves[0]; }
    this.markers.push(this.makeBeacon(s.x, s.z, 0, 8, new Color3(0.5, 1, 0.6)));
  }

  protected addLog(l: LogDef): void {
    const log = MeshBuilder.CreateCylinder('log', { height: l.hz * 2, diameter: l.h * 2, tessellation: 14 }, this.scene);
    log.rotation.x = Math.PI / 2; log.position.y = l.h * 0.5;
    const node = new TransformNode('logN', this.scene); node.position.set(l.x, 0, l.z); node.rotation.y = l.yaw; log.parent = node;
    log.material = this.mats.bark; this.casters.push(log);
    this.addShape({ kind: 'box', x: l.x, z: l.z, hx: l.hx * 0.95, hz: l.hz, yBase: 0, yTop: l.h * 0.95, yaw: -l.yaw, surface: 'wood' });
  }

  /** Tronco suspenso sobre dois apoios: forma um túnel de sombra por baixo. */
  protected addRaisedLog(l: { x: number; z: number; hx: number; hz: number; yaw: number; yBase: number; yTop: number }): void {
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

  protected addPuddle(p: PuddleDef): void {
    this.world.zones.push({ id: p.id, x: p.x, z: p.z, r: p.r, type: 'puddle' });
    const d = MeshBuilder.CreateDisc('puddle', { radius: p.r, tessellation: 40 }, this.scene);
    d.rotation.x = Math.PI / 2; d.position.set(p.x, 0.04, p.z); d.scaling.z = 0.75; d.material = this.mats.water; d.isPickable = false;
  }

  protected addCheckpoints(cps: CheckpointDef[]): void { for (const z of cps) this.world.zones.push({ id: z.id, x: z.x, z: z.z, r: z.r, type: 'checkpoint' }); }

  protected buildPickups(defs: PickupDef[]): void {
    const crystalMat = new StandardMaterial('crystal', this.scene);
    crystalMat.diffuseColor = new Color3(0.4, 0.6, 1); crystalMat.emissiveColor = new Color3(0.15, 0.3, 0.7); crystalMat.alpha = 0.8; crystalMat.specularPower = 120;
    const photoMat = new StandardMaterial('photo', this.scene); photoMat.diffuseColor = new Color3(0.95, 0.9, 0.78); photoMat.emissiveColor = new Color3(0.3, 0.28, 0.2);
    const petal = new StandardMaterial('petalP', this.scene); petal.diffuseColor = new Color3(0.95, 0.4, 0.7); petal.emissiveColor = new Color3(0.3, 0.1, 0.2); petal.backFaceCulling = false;
    for (const d of defs) {
      const node = new TransformNode(d.id, this.scene); node.position.set(d.x, d.y, d.z);
      let tint = new Color3(0.5, 0.9, 1);
      if (d.kind === 'dew') {
        const drop = MeshBuilder.CreateSphere('dew', { diameter: 1.0, segments: 16 }, this.scene);
        drop.scaling.set(1, 1.15, 1); drop.material = this.mats.dew; drop.parent = node;
        const hl = MeshBuilder.CreateSphere('hl', { diameter: 0.2 }, this.scene); hl.position.set(-0.17, 0.25, -0.2); hl.material = this.mats.white; hl.parent = node;
      } else if (d.kind === 'seed') {
        tint = new Color3(1, 0.6, 0.3);
        const seed = MeshBuilder.CreateSphere('seed', { diameter: 0.7, segments: 12 }, this.scene);
        seed.scaling.set(0.7, 1.1, 0.7); seed.material = this.mats.seed; seed.parent = node; seed.rotation.z = 0.5;
        const halo = MeshBuilder.CreateSphere('halo', { diameter: 1.2 }, this.scene); halo.material = this.mats.glow; halo.parent = node;
      } else if (d.kind === 'leaf') {
        tint = new Color3(0.6, 1, 0.5);
        const lf = this.makeLeaf('pleaf', 0.55, 0.9, 0, 0.3); lf.parent = node; lf.rotation.x = 0.5;
        const halo = MeshBuilder.CreateSphere('halo', { diameter: 1.7 }, this.scene); halo.material = this.mats.glow; halo.parent = node;
      } else if (d.kind === 'flower') {
        tint = new Color3(1, 0.5, 0.8);
        for (let k = 0; k < 6; k++) {
          const p = MeshBuilder.CreateSphere('p', { diameter: 0.6, segments: 6 }, this.scene); p.scaling.set(1.3, 0.2, 0.55);
          const a = (k / 6) * Math.PI * 2; p.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); p.rotation.y = -a; p.material = petal; p.parent = node;
        }
        const c = MeshBuilder.CreateSphere('c', { diameter: 0.3 }, this.scene); c.material = this.mats.glow; c.parent = node; node.rotation.x = 0.4;
      } else if (d.kind === 'crystal') {
        tint = new Color3(0.5, 0.7, 1);
        const cr = MeshBuilder.CreatePolyhedron('cr', { type: 1, size: 0.55 }, this.scene); cr.scaling.y = 1.5; cr.material = crystalMat; cr.parent = node;
      } else {
        tint = new Color3(1, 0.95, 0.7);
        const ph = MeshBuilder.CreateBox('ph', { width: 0.9, height: 0.06, depth: 1.1 }, this.scene); ph.material = photoMat; ph.parent = node; node.rotation.x = 0.5;
      }
      const marker = this.makeBeacon(d.x, d.z, d.y - 0.5, 7, tint);
      this.markers.push(marker);
      this.pickups.push({ def: d, node, taken: false, marker });
    }
  }

  protected buildNpcs(defs: NpcDef[]): void {
    for (const n of defs) {
      const model = createNpcModel(n.kind, this.scene, this.mats);
      model.root.position.set(n.x, model.hover, n.z); model.root.rotation.y = n.yaw;
      if (n.kind === 'snail') model.root.scaling.setAll(1.3);
      this.casters.push(...(model.meshes as Mesh[]));
      const marker = this.makeBeacon(n.x, n.z, 0, 6, new Color3(1, 0.85, 0.4));
      this.markers.push(marker);
      this.npcs.push({ id: n.id, name: n.name, x: n.x, z: n.z, model, marker });
      if (n.kind !== 'butterfly') this.world.add({ kind: 'cyl', x: n.x, z: n.z, r: n.kind === 'beetle' ? 1.5 : 1.2, yBase: 0, yTop: 1.6, surface: 'soil' });
    }
  }

  protected makeBeacon(x: number, z: number, y: number, h: number, color: Color3): Mesh {
    const b = MeshBuilder.CreateCylinder('beacon', { height: h, diameterTop: 0.12, diameterBottom: 0.7, tessellation: 10 }, this.scene);
    b.position.set(x, y + h / 2, z); b.isPickable = false; b.setEnabled(false);
    const m = new StandardMaterial('beaconM', this.scene);
    m.emissiveColor = color; m.disableLighting = true; m.alpha = 0.28; m.fogEnabled = false;
    b.material = m;
    return b;
  }

  protected buildFlowersAndMoss(seed: number, bounds: [number, number, number, number], mossCount = 46): void {
    const r = rng(seed);
    const [minX, maxX, minZ, maxZ] = bounds;
    const petalColors = [new Color3(0.95, 0.4, 0.6), new Color3(0.7, 0.45, 0.95), new Color3(1, 0.85, 0.3), new Color3(1, 1, 1)];
    const mats = petalColors.map((c, i) => { const m = new StandardMaterial('petal' + i, this.scene); m.diffuseColor = c; m.emissiveColor = c.scale(0.25); m.backFaceCulling = false; return m; });
    for (let i = 0; i < 18; i++) {
      const edge = r() < 0.6;
      const x = edge ? (r() < 0.5 ? -1 : 1) * (maxX * 0.62 + r() * maxX * 0.34) : minX + r() * (maxX - minX);
      const z = minZ + 8 + r() * (maxZ - minZ - 16);
      if (this.world.shapes.some((s) => Math.hypot(x - s.x, z - s.z) < 6) || this.world.waterAt(x, z)) continue;
      const h = 4 + r() * 6;
      const stem = MeshBuilder.CreateCylinder('fs', { height: h, diameter: 0.25, tessellation: 6 }, this.scene);
      stem.position.set(x, h / 2, z); stem.material = this.mats.leaves[2];
      const petals: Mesh[] = [];
      for (let k = 0; k < 8; k++) {
        const p = MeshBuilder.CreateSphere('p', { diameter: 1, segments: 6 }, this.scene);
        p.scaling.set(1.6, 0.12, 0.6);
        const a = (k / 8) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); p.rotation.y = -a; petals.push(p);
      }
      const head = Mesh.MergeMeshes(petals, true, true) as Mesh;
      head.material = mats[Math.floor(r() * mats.length)]; head.position.set(x, h, z); head.rotation.x = 0.35;
      const c = MeshBuilder.CreateSphere('core', { diameter: 0.7 }, this.scene);
      c.position.set(x, h + 0.08, z); c.material = this.mats.glow;
      this.casters.push(head);
    }
    const mm = new StandardMaterial('moss', this.scene);
    const t = new DynamicTexture('mossT', { width: 128, height: 128 }, this.scene, true);
    const c = t.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(70,120,40,0.95)'); g.addColorStop(0.6, 'rgba(60,105,40,0.6)'); g.addColorStop(1, 'rgba(60,100,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.update(); t.hasAlpha = true;
    mm.diffuseTexture = t; mm.useAlphaFromDiffuseTexture = true; mm.specularColor = Color3.Black(); mm.backFaceCulling = false;
    for (let i = 0; i < mossCount; i++) {
      const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ);
      if (this.world.waterAt(x, z)) continue;
      const d = MeshBuilder.CreateDisc('m', { radius: 1, tessellation: 12 }, this.scene);
      d.rotation.x = Math.PI / 2; const s = 2 + r() * 5;
      d.scaling.set(s, s * (0.6 + r() * 0.4), 1);
      d.position.set(x, 0.03, z); d.material = mm; d.isPickable = false; d.receiveShadows = true;
    }
  }

  /* ---------- coletáveis e NPCs ---------- */
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

  restorePickups(): void { for (const p of this.pickups) { p.taken = false; p.node.setEnabled(true); } }

  nearestNpc(x: number, z: number, radius: number): Npc | undefined {
    let best: Npc | undefined, bd = radius;
    for (const n of this.npcs) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  /** Atualização comum: coletáveis flutuando, NPCs animados/olhando, marcadores do modo de observação, relva. */
  protected updateCommon(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.t += dt;
    this.grass.update(this.t, !toneByPostFx);
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.node.position.y = p.def.y + Math.sin(this.t * 2 + p.def.x) * 0.12;
      p.node.rotation.y += dt * 1.2;
      p.marker.setEnabled(observing);
    }
    for (const n of this.npcs) {
      n.model.animate(dt);
      const dx = playerPos.x - n.x, dz = playerPos.z - n.z;
      if (Math.hypot(dx, dz) < 14) {
        const want = Math.atan2(dx, dz);
        let diff = want - n.model.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        n.model.root.rotation.y += diff * Math.min(1, dt * 2);
      }
      n.marker.setEnabled(observing);
    }
    for (const m of this.markers) if (m.material) (m.material as StandardMaterial).alpha = 0.22 + 0.12 * Math.sin(this.t * 3);
  }
}
