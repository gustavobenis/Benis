import { Vector3 } from '@babylonjs/core';
import type { FreeCamera } from '@babylonjs/core';
import type { Body } from '../physics/CollisionWorld';
import type { Environment, LightPreset } from '../levels/Environment';
import type { LevelBase } from '../levels/LevelBase';
import type { MarietaModel } from '../player/Marieta';
import type { GameAudio } from '../engine/Audio';

/** Tempo total do trailer, em segundos. */
export const TRAILER_LENGTH = 46;

const STORM: LightPreset = { dir: [-0.3, -0.6, 0.3], sun: [0.6, 0.7, 0.9], sunI: 1.5, sky: [0.35, 0.42, 0.55], ground: [0.1, 0.12, 0.15], hemiI: 0.55, exposure: 1.02, contrast: 1.25, saturation: -6, shadowHue: 215 };
const STORM_FOG = { color: [0.24, 0.28, 0.34] as [number, number, number], density: 0.0165 };
const GOLD: LightPreset = { dir: [-0.88, -0.2, 0.32], sun: [1, 0.72, 0.42], sunI: 3.7, sky: [1, 0.76, 0.62], ground: [0.36, 0.26, 0.16], hemiI: 0.72, exposure: 1.2, contrast: 1.15, saturation: 20, shadowHue: 300 };
const GOLD_FOG = { color: [0.8, 0.58, 0.48] as [number, number, number], density: 0.0105 };

/** Quadros do roteiro: legenda exibida e instante em que começa. */
export const TRAILER_CAPTIONS: { t: number; text: string }[] = [
  { t: 0.8, text: 'Num jardim cheio de orvalho…' },
  { t: 6.4, text: '…vivia Marieta, uma joaninha pequena com um coração gigante.' },
  { t: 12.6, text: 'Até que o céu escureceu.' },
  { t: 18.4, text: 'Um vendaval a levou para longe de casa…' },
  { t: 25.4, text: 'Perdida na mata, ela encontrou amigos: Tito, o caracol sábio…' },
  { t: 32.4, text: '…e descobriu que asas pequenas também atravessam o mundo.' },
];

export interface TrailerHost {
  camera: FreeCamera; model: MarietaModel; level: LevelBase; env: Environment; audio: GameAudio; body: Body;
  caption(text: string | null): void;
  title(on: boolean): void;
  setHeading(h: number): void;
  done(): void;
}

/**
 * Trailer de abertura: cinemática roteirizada em tempo real sobre o cenário da Fase 1
 * (amanhecer → tempestade → Marieta levada pelo vento → Tito → voo ao pôr do sol → título).
 */
export class Trailer {
  t = 0;
  /** Pose de voo para o modelo (lida por quem anima). */
  pose = { flying: false, speed: 0, bank: 0, pitch: 0, climb: 0 };
  private shot = -1;
  private cap = -1;
  private p = new Vector3(); private h = 0; private spd = 0;
  private start: Vector3;
  private tito: Vector3;
  private finished = false;
  private flashAt = [13.0, 15.4, 17.2, 19.0];
  private flashDone = new Set<number>();
  /** Intensidade do clarão de relâmpago (0..1) para o ambiente. */
  flash = 0;

  constructor(private H: TrailerHost) {
    const st = H.level.info.start;
    this.start = new Vector3(st.x, 0, st.z);
    const n = H.level.npcs[0];
    this.tito = n ? new Vector3(n.x, 0, n.z) : this.start.add(new Vector3(8, 0, 12));
    this.p.copyFrom(this.start); this.h = 0;
    H.level.grass.setWind(1);
  }

  private cam(pos: Vector3, target: Vector3, fov: number): void {
    this.H.camera.position.copyFrom(pos); this.H.camera.setTarget(target); this.H.camera.fov = fov;
  }

  private enter(i: number): void {
    const { env, level, audio } = this.H;
    const info = level.info; const sc = this.H.camera.getScene();
    if (i === 2) { // tempestade
      env.setLighting(STORM); env.setAtmosphere(STORM_FOG.color, STORM_FOG.density); level.grass.setWind(3.2); env.setRain(1); audio.setRain(1);
      level.grass.setFog(sc.fogColor, sc.fogDensity);
    } else if (i === 4) { // pouso perto do Tito, tempo abrindo
      env.setRain(0); audio.setRain(0); level.grass.setWind(1);
      env.setLighting(info.light); env.setAtmosphere(info.fog.color, info.fog.density); level.grass.setFog(sc.fogColor, sc.fogDensity);
      this.p.set(this.tito.x + 2.2, 0, this.tito.z - 3.2); this.h = Math.atan2(this.tito.x - this.p.x, this.tito.z - this.p.z); this.spd = 0;
      this.pose.flying = false;
    } else if (i === 5) { // pôr do sol dourado, voo livre
      env.setLighting(GOLD); env.setAtmosphere(GOLD_FOG.color, GOLD_FOG.density); level.grass.setFog(sc.fogColor, sc.fogDensity);
      this.p.set(this.start.x - 8, 5.5, this.start.z + 30); this.h = 0.35; this.spd = 9; this.pose.flying = true;
    }
  }

