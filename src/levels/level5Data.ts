import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 5 — A Tempestade (Grande Prova). A enchente corre de oeste para leste entre z = 8 e z = 36. */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const FLOOD = { minX: -62, maxX: 62, minZ: 8, maxZ: 36, flowX: 5.2, flowZ: 0 };
export const RAFT = { x: 0, z: 22, hx: 2.4, hz: 18.5, y: 0.6 };
export const RAFT_SITE = { x: 0, z: 4.5, r: 7.5 };
export const HILL = { id: 'hill', x: 0, z: 46, r: 7 };

/** Pedras para atravessar a enchente com saltos precisos (rota difícil, a leste). */
export const FLOOD_STONES: StoneDef[] = [
  { x: 26, z: 8, r: 2.3, h: 1.0 }, { x: 30, z: 15, r: 2.3, h: 1.0 }, { x: 25, z: 22, r: 2.4, h: 1.0 }, { x: 31, z: 29, r: 2.3, h: 1.0 }, { x: 26, z: 36, r: 2.3, h: 1.0 },
];
export const STONES: StoneDef[] = [
  { x: -24, z: -80, r: 2.6, h: 1.5 }, { x: 28, z: -78, r: 3, h: 1.7 }, { x: -40, z: -44, r: 3.2, h: 1.9 }, { x: 42, z: -30, r: 3, h: 1.8 },
  { x: -44, z: 60, r: 3, h: 1.7 }, { x: 40, z: 70, r: 3.2, h: 1.9 },
];
/** Folhas grandes: abrigo da chuva e do vento. */
export const LEAVES: LeafDef[] = [
  { x: 10, z: -82, y: 4.6, hx: 3.8, hz: 5, yaw: 0.3 },   // abrigo de Beto
  { x: -16, z: -60, y: 4.2, hx: 3.4, hz: 4.4, yaw: -0.3 }, { x: 16, z: -34, y: 4, hx: 3.4, hz: 4.4, yaw: 0.5 },
  { x: -20, z: -6, y: 4.2, hx: 3.4, hz: 4.4, yaw: 0.2 }, { x: 20, z: 56, y: 4.2, hx: 3.4, hz: 4.4, yaw: -0.4 }, { x: -16, z: 70, y: 4, hx: 3.4, hz: 4.4, yaw: 0.6 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -34, z: -66, stem: 3, capR: 4.4, stemR: 1.1 }, { x: 36, z: -58, stem: 3.4, capR: 4.8, stemR: 1.2 }, { x: -38, z: -14, stem: 2.8, capR: 4, stemR: 1 },
  { x: 40, z: -10, stem: 3.2, capR: 4.6, stemR: 1.1 }, { x: -34, z: 52, stem: 2.6, capR: 3.8, stemR: 1 }, { x: 34, z: 82, stem: 3, capR: 4.4, stemR: 1.1 },
];
export const LOGS: LogDef[] = [{ x: -4, z: -66, hx: 1.1, hz: 6, h: 1.4, yaw: 0.3 }, { x: 8, z: -20, hx: 1.1, hz: 6, h: 1.4, yaw: -0.4 }, { x: -30, z: 80, hx: 1.1, hz: 6, h: 1.4, yaw: 0.5 }];

export const PICKUPS: PickupDef[] = [
  { id: 'leaf1', kind: 'leaf', x: -30, y: 1.1, z: -64 }, { id: 'leaf2', kind: 'leaf', x: 28, y: 1.1, z: -52 }, { id: 'leaf3', kind: 'leaf', x: -24, y: 1.1, z: -30 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -70 }, { id: 'dew2', kind: 'dew', x: -12, y: 1, z: -46 }, { id: 'dew3', kind: 'dew', x: 14, y: 1, z: -14 },
  { id: 'dew4', kind: 'dew', x: -30, y: 1, z: 0 }, { id: 'dew5', kind: 'dew', x: 12, y: 1, z: 60 },
  { id: 'seed1', kind: 'seed', x: 40, y: 1, z: -84 }, { id: 'seed2', kind: 'seed', x: -44, y: 1, z: 78 },
  { id: 'crystal1', kind: 'crystal', x: -46, y: 1.5, z: -60 }, { id: 'crystal2', kind: 'crystal', x: 46, y: 1.5, z: 28 },
  { id: 'flower1', kind: 'flower', x: -44, y: 1.2, z: -20 }, { id: 'flower2', kind: 'flower', x: 44, y: 1.2, z: 54 },
  { id: 'photo1', kind: 'photo', x: 46, y: 1.1, z: -64 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -56, r: 6 }, { id: 'cp2', x: 0, z: -20, r: 6 }, { id: 'cp3', x: 0, z: 3, r: 5 }, { id: 'cp4', x: 0, z: 44, r: 6 },
];
export const NPCS: NpcDef[] = [
  { id: 'beto', kind: 'beetle', name: 'Beto', x: 6, z: -84, yaw: -2.6 },
  { id: 'zuzu', kind: 'caterpillar', name: 'Zuzu', x: 7, z: 56, yaw: -2.4 },
];
