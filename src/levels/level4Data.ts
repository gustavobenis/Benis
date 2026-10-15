import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 4 — A Colônia (Em Perigo). */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const GATE = { x: 0, z: 60, hx: 4.5, hz: 1.4, h: 22 };
export const GRANARY = { x: 0, z: 48, r: 7 };
export const CHAMBER = { id: 'chamber', x: 0, z: 78, r: 8 };

/** Terraços do grande formigueiro (escaláveis com saltos): base, meio e topo. */
export const MOUND = { x: -26, z: 26, tiers: [{ r: 14, h: 1.5 }, { r: 10, h: 3 }, { r: 6, h: 4.5 }] };
/** Túneis de terra: caminho coberto, longe dos olhos do louva-a-deus. */
export const TUNNELS: { x: number; z: number; hx: number; hz: number; yaw: number; yBase: number; yTop: number }[] = [
  { x: -14, z: -56, hx: 3, hz: 12, yaw: 0.3, yBase: 2.6, yTop: 5.4 },
  { x: 14, z: -48, hx: 3, hz: 12, yaw: -0.3, yBase: 2.6, yTop: 5.4 },
  { x: -6, z: -26, hx: 3, hz: 13, yaw: 0.8, yBase: 2.6, yTop: 5.4 },
  { x: 22, z: -20, hx: 3, hz: 12, yaw: 0.1, yBase: 2.6, yTop: 5.4 },
  { x: -28, z: 2, hx: 3, hz: 12, yaw: -0.5, yBase: 2.6, yTop: 5.4 },
  { x: 12, z: 8, hx: 3, hz: 12, yaw: 0.6, yBase: 2.6, yTop: 5.4 },
];
export const ROOTS: LogDef[] = [
  { x: 4, z: -74, hx: 1.1, hz: 6, h: 1.4, yaw: 0.2 }, { x: -30, z: -34, hx: 1.1, hz: 6, h: 1.4, yaw: -0.3 }, { x: 34, z: 0, hx: 1.1, hz: 6, h: 1.4, yaw: 0.4 },
  { x: 8, z: 30, hx: 1.1, hz: 6, h: 1.4, yaw: -0.2 }, { x: -12, z: 54, hx: 1.1, hz: 6, h: 1.4, yaw: 0.3 },
];
export const STONES: StoneDef[] = [
  { x: -22, z: -80, r: 2.6, h: 1.5 }, { x: 26, z: -78, r: 3, h: 1.7 }, { x: -40, z: -50, r: 3.2, h: 1.9 }, { x: 42, z: -36, r: 3, h: 1.8 },
  { x: 44, z: 30, r: 3.4, h: 2 }, { x: -44, z: 52, r: 2.8, h: 1.6 }, { x: 22, z: 66, r: 3, h: 1.8 },
];
export const LEAVES: LeafDef[] = [
  { x: 28, z: -34, y: 3.4, hx: 3.2, hz: 4.2, yaw: 0.5 }, { x: -22, z: -14, y: 3.6, hx: 3.4, hz: 4.4, yaw: -0.4 },
  { x: 30, z: 22, y: 3.4, hx: 3.2, hz: 4.2, yaw: 0.2 }, { x: 18, z: -64, y: 3.2, hx: 3.2, hz: 4.2, yaw: -0.6 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -36, z: -70, stem: 3, capR: 4.4, stemR: 1.1, glow: [1, 0.7, 0.3] }, { x: 36, z: -64, stem: 3.4, capR: 4.8, stemR: 1.2, glow: [1, 0.55, 0.25] },
  { x: -42, z: 4, stem: 2.8, capR: 4, stemR: 1, glow: [1, 0.65, 0.35] }, { x: 40, z: 40, stem: 3.2, capR: 4.6, stemR: 1.1, glow: [1, 0.6, 0.3] },
  { x: -32, z: 66, stem: 2.6, capR: 3.8, stemR: 1, glow: [1, 0.7, 0.4] }, { x: 34, z: 84, stem: 3, capR: 4.4, stemR: 1.1, glow: [1, 0.6, 0.3] },
];
/** Rota do louva-a-deus (cruza o centro). */
export const MANTIS_PATH: [number, number][] = [[-32, -40], [32, -42], [32, -10], [-4, -4], [-32, -10]];
/** Trilhas das formigas operárias carregando folhas (apenas cenário vivo). */
export const ANT_TRAILS: [number, number][][] = [
  [[-42, -66], [42, -68]], [[40, -26], [-38, -24]], [[-40, 16], [40, 18]], [[34, 44], [-34, 42]],
];

export const PICKUPS: PickupDef[] = [
  { id: 'seed1', kind: 'seed', x: -26, y: 5.6, z: 26 }, { id: 'seed2', kind: 'seed', x: 32, y: 1, z: -62 },
  { id: 'seed3', kind: 'seed', x: -34, y: 1, z: -62 }, { id: 'seed4', kind: 'seed', x: 34, y: 1, z: 10 },
  { id: 'dew1', kind: 'dew', x: 6, y: 1, z: -84 }, { id: 'dew2', kind: 'dew', x: -16, y: 1, z: -66 }, { id: 'dew3', kind: 'dew', x: 4, y: 1, z: -36 },
  { id: 'dew4', kind: 'dew', x: -30, y: 1, z: -20 }, { id: 'dew5', kind: 'dew', x: 20, y: 1, z: 30 },
  { id: 'crystal1', kind: 'crystal', x: -46, y: 1.5, z: -30 }, { id: 'crystal2', kind: 'crystal', x: 46, y: 1.5, z: 52 },
  { id: 'leaf1', kind: 'leaf', x: 28, y: 4.6, z: -34 }, { id: 'leaf2', kind: 'leaf', x: 30, y: 4.6, z: 22 },
  { id: 'flower1', kind: 'flower', x: -44, y: 1.2, z: 30 }, { id: 'flower2', kind: 'flower', x: 44, y: 1.2, z: -70 },
  { id: 'photo1', kind: 'photo', x: -46, y: 1.1, z: 74 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -58, r: 6 }, { id: 'cp2', x: 0, z: -20, r: 5 }, { id: 'cp3', x: 0, z: 30, r: 6 }, { id: 'cp4', x: 0, z: 70, r: 6 },
];
export const NPCS: NpcDef[] = [
  { id: 'lino', kind: 'ant', name: 'Lino', x: 8, z: -82, yaw: -2.5 },
  { id: 'rainha', kind: 'queen', name: 'Rainha Formiga', x: 0, z: 88, yaw: 3.14 },
];
