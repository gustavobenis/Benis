import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 7 — O Ninho Verde (Um Novo Lar). */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const NEST = { id: 'nest', x: 0, z: 70, r: 6.5 };
export const WALLS_SITE = { x: 0, z: 42, r: 7 };
export const ROOF_SITE = { x: 0, z: 54, r: 7 };

export const STONES: StoneDef[] = [
  { x: -40, z: -76, r: 2.8, h: 1.6 }, { x: 40, z: -70, r: 3, h: 1.7 }, { x: -44, z: -22, r: 3.2, h: 1.9 }, { x: 44, z: 4, r: 3, h: 1.8 },
  { x: -42, z: 34, r: 2.8, h: 1.6 }, { x: 42, z: 46, r: 3.2, h: 1.9 }, { x: -26, z: 80, r: 2.6, h: 1.5 }, { x: 28, z: 82, r: 2.8, h: 1.7 },
];
export const LEAVES: LeafDef[] = [
  { x: 10, z: -76, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.4 }, { x: -12, z: -40, y: 3.8, hx: 3.4, hz: 4.4, yaw: -0.4 },
  { x: 14, z: -4, y: 3.6, hx: 3.2, hz: 4.2, yaw: 0.2 }, { x: -18, z: 24, y: 3.8, hx: 3.4, hz: 4.4, yaw: 0.5 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -34, z: -88, stem: 2.6, capR: 3.6, stemR: 0.9 }, { x: 36, z: -90, stem: 3, capR: 4.2, stemR: 1 }, { x: 40, z: -22, stem: 2.8, capR: 4, stemR: 1 },
  { x: -40, z: 8, stem: 3, capR: 4.2, stemR: 1 }, { x: 34, z: 28, stem: 2.6, capR: 3.8, stemR: 1 }, { x: -36, z: 56, stem: 2.8, capR: 4, stemR: 1 },
];
export const LOGS: LogDef[] = [{ x: -6, z: -64, hx: 1.1, hz: 6, h: 1.4, yaw: 0.3 }, { x: 8, z: 14, hx: 1.1, hz: 6, h: 1.4, yaw: -0.3 }, { x: -10, z: 62, hx: 1.1, hz: 6, h: 1.4, yaw: 0.4 }];
export const TRAILS: [number, number][][] = [[[-40, -50], [40, -52]], [[38, 18], [-38, 16]], [[-30, 48], [30, 50]]];

export const PICKUPS: PickupDef[] = [
  { id: 'leaf1', kind: 'leaf', x: -30, y: 1.1, z: -60 }, { id: 'leaf2', kind: 'leaf', x: 26, y: 1.1, z: -46 }, { id: 'leaf3', kind: 'leaf', x: -22, y: 1.1, z: -22 },
  { id: 'leaf4', kind: 'leaf', x: 30, y: 1.1, z: -4 }, { id: 'leaf5', kind: 'leaf', x: -34, y: 1.1, z: 12 }, { id: 'leaf6', kind: 'leaf', x: 24, y: 1.1, z: 24 },
  { id: 'leaf7', kind: 'leaf', x: -18, y: 4.9, z: 24 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -70 }, { id: 'dew2', kind: 'dew', x: -14, y: 1, z: -46 }, { id: 'dew3', kind: 'dew', x: 12, y: 1, z: -16 },
  { id: 'dew4', kind: 'dew', x: -28, y: 1, z: 2 }, { id: 'dew5', kind: 'dew', x: 14, y: 1, z: 36 },
  { id: 'seed1', kind: 'seed', x: 44, y: 1, z: -48 }, { id: 'seed2', kind: 'seed', x: -46, y: 1, z: -50 }, { id: 'seed3', kind: 'seed', x: 46, y: 1, z: 66 },
  { id: 'crystal1', kind: 'crystal', x: -46, y: 1.5, z: 20 }, { id: 'crystal2', kind: 'crystal', x: 46, y: 1.5, z: -26 },
  { id: 'flower1', kind: 'flower', x: -44, y: 1.2, z: -2 }, { id: 'flower2', kind: 'flower', x: 44, y: 1.2, z: 82 }, { id: 'photo1', kind: 'photo', x: -46, y: 1.1, z: 74 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -56, r: 6 }, { id: 'cp2', x: 0, z: -18, r: 6 }, { id: 'cp3', x: 0, z: 20, r: 6 }, { id: 'cp4', x: 0, z: 36, r: 5 }, { id: 'cp5', x: 0, z: 62, r: 5 },
];
export const NPCS: NpcDef[] = [
  { id: 'caramujo', kind: 'snail', name: 'Sr. Caramujo', x: 8, z: -82, yaw: -2.4, scale: 1.9 },
  { id: 'dario', kind: 'rival', name: 'Dário', x: -34, z: -36, yaw: 0.8 },
  { id: 'beto', kind: 'beetle', name: 'Beto', x: 4, z: 75, yaw: -2.6 },
];
