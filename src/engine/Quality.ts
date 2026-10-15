import type { QualityPref } from '../systems/Settings';

export type QualityLevel = 'eco' | 'balanced' | 'high';

export interface QualityProfile {
  level: QualityLevel;
  /** 1 = resolução nativa; >1 reduz (hardwareScalingLevel). */
  scaling: number;
  shadows: boolean; shadowMap: number;
  grass: number; particles: number;
  postFx: boolean; msaa: number;
}

export const PROFILES: Record<QualityLevel, QualityProfile> = {
  eco: { level: 'eco', scaling: 1.6, shadows: false, shadowMap: 512, grass: 1400, particles: 40, postFx: false, msaa: 0 },
  balanced: { level: 'balanced', scaling: 1.15, shadows: true, shadowMap: 1024, grass: 3200, particles: 110, postFx: true, msaa: 0 },
  high: { level: 'high', scaling: 1, shadows: true, shadowMap: 2048, grass: 5200, particles: 220, postFx: true, msaa: 4 },
};
const ORDER: QualityLevel[] = ['eco', 'balanced', 'high'];

/** Escolha inicial heurística: celulares/tablets começam em "balanced", PCs com GPU boa em "high". */
export function initialLevel(): QualityLevel {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || mem <= 2 || cores <= 4) return coarse && (mem <= 2 || cores <= 4) ? 'eco' : 'balanced';
  return 'high';
}

/** Ajuste automático: mede o FPS médio e sobe/desce de perfil. */
export class AutoQuality {
  private acc = 0; private frames = 0; private lowStreak = 0; private highStreak = 0;
  constructor(public level: QualityLevel, private onChange: (l: QualityLevel) => void) {}

  tick(dt: number): void {
    this.acc += dt; this.frames++;
    if (this.acc < 3) return;
    const fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;
    const i = ORDER.indexOf(this.level);
    if (fps < 27) { this.lowStreak++; this.highStreak = 0; } else if (fps > 57) { this.highStreak++; this.lowStreak = 0; } else { this.lowStreak = this.highStreak = 0; }
    if (this.lowStreak >= 1 && i > 0) { this.level = ORDER[i - 1]; this.lowStreak = 0; this.onChange(this.level); }
    else if (this.highStreak >= 4 && i < ORDER.length - 1) { this.level = ORDER[i + 1]; this.highStreak = 0; this.onChange(this.level); }
  }
}

export function resolveLevel(pref: QualityPref): QualityLevel { return pref === 'auto' ? initialLevel() : pref; }
