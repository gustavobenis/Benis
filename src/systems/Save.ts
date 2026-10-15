import type { QuestState } from './Quests';
import { sanitizeSettings, type Settings } from './Settings';

export interface SaveData {
  version: 1;
  savedAt: number;
  level: number;
  checkpoint: { x: number; y: number; z: number; id: string };
  quests: Record<string, QuestState>;
  inventory: Record<string, number>;
  collected: string[];
  flags: string[];
  playTime: number;
}

const DB_NAME = 'marieta';
const STORE = 'kv';
const LS_PREFIX = 'marieta:';

/** Armazenamento chave-valor: IndexedDB com fallback para localStorage (modo privado, etc.). */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

class IdbKV implements KV {
  private db: Promise<IDBDatabase>;
  constructor() {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  get(key: string) { return this.tx('readonly', (s) => s.get(key)); }
  async set(key: string, value: unknown) { await this.tx('readwrite', (s) => s.put(value, key)); }
  async del(key: string) { await this.tx('readwrite', (s) => s.delete(key)); }
}

class LsKV implements KV {
  async get(key: string) { try { const v = localStorage.getItem(LS_PREFIX + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
  async set(key: string, value: unknown) { try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch (e) { console.warn('[save] localStorage indisponível', e); } }
  async del(key: string) { try { localStorage.removeItem(LS_PREFIX + key); } catch { /* ignore */ } }
}

export class MemoryKV implements KV {
  private m = new Map<string, unknown>();
  async get(k: string) { return this.m.get(k); }
  async set(k: string, v: unknown) { this.m.set(k, structuredClone(v)); }
  async del(k: string) { this.m.delete(k); }
}

export function isValidSave(d: unknown): d is SaveData {
  if (!d || typeof d !== 'object') return false;
  const s = d as SaveData;
  return s.version === 1 && typeof s.level === 'number' && !!s.checkpoint && Number.isFinite(s.checkpoint.x) && Number.isFinite(s.checkpoint.z)
    && Number.isFinite(s.checkpoint.y) && !!s.quests && typeof s.quests === 'object' && Array.isArray(s.collected) && Array.isArray(s.flags);
}

export class SaveManager {
  private kv: KV;
  constructor(kv?: KV) {
    if (kv) this.kv = kv;
    else {
      try { this.kv = typeof indexedDB !== 'undefined' ? new IdbKV() : new LsKV(); } catch { this.kv = new LsKV(); }
    }
  }
  /** Tenta IndexedDB; se falhar em runtime, cai para localStorage. */
  private async safe<T>(fn: (kv: KV) => Promise<T>): Promise<T> {
    try { return await fn(this.kv); } catch (e) {
      console.warn('[save] IndexedDB falhou, usando localStorage', e);
      this.kv = new LsKV();
      return fn(this.kv);
    }
  }
  async saveGame(d: SaveData): Promise<void> { await this.safe((kv) => kv.set('save', d)); }
  async loadGame(): Promise<SaveData | null> {
    const d = await this.safe((kv) => kv.get('save'));
    return isValidSave(d) ? d : null;
  }
  async deleteGame(): Promise<void> { await this.safe((kv) => kv.del('save')); }
  /** Progresso global (independe do jogo salvo): fases liberadas. */
  async loadMeta(): Promise<{ unlocked: number }> {
    const m = (await this.safe((kv) => kv.get('meta'))) as { unlocked?: unknown } | undefined;
    const u = typeof m?.unlocked === 'number' && Number.isFinite(m.unlocked) ? Math.max(1, Math.floor(m.unlocked)) : 1;
    return { unlocked: u };
  }
  async saveMeta(m: { unlocked: number }): Promise<void> { await this.safe((kv) => kv.set('meta', m)); }
  async saveSettings(s: Settings): Promise<void> { await this.safe((kv) => kv.set('settings', s)); }
  async loadSettings(): Promise<Settings> { return sanitizeSettings(await this.safe((kv) => kv.get('settings'))); }
}
