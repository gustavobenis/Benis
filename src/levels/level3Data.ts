import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 3 — A Floresta (Desafios). */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const GATE = { x: 0, z: 62, hx: 4.5, hz: 1.4, h: 22 };
export const ALTAR = { x: 0, z: 50, r: 7 };
export const CLEARING = { id: 'clearing', x: 0, z: 78, r: 8 };
const BOUNCE = 15.5;

/** Troncos suspensos: túneis de sombra por onde se passa embaixo ou se anda por cima. */
export const RAISED_LOGS: { x: number; z: number; hx: number; hz: number; yaw: number; yBase: number; yTop: number }[] = [
  { x: -12, z: -36, hx: 3, hz: 13, yaw: 0.25, yBase: 2.6, yTop: 5.4 },
  { x: 14, z: -24, hx: 3, hz: 12, yaw: -0.35, yBase: 2.6, yTop: 5.4 },
  { x: -8, z: -6, hx: 3, hz: 13, yaw: 0.9, yBase: 2.6, yTop: 5.4 },
  { x: 20, z: 8, hx: 3, hz: 11, yaw: 0.15, yBase: 2.6, yTop: 5.4 },
  { x: -24, z: 18, hx: 3, hz: 12, yaw: -0.5, yBase: 2.6, yTop: 5.4 },
];
/** Raízes baixas (saltáveis) em fileiras. */
export const ROOTS: LogDef[] = [
  { x: -6, z: -76, hx: 1.1, hz: 7, h: 1.5, yaw: 0.2 }, { x: 10, z: -70, hx: 1.1, hz: 7, h: 1.5, yaw: -0.25 }, { x: -2, z: -62, hx: 1.1, hz: 6, h: 1.5, yaw: 0.1 },
  { x: -30, z: -20, hx: 1.1, hz: 6, h: 1.5, yaw: 0.6 }, { x: 34, z: -14, hx: 1.1, hz: 6, h: 1.5, yaw: -0.4 },
  { x: 8, z: 30, hx: 1.1, hz: 7, h: 1.5, yaw: 0.3 }, { x: -12, z: 38, hx: 1.1, hz: 7, h: 1.5, yaw: -0.2 }, { x: 30, z: 44, hx: 1.1, hz: 6, h: 1.5, yaw: 0.5 },
];
export const STONES: StoneDef[] = [
  { x: -22, z: -78, r: 2.4, h: 1.4 }, { x: 24, z: -80, r: 2.8, h: 1.6 }, { x: -38, z: -40, r: 3.2, h: 1.9 }, { x: 40, z: -36, r: 3, h: 1.8 },
  { x: -40, z: 30, r: 2.6, h: 1.5 }, { x: 42, z: 20, r: 3, h: 1.7 }, { x: 24, z: 70, r: 3.4, h: 2 }, { x: -26, z: 76, r: 2.8, h: 1.6 },
];
export const LEAVES: LeafDef[] = [
  { x: -31, z: -52, y: 7, hx: 3.4, hz: 4.2, yaw: 0.4 },   // cristal 1
  { x: 31, z: -4, y: 7.5, hx: 3.4, hz: 4.2, yaw: -0.3 },  // cristal 2
  { x: -19, z: 31, y: 7, hx: 3.4, hz: 4.2, yaw: 0.5 },    // cristal 3
  { x: 14, z: -56, y: 4.2, hx: 3, hz: 4, yaw: -0.5 },
];
export const MUSHROOMS: MushroomDef[] = [
  // Trampolins (cor-de-rosa luminosa)
  { x: -25, z: -57, stem: 2.2, capR: 3.8, stemR: 0.9, bounce: BOUNCE, glow: [1, 0.35, 0.65] },
  { x: 24, z: -12, stem: 2.2, capR: 3.8, stemR: 0.9, bounce: BOUNCE, glow: [1, 0.35, 0.65] },
  { x: -15, z: 24, stem: 2.2, capR: 3.8, stemR: 0.9, bounce: BOUNCE, glow: [1, 0.35, 0.65] },
  { x: 0, z: -48, stem: 2.2, capR: 3.4, stemR: 0.8, bounce: BOUNCE, glow: [1, 0.35, 0.65] },
  // Decorativos luminosos (azul-esverdeado) e comuns
  { x: -34, z: -70, stem: 3, capR: 4.4, stemR: 1.1, glow: [0.25, 0.9, 0.85] }, { x: 36, z: -62, stem: 3.4, capR: 4.8, stemR: 1.2, glow: [0.25, 0.9, 0.85] },
  { x: -36, z: 8, stem: 2.8, capR: 4, stemR: 1, glow: [0.35, 0.85, 1] }, { x: 38, z: 34, stem: 3.2, capR: 4.6, stemR: 1.1, glow: [0.25, 0.9, 0.85] },
  { x: -30, z: 60, stem: 2.6, capR: 3.8, stemR: 1, glow: [0.6, 0.9, 0.4] }, { x: 34, z: 82, stem: 3, capR: 4.4, stemR: 1.1, glow: [0.35, 0.85, 1] },
];
export const WEBS = [
  { id: 'w1', x: 12, z: -44, r: 5.5 }, { id: 'w2', x: -16, z: -16, r: 5.5 }, { id: 'w3', x: 6, z: 12, r: 5.5 }, { id: 'w4', x: -22, z: 42, r: 6 },
];
/** Rota da aranha-caçadora (cruza o centro da floresta). */
export const HUNTER_PATH: [number, number][] = [[-26, -30], [26, -32], [28, -4], [-4, 2], [-28, -2]];

export const PICKUPS: PickupDef[] = [
  { id: 'crystal1', kind: 'crystal', x: -31, y: 8.6, z: -52 },
  { id: 'crystal2', kind: 'crystal', x: 31, y: 9.1, z: -4 },
  { id: 'crystal3', kind: 'crystal', x: -19, y: 8.6, z: 31 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -84 }, { id: 'dew2', kind: 'dew', x: -14, y: 1, z: -64 }, { id: 'dew3', kind: 'dew', x: 24, y: 1, z: -48 },
  { id: 'dew4', kind: 'dew', x: -28, y: 1, z: -8 }, { id: 'dew5', kind: 'dew', x: 30, y: 1, z: 28 }, { id: 'dew6', kind: 'dew', x: 12, y: 1, z: 68 },
  { id: 'seed1', kind: 'seed', x: 40, y: 1, z: -74 }, { id: 'seed2', kind: 'seed', x: -44, y: 1, z: 48 },
  { id: 'flower1', kind: 'flower', x: -42, y: 1.2, z: -18 }, { id: 'flower2', kind: 'flower', x: 44, y: 1.2, z: 60 },
  { id: 'photo1', kind: 'photo', x: -46, y: 1.1, z: 86 },
  { id: 'leaf1', kind: 'leaf', x: 14, y: 5.5, z: -56 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -56, r: 6 }, { id: 'cp2', x: 0, z: -18, r: 5 }, { id: 'cp3', x: 0, z: 28, r: 6 }, { id: 'cp4', x: 0, z: 70, r: 6 },
];
export const NPCS: NpcDef[] = [
  { id: 'tico', kind: 'grasshopper', name: 'Tico', x: 8, z: -80, yaw: -2.5 },
  { id: 'olivia', kind: 'spider', name: 'Dona Olívia', x: 0, z: 86, yaw: 3.14 },
];
