import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 6 — O Vale das Flores (Esperança). */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const GATE = { x: 0, z: 62, hx: 4.5, hz: 1.4, h: 22 };
export const GARDEN = { x: 0, z: 48, r: 7 };
export const OVERLOOK = { id: 'overlook', x: 0, z: 80, r: 9 };

/** Flores gigantes: plataformas altas (topo em y = h). Cada uma tem uma corrente de ar ao lado. */
export const GIANT_FLOWERS: { x: number; z: number; h: number; r: number; color: [number, number, number] }[] = [
  { x: -24, z: -58, h: 9, r: 4.5, color: [1, 0.45, 0.7] },
  { x: 24, z: -34, h: 10, r: 4.6, color: [1, 0.8, 0.25] },
  { x: -18, z: -4, h: 9.5, r: 4.5, color: [0.75, 0.5, 1] },
  { x: 22, z: 24, h: 10, r: 4.6, color: [1, 0.55, 0.3] },
];
/** Correntes de ar quente (colunas de pólen dourado), a ~7,5 unidades de cada flor gigante. */
export const UPDRAFTS: { id: string; x: number; z: number; r: number; top: number }[] = [
  { id: 'u1', x: -16.5, z: -58, r: 3.2, top: 14 },
  { id: 'u2', x: 16.5, z: -34, r: 3.2, top: 15 },
  { id: 'u3', x: -10.5, z: -4, r: 3.2, top: 14.5 },
  { id: 'u4', x: 14.5, z: 24, r: 3.2, top: 15 },
  { id: 'u5', x: 0, z: 22, r: 3.2, top: 12 },
];
export const STONES: StoneDef[] = [
  { x: -40, z: -76, r: 2.8, h: 1.6 }, { x: 40, z: -70, r: 3, h: 1.7 }, { x: -44, z: -26, r: 3.2, h: 1.9 }, { x: 44, z: 6, r: 3, h: 1.8 },
  { x: -42, z: 36, r: 2.8, h: 1.6 }, { x: 40, z: 52, r: 3.2, h: 1.9 }, { x: -22, z: 72, r: 2.6, h: 1.5 }, { x: 24, z: 74, r: 2.8, h: 1.7 },
];
export const LEAVES: LeafDef[] = [
  { x: 10, z: -78, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.4 }, { x: -8, z: -40, y: 3.8, hx: 3.4, hz: 4.4, yaw: -0.4 },
  { x: 8, z: 4, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.2 }, { x: -22, z: 44, y: 3.8, hx: 3.4, hz: 4.4, yaw: 0.5 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -34, z: -88, stem: 2.6, capR: 3.6, stemR: 0.9 }, { x: 36, z: -90, stem: 3, capR: 4.2, stemR: 1 }, { x: 40, z: -18, stem: 2.8, capR: 4, stemR: 1 },
  { x: -40, z: 14, stem: 3, capR: 4.2, stemR: 1 }, { x: 34, z: 36, stem: 2.6, capR: 3.8, stemR: 1 }, { x: -36, z: 62, stem: 2.8, capR: 4, stemR: 1 },
];
export const LOGS: LogDef[] = [{ x: -6, z: -70, hx: 1.1, hz: 6, h: 1.4, yaw: 0.3 }, { x: 6, z: -12, hx: 1.1, hz: 6, h: 1.4, yaw: -0.3 }];

export const PICKUPS: PickupDef[] = [
  { id: 'flower1', kind: 'flower', x: -24, y: 10.6, z: -58 }, { id: 'flower2', kind: 'flower', x: 24, y: 11.6, z: -34 },
  { id: 'flower3', kind: 'flower', x: -18, y: 11.1, z: -4 }, { id: 'flower4', kind: 'flower', x: 22, y: 11.6, z: 24 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -72 }, { id: 'dew2', kind: 'dew', x: -10, y: 1, z: -48 }, { id: 'dew3', kind: 'dew', x: 12, y: 1, z: -18 },
  { id: 'dew4', kind: 'dew', x: -30, y: 1, z: 8 }, { id: 'dew5', kind: 'dew', x: 12, y: 1, z: 40 }, { id: 'dew6', kind: 'dew', x: -14, y: 1, z: 66 },
  { id: 'seed1', kind: 'seed', x: 44, y: 1, z: -50 }, { id: 'seed2', kind: 'seed', x: -46, y: 1, z: 80 },
  { id: 'crystal1', kind: 'crystal', x: -46, y: 1.5, z: -44 }, { id: 'crystal2', kind: 'crystal', x: 46, y: 1.5, z: 26 },
  { id: 'leaf1', kind: 'leaf', x: 8, y: 4.8, z: 4 }, { id: 'photo1', kind: 'photo', x: 46, y: 1.1, z: 86 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -56, r: 6 }, { id: 'cp2', x: 0, z: -18, r: 6 }, { id: 'cp3', x: 0, z: 18, r: 6 }, { id: 'cp4', x: 0, z: 44, r: 6 }, { id: 'cp5', x: 0, z: 70, r: 6 },
];
export const NPCS: NpcDef[] = [
  { id: 'rita', kind: 'dragonfly', name: 'Rita', x: 8, z: -82, yaw: -2.4 },
  { id: 'freddy', kind: 'cricket', name: 'Freddy', x: 0, z: 90, yaw: 3.14 },
];
