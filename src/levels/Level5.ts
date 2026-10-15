import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { Grass } from './Grass';
import { rng } from './Materials';
import { LevelBase, type Interaction, type LevelHost, type LevelInfo, type MapData } from './LevelBase';
import type { Shape } from '../physics/CollisionWorld';
import { LEVEL5_QUESTS } from '../data/quests';
import { pickStormDialogue } from '../data/dialogues';
import * as D from './level5Data';

const STRIKE_DELAY = 1.7;
const STRIKE_RADIUS = 3.4;

/** Fase 5 — A Tempestade (Grande Prova): chuva, vento, raios avisados, enchente e Beto ao lado de Marieta. */
export class Level5 extends LevelBase {
  readonly info: LevelInfo = {
    id: 5, title: 'A Tempestade', subtitle: 'Grande Prova',
    start: { x: D.START.x, z: D.START.z },
    quests: LEVEL5_QUESTS, mainQuest: 'tempestade',
    totals: { leaf: 3, dew: D.PICKUPS.filter((p) => p.kind === 'dew').length, seed: 2, crystal: 2, flower: 2, photo: 1 },
    fog: { color: [0.24, 0.28, 0.34], density: 0.0165 },
    // Tempestade: luz fria e fraca, cores dessaturadas, sombras azuladas
    light: { dir: [-0.3, -0.6, 0.3], sun: [0.6, 0.7, 0.9], sunI: 1.5, sky: [0.35, 0.42, 0.55], ground: [0.1, 0.12, 0.15], hemiI: 0.55, exposure: 1.02, contrast: 1.25, saturation: -6, shadowHue: 215 },
    weather: { rain: 1, wind: 3 },
    shafts: [],
    springs: [[0, 0.5, 22], [-30, 0.5, 22], [30, 0.5, 22]],
    pickDialogue: (npc, q) => pickStormDialogue(npc, q),
    birdActive: () => false, // o perigo da tempestade são os raios e o vento
    interactPoints: { raft: { x: D.RAFT_SITE.x, z: D.RAFT_SITE.z } },
  };
  readonly map: MapData = {
    bounds: D.BOUNDS, leaves: D.LEAVES, mushrooms: D.MUSHROOMS, stones: [...D.STONES, ...D.FLOOD_STONES], puddles: [], waters: [D.FLOOD], goal: { x: D.HILL.x, z: D.HILL.z },
    dynamic: () => (this.raftBuilt ? [{ x1: D.RAFT.x, z1: D.RAFT.z - D.RAFT.hz, x2: D.RAFT.x, z2: D.RAFT.z + D.RAFT.hz, color: '#e9b95d' }] : []),
  };
  raftBuilt = false; joined = false;
  private raftMesh!: Mesh; private raftShape: Shape | null = null; private raftAnim = -1; private siteMarker!: Mesh;
  private water!: StandardMaterial;
  private strikes: { x: number; z: number; t: number; mesh: Mesh }[] = [];
  private bolt!: Mesh; private boltT = 0;
  private nextStrike = 5; private nextGust = 6; private gustT = 0; private gustDir = { x: 1, z: 0 };
  private hazard: string | null = null;

