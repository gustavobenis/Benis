import type { CheckpointDef, LeafDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 8 — Juntos Sempre (O Vale do Novo Amanhecer). */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const BOARD = { x: 0, z: 62, r: 7 };
export const SUNRISE = { id: 'sunrise', x: 0, z: 84, r: 7 };
export const STONES: StoneDef[] = [
  { x: -40, z: -76, r: 2.8, h: 1.6 }, { x: 40, z: -70, r: 3, h: 1.7 }, { x: -44, z: -30, r: 3.2, h: 1.9 }, { x: 44, z: 0, r: 3, h: 1.8 },
  { x: -42, z: 40, r: 2.8, h: 1.6 }, { x: 42, z: 56, r: 3.2, h: 1.9 },
];
export const LEAVES: LeafDef[] = [
  { x: 10, z: -76, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.4 }, { x: -26, z: -20, y: 3.8, hx: 3.4, hz: 4.4, yaw: -0.4 }, { x: 30, z: 20, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.2 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -34, z: -88, stem: 2.6, capR: 3.6, stemR: 0.9, glow: [1, 0.7, 0.5] }, { x: 36, z: -90, stem: 3, capR: 4.2, stemR: 1, glow: [1, 0.6, 0.6] },
  { x: 40, z: -34, stem: 2.8, capR: 4, stemR: 1, glow: [1, 0.75, 0.45] }, { x: -40, z: 10, stem: 3, capR: 4.2, stemR: 1, glow: [1, 0.65, 0.55] },
  { x: 38, z: 34, stem: 2.6, capR: 3.8, stemR: 1, glow: [1, 0.7, 0.5] }, { x: -36, z: 70, stem: 2.8, capR: 4, stemR: 1, glow: [1, 0.6, 0.55] },
];
/** Grupos de amigos reunidos pelo vale (cada um tem uma foto ao lado). */
export const NPCS: NpcDef[] = [
  { id: 'rita', kind: 'dragonfly', name: 'Rita', x: 8, z: -82, yaw: -2.4 },
  { id: 'tico', kind: 'grasshopper', name: 'Tico', x: -20, z: -50, yaw: 0.8 }, { id: 'lino', kind: 'ant', name: 'Lino', x: -14, z: -48, yaw: 2.4 },
  { id: 'luna', kind: 'butterfly', name: 'Luna', x: 16, z: -14, yaw: -0.8 }, { id: 'olivia', kind: 'spider', name: 'Dona Olívia', x: 22, z: -10, yaw: 2.2 },
  { id: 'zuzu', kind: 'caterpillar', name: 'Zuzu', x: -22, z: 18, yaw: 0.6 }, { id: 'freddy', kind: 'cricket', name: 'Freddy', x: -15, z: 20, yaw: 2.6 },
  { id: 'caramujo', kind: 'snail', name: 'Sr. Caramujo', x: 18, z: 46, yaw: -0.7, scale: 1.9 }, { id: 'dario', kind: 'rival', name: 'Dário', x: 24, z: 42, yaw: 2.2 },
  { id: 'beto', kind: 'beetle', name: 'Beto', x: 4, z: 88, yaw: 3.14 },
];
export const PICKUPS: PickupDef[] = [
  { id: 'photo1', kind: 'photo', x: -14, y: 1.2, z: -54 }, { id: 'photo2', kind: 'photo', x: 19, y: 1.2, z: -17 },
  { id: 'photo3', kind: 'photo', x: -18, y: 1.2, z: 15 }, { id: 'photo4', kind: 'photo', x: 21, y: 1.2, z: 40 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -70 }, { id: 'dew2', kind: 'dew', x: -10, y: 1, z: -34 }, { id: 'dew3', kind: 'dew', x: 8, y: 1, z: 0 },
  { id: 'dew4', kind: 'dew', x: -8, y: 1, z: 34 }, { id: 'dew5', kind: 'dew', x: 10, y: 1, z: 70 },
  { id: 'seed1', kind: 'seed', x: 46, y: 1, z: -50 }, { id: 'crystal1', kind: 'crystal', x: -46, y: 1.5, z: 24 }, { id: 'crystal2', kind: 'crystal', x: 46, y: 1.5, z: 70 },
  { id: 'flower1', kind: 'flower', x: -44, y: 1.2, z: -8 }, { id: 'flower2', kind: 'flower', x: 44, y: 1.2, z: 20 }, { id: 'leaf1', kind: 'leaf', x: 30, y: 4.8, z: 20 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -56, r: 6 }, { id: 'cp2', x: 0, z: -20, r: 6 }, { id: 'cp3', x: 0, z: 14, r: 6 }, { id: 'cp4', x: 0, z: 48, r: 6 }, { id: 'cp5', x: 0, z: 72, r: 6 },
];