  /** Avança o trailer `dt` segundos. Posiciona câmera e Marieta. */
  update(dt: number): void {
    this.t += dt;
    const t = this.t, H = this.H, b = H.body;
    // legendas
    let ci = -1; TRAILER_CAPTIONS.forEach((c, i) => { if (t >= c.t) ci = i; });
    if (ci !== this.cap) { this.cap = ci; H.caption(ci >= 0 ? TRAILER_CAPTIONS[ci].text : null); }
    if (t > 40 && this.cap !== -2) { this.cap = -2; H.caption(null); H.title(true); }
    const shot = t < 6 ? 0 : t < 12 ? 1 : t < 18 ? 2 : t < 25 ? 3 : t < 32 ? 4 : t < 39 ? 5 : 6;
    while (this.shot < shot) { this.shot++; this.enter(this.shot); }

    const S = this.start;
    const pose = this.pose;
    this.flash = 0;
    for (const [i, at] of this.flashAt.entries()) {
      if (t >= at && t < at + 0.5) { this.flash = Math.max(this.flash, 1 - (t - at) / 0.5); if (!this.flashDone.has(i)) { this.flashDone.add(i); H.audio.thunder(); } }
    }

    if (shot === 0) { // dolly baixo ao nível da grama
      const u = t / 6, a = 0.7 - u * 0.5, r = 5.2 - u * 1.4;
      this.p.copyFrom(S); this.h = 0.4;
      this.cam(new Vector3(S.x + Math.sin(a) * r, 0.55 + u * 0.35, S.z + Math.cos(a) * r), new Vector3(S.x, 0.65, S.z), 0.9);
    } else if (shot === 1) { // closeup girando
      const u = (t - 6) / 6, a = 0.2 - u * 1.2, r = 3.0 - u * 0.5;
      this.h = 0.4 + Math.sin(u * 3) * 0.3;
      this.cam(new Vector3(S.x + Math.sin(a) * r + 0.0, 0.8 + u * 0.15, S.z + Math.cos(a) * r), new Vector3(S.x, 0.75, S.z), 0.75);
    } else if (shot === 2) { // vento a levanta
      const u = Math.max(0, t - 14.4);
      if (u > 0) {
        pose.flying = true; this.spd = Math.min(9, this.spd + dt * 3.5); this.h = 0.93;
        this.p.x += Math.sin(this.h) * this.spd * dt * 0.7; this.p.z += Math.cos(this.h) * this.spd * dt * 0.7; this.p.y = 0.1 + 6 * (1 - Math.exp(-u * u * 0.35));
      } else this.p.copyFrom(S);
      const look = new Vector3(this.p.x, 0.8 + Math.min(5, u * 1.6), this.p.z);
      this.cam(new Vector3(S.x - 0.5, 0.45, S.z - 3.4), look, 0.95 + Math.min(0.2, u * 0.05));
    } else if (shot === 3) { // perseguição: levada pelo vento
      const u = t - 18;
      pose.flying = true; this.spd = Math.min(11, this.spd + dt * 2); this.h = 0.93 + Math.sin(u * 0.9) * 0.45;
      this.p.x += Math.sin(this.h) * this.spd * dt; this.p.z += Math.cos(this.h) * this.spd * dt; this.p.y = 6 + Math.sin(u * 1.3) * 1.2;
      const back = 5.5 + u * 0.3;
      this.cam(new Vector3(this.p.x - Math.sin(this.h) * back, this.p.y + 1.6, this.p.z - Math.cos(this.h) * back), new Vector3(this.p.x, this.p.y, this.p.z), 1.05);
    } else if (shot === 4) { // encontro com Tito
      const u = (t - 25) / 7;
      pose.flying = false;
      const mid = new Vector3((this.p.x + this.tito.x) / 2, 1.2, (this.p.z + this.tito.z) / 2);
      const a = -0.9 + u * 0.8, r = 13 - u * 3;
      this.cam(new Vector3(mid.x + Math.sin(a) * r, 1.3 + u * 0.4, mid.z + Math.cos(a) * r), mid, 0.85);
    } else { // voo ao pôr do sol e título
      const u = t - 32;
      pose.flying = true; this.spd = 9 + Math.min(2, u * 0.2); this.h = 0.35 + Math.sin(u * 0.45) * 0.5;
      this.p.x += Math.sin(this.h) * this.spd * dt; this.p.z += Math.cos(this.h) * this.spd * dt; this.p.y = 5.5 + Math.sin(u * 0.8) * 1.0 + u * 0.25;
      const orbit = this.h + Math.PI + (shot === 5 ? 0.7 * Math.sin(u * 0.5) : 0.0);
      const back = shot === 5 ? 6.5 : 6.5 + (t - 39) * 1.4;
      this.cam(new Vector3(this.p.x + Math.sin(orbit) * back, this.p.y + (shot === 5 ? 1.8 : 2.5 + (t - 39) * 0.5), this.p.z + Math.cos(orbit) * back), new Vector3(this.p.x, this.p.y, this.p.z), shot === 5 ? 1.0 : 0.9);
    }

    // aplica à Marieta
    b.x = this.p.x; b.y = this.p.y; b.z = this.p.z; b.vx = b.vy = b.vz = 0;
    H.setHeading(this.h);
    pose.speed = this.spd; pose.bank = shot === 3 ? Math.cos((t - 18) * 0.9) * 0.6 : shot >= 5 ? Math.cos((t - 32) * 0.45) * 0.5 : 0.3; pose.pitch = shot === 2 ? -0.3 : 0.05;
    pose.climb = shot === 2 ? 1 : 0;
    if (!this.finished && t >= TRAILER_LENGTH) { this.finished = true; H.done(); }
  }
}