  constructor(scene: Scene, grassMax: number) {
    super(scene);
    this.world.bounds = D.BOUNDS;
    this.world.waters.push(D.FLOOD);
    this.buildGround(D.BOUNDS[1] - D.BOUNDS[0] + 80, D.BOUNDS[3] - D.BOUNDS[2] + 80);
    this.buildFlood();
    D.STONES.forEach((s) => this.addStone(s));
    D.FLOOD_STONES.forEach((s) => this.addStone(s));
    D.LEAVES.forEach((l, i) => this.addLeafPlatform(l, i));
    D.MUSHROOMS.forEach((m) => this.addMushroom(m));
    D.LOGS.forEach((l) => this.addLog(l));
    this.buildRaft();
    this.buildPickups(D.PICKUPS);
    this.buildNpcs(D.NPCS);
    // Beto acompanha Marieta: sem colisor fixo
    const bi = this.world.shapes.findIndex((s) => s.kind === 'cyl' && s.x === D.NPCS[0].x && s.z === D.NPCS[0].z);
    if (bi >= 0) this.world.shapes.splice(bi, 1);
    this.buildFlowersAndMoss(53, D.BOUNDS, 40);
    this.addCheckpoints(D.CHECKPOINTS);
    this.world.zones.push({ id: D.HILL.id, x: D.HILL.x, z: D.HILL.z, r: D.HILL.r, type: 'goal' });
    this.siteMarker = this.makeBeacon(D.RAFT_SITE.x, D.RAFT_SITE.z, 0, 9, new Color3(1, 0.85, 0.4)); this.markers.push(this.siteMarker);
    this.buildStrikeMarkers();
    this.grass = new Grass(scene, this.world, {
      max: grassMax, bounds: D.BOUNDS, wallZ: 9999,
      avoid: (x, z) => !!this.world.waterAt(x, z) || (z > D.FLOOD.minZ - 2 && z < D.FLOOD.maxZ + 2 && Math.abs(x) < 7),
      safe: [{ x: D.START.x, z: D.START.z, r: 9 }, ...D.NPCS.map((n) => ({ x: n.x, z: n.z, r: 6 }))],
    });
    this.finishBuild();
  }

