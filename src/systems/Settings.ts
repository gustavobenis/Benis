export type QualityPref = 'auto' | 'eco' | 'balanced' | 'high';
export type Difficulty = 'calm' | 'balanced' | 'explorer';

export interface Settings {
  master: number; music: number; ambient: number; sfx: number; dialog: number;
  sensitivity: number; cameraDistance: number; invertY: boolean;
  uiScale: number; quality: QualityPref; difficulty: Difficulty;
  reduceMotion: boolean; visualAssist: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.6, ambient: 0.8, sfx: 0.8, dialog: 0.8,
  sensitivity: 1, cameraDistance: 1, invertY: false,
  uiScale: 1, quality: 'auto', difficulty: 'balanced',
  reduceMotion: false, visualAssist: false,
};

/** Garante tipos e limites válidos (dados salvos podem estar corrompidos ou antigos). */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const num = (k: keyof Settings, lo: number, hi: number) => {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) (out[k] as number) = Math.min(hi, Math.max(lo, v));
  };
  for (const k of ['master', 'music', 'ambient', 'sfx', 'dialog'] as const) num(k, 0, 1);
  num('sensitivity', 0.3, 2.5); num('cameraDistance', 0.6, 1.8); num('uiScale', 0.8, 1.4);
  for (const k of ['invertY', 'reduceMotion', 'visualAssist'] as const) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  if (['auto', 'eco', 'balanced', 'high'].includes(r.quality as string)) out.quality = r.quality as QualityPref;
  if (['calm', 'balanced', 'explorer'].includes(r.difficulty as string)) out.difficulty = r.difficulty as Difficulty;
  return out;
}