  private buildFlood(): void {
    const w = D.FLOOD.maxX - D.FLOOD.minX, h = D.FLOOD.maxZ - D.FLOOD.minZ;
    const plane = MeshBuilder.CreateGround('flood', { width: w, height: h }, this.scene);
    plane.position.set(0, 0.16, (D.FLOOD.minZ + D.FLOOD.maxZ) / 2); plane.isPickable = false;
    const bump = new DynamicTexture('fb', { width: 256, height: 256 }, this.scene, true);
    const c = bump.getContext() as CanvasRenderingContext2D; const r = rng(9);
    c.fillStyle = '#808080'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) { c.strokeStyle = `rgba(${r() > 0.5 ? 255 : 30},${r() > 0.5 ? 255 : 30},255,0.3)`; c.lineWidth = 1 + r() * 4; c.beginPath(); const y = r() * 256; c.moveTo(0, y); c.bezierCurveTo(70, y + (r() - 0.5) * 50, 180, y - (r() - 0.5) * 50, 256, y); c.stroke(); }
    bump.update(); bump.wrapU = bump.wrapV = Texture.WRAP_ADDRESSMODE; bump.uScale = w / 12; bump.vScale = h / 12;
    const m = new StandardMaterial('floodM', this.scene);
    m.diffuseColor = new Color3(0.14, 0.24, 0.28); m.emissiveColor = new Color3(0.02, 0.05, 0.07);
    m.specularColor = new Color3(0.7, 0.8, 0.9); m.specularPower = 90; m.alpha = 0.86; m.bumpTexture = bump; bump.level = 0.6;
    plane.material = m; this.water = m;
  }

  private buildRaft(): void {
    const b = D.RAFT;
    this.raftMesh = this.makeLeaf('raft', b.hx + 0.6, b.hz + 0.6, 1, 0.03);
    this.raftMesh.position.set(b.x, b.y - 0.04, b.z); this.raftMesh.setEnabled(false);
  }

  /** Círculos de aviso dos raios (reaproveitados) e o clarão do raio. */
  private buildStrikeMarkers(): void {
    const tex = new DynamicTexture('ring', { width: 128, height: 128 }, this.scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createRadialGradient(64, 64, 20, 64, 64, 62); g.addColorStop(0, 'rgba(255,200,80,0.05)'); g.addColorStop(0.8, 'rgba(255,170,40,0.45)'); g.addColorStop(0.95, 'rgba(255,240,160,1)'); g.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); tex.update(); tex.hasAlpha = true;
    const mat = new StandardMaterial('ringM', this.scene);
    mat.diffuseTexture = tex; mat.useAlphaFromDiffuseTexture = true; mat.emissiveColor = new Color3(1, 0.75, 0.25); mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false;
    for (let i = 0; i < 4; i++) {
      const d = MeshBuilder.CreateDisc('strike', { radius: STRIKE_RADIUS, tessellation: 40 }, this.scene);
      d.rotation.x = Math.PI / 2; d.material = mat; d.isPickable = false; d.setEnabled(false);
      this.strikes.push({ x: 0, z: 0, t: -1, mesh: d });
    }
    const bolt = MeshBuilder.CreateCylinder('bolt', { height: 60, diameterTop: 0.3, diameterBottom: 1.4, tessellation: 6 }, this.scene);
    const bm = new StandardMaterial('boltM', this.scene); bm.emissiveColor = new Color3(0.9, 0.95, 1); bm.disableLighting = true; bm.fogEnabled = false; bolt.material = bm;
    bolt.isPickable = false; bolt.setEnabled(false); this.bolt = bolt;
  }

  /* ---------- clima ativo ---------- */
  /** Marca o chão e, depois de STRIKE_DELAY, cai o raio. Público para testes. */
  strike(x: number, z: number): void {
    const s = this.strikes.find((k) => k.t < 0); if (!s) return;
    s.x = x; s.z = z; s.t = STRIKE_DELAY; s.mesh.position.set(x, 0.12, z); s.mesh.setEnabled(true);
  }
  /** Rajada de vento na direção (dx,dz). Público para testes. */
  gust(dx: number, dz: number): void {
    const l = Math.hypot(dx, dz) || 1; this.gustDir = { x: dx / l, z: dz / l }; this.gustT = 2.6; this.events.push('gust');
  }

  private scheduleWeather(dt: number, p: Vector3): void {
    const calm = this.difficulty === 'calm', fast = this.difficulty === 'explorer';
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) {
      const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 9;
      const x = Math.max(D.BOUNDS[0] + 4, Math.min(D.BOUNDS[1] - 4, p.x + Math.sin(a) * d)), z = Math.max(D.BOUNDS[2] + 4, Math.min(D.BOUNDS[3] - 4, p.z + Math.cos(a) * d));
      if (!this.world.waterAt(x, z)) this.strike(x, z);
      this.nextStrike = (calm ? 12 : fast ? 4.5 : 7) + Math.random() * 3;
    }
    this.nextGust -= dt;
    if (this.nextGust <= 0) {
      const a = Math.random() * Math.PI * 2; this.gust(Math.sin(a), Math.cos(a));
      this.nextGust = (calm ? 16 : 10) + Math.random() * 4;
    }
  }

  /* ---------- estado ---------- */
  buildRaftNow(instant = false): void {
    if (this.raftBuilt) return;
    this.raftBuilt = true;
    const b = D.RAFT;
    this.raftShape = this.addShape({ kind: 'box', x: b.x, z: b.z, hx: b.hx, hz: b.hz, yBase: 0.1, yTop: b.y, yaw: 0, surface: 'leaf' });
    this.raftMesh.setEnabled(true); this.siteMarker.setEnabled(false);
    this.raftAnim = instant ? 1 : 0;
    if (instant) { this.raftMesh.scaling.z = 1; this.raftMesh.position.z = b.z; }
  }
  private removeRaft(): void {
    if (!this.raftBuilt) return;
    this.raftBuilt = false; this.raftAnim = -1;
    if (this.raftShape) this.world.shapes.splice(this.world.shapes.indexOf(this.raftShape), 1);
    this.raftShape = null; this.raftMesh.setEnabled(false);
  }
  applyFlags(flags: Set<string>): void { if (flags.has('raft')) this.buildRaftNow(true); if (flags.has('betoJoined')) this.joined = true; }
  resetState(): void {
    this.restorePickups(); this.removeRaft(); this.joined = false; this.hazard = null; this.wind = { x: 0, z: 0 }; this.gustT = 0;
    for (const s of this.strikes) { s.t = -1; s.mesh.setEnabled(false); }
    const b = this.npcs.find((n) => n.id === 'beto'); if (b) { b.x = D.NPCS[0].x; b.z = D.NPCS[0].z; }
    this.nextStrike = 5; this.nextGust = 6;
  }
  talked(npc: string): void { if (npc === 'beto') this.joined = true; }

  takeHazard(): string | null { const h = this.hazard; this.hazard = null; return h; }

  interaction(x: number, z: number, host: LevelHost): Interaction | undefined {
    if (this.raftBuilt || Math.hypot(x - D.RAFT_SITE.x, z - D.RAFT_SITE.z) > D.RAFT_SITE.r) return undefined;
    const n = host.inventory.count('leaf');
    return {
      prompt: `(${Math.min(n, 3)}/3 folhas) Construir a jangada com Beto`,
      run: () => {
        if (host.quests.currentObjective('tempestade')?.id === 'beto') { host.toast('Converse com Beto primeiro.'); return; }
        if (n < 3) { host.toast(`Faltam ${3 - n} folhas firmes para a jangada.`, 3200); host.audio.warn(); return; }
        host.inventory.remove('leaf', 3); this.buildRaftNow(); host.flags.add('raft');
        host.quests.handle({ type: 'interact', target: 'raft' }); host.audio.collect(); host.audio.interact();
        host.toast('Marieta e Beto constroem a jangada juntos! 🍃', 3200); host.changed();
      },
    };
  }

  update(dt: number, playerPos: Vector3, observing: boolean, toneByPostFx: boolean): void {
    this.updateCommon(dt, playerPos, observing, toneByPostFx);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.active) this.scheduleWeather(dt, playerPos);
    // Vento: empurra por um curto período, com queda suave
    this.gustT = Math.max(0, this.gustT - dt);
    const k = Math.min(1, this.gustT / 0.5) * 7.5;
    this.wind = { x: this.gustDir.x * k, z: this.gustDir.z * k };
    // Raios: círculo de aviso pulsando; ao fim, clarão, trovão e dano a quem ficou dentro
    for (const s of this.strikes) {
      if (s.t < 0) continue;
      s.t -= dt;
      s.mesh.scaling.setAll(1 + 0.08 * Math.sin(this.t * 14)); (s.mesh.material as StandardMaterial).alpha = 0.6 + 0.4 * Math.sin(this.t * 12);
      if (s.t <= 0) {
        s.t = -1; s.mesh.setEnabled(false);
        this.flash = 1; this.events.push('thunder'); this.bolt.position.set(s.x, 30, s.z); this.bolt.setEnabled(true); this.boltT = 0.18;
        if (this.active && this.difficulty !== 'calm' && Math.hypot(playerPos.x - s.x, playerPos.z - s.z) < STRIKE_RADIUS) this.hazard = 'Um raio caiu perto de Marieta!';
      }
    }
    if (this.boltT > 0 && (this.boltT -= dt) <= 0) this.bolt.setEnabled(false);
    // Água agitada
    const bump = this.water.bumpTexture as Texture; bump.uOffset += dt * 0.05; bump.vOffset += dt * 0.01;
    // Beto acompanha Marieta
    const beto = this.npcs.find((n) => n.id === 'beto');
    if (beto) beto.companion = this.joined;
    if (beto && this.joined) {
      const dx = playerPos.x - beto.x, dz = playerPos.z - beto.z, d = Math.hypot(dx, dz);
      if (d > 40) { beto.x = playerPos.x - 3; beto.z = playerPos.z - 3; }
      else if (d > 3.6) {
        const nx = beto.x + (dx / d) * Math.min(d - 3.2, 9 * dt), nz = beto.z + (dz / d) * Math.min(d - 3.2, 9 * dt);
        if (!this.world.waterAt(nx, nz)) { beto.x = nx; beto.z = nz; }
      }
      const gy = this.world.groundAt(beto.x, beto.z, 1, 0.5).y;
      beto.model.root.position.set(beto.x, gy, beto.z);
      beto.marker.position.set(beto.x, beto.marker.position.y, beto.z);
    }
    this.siteMarker.setEnabled(observing && !this.raftBuilt);
    if (this.raftAnim >= 0 && this.raftAnim < 1) {
      this.raftAnim = Math.min(1, this.raftAnim + dt / 1.6);
      const kk = this.raftAnim, b = D.RAFT;
      this.raftMesh.scaling.z = Math.max(0.02, kk); this.raftMesh.position.z = (b.z - b.hz) + b.hz * kk;
    }
  }
}
