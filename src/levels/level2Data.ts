import type { CheckpointDef, LeafDef, LogDef, MushroomDef, NpcDef, PickupDef, StoneDef } from './LevelBase';

/** Dados puros da Fase 2 — O Rio (Novos Amigos). O rio corre de oeste para leste entre z = -6 e z = 26. */
export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, z: -90 };
export const RIVER = { minX: -62, maxX: 62, minZ: -6, maxZ: 26, flowX: 3.6, flowZ: 0 };
export const BRIDGE = { x: 0, z: 10, hx: 2.2, hz: 17, y: 0.55 };
export const BRIDGE_SITE = { x: 0, z: -10.5, r: 7.5 };
export const NORTH = { id: 'north', x: 0, z: 33, r: 7 };

/** Pedras para atravessar com saltos precisos (rota difícil, a oeste). */
export const RIVER_STONES: StoneDef[] = [
  { x: -22, z: -4, r: 2.4, h: 0.95 }, { x: -25, z: 2.5, r: 2.3, h: 0.95 }, { x: -18, z: 9, r: 3.2, h: 1.3 },
  { x: -24, z: 15.5, r: 2.3, h: 0.95 }, { x: -20, z: 22, r: 2.3, h: 0.95 },
];
/** Folhas flutuantes que vão e vêm (rota móvel, a leste). */
export const FLOATING_LEAVES = [
  { z: 0, phase: 0, speed: 0.55, cx: 20 }, { z: 9, phase: 2.1, speed: 0.5, cx: 20 }, { z: 18, phase: 4.2, speed: 0.6, cx: 20 },
];

export const STONES: StoneDef[] = [
  { x: -40, z: -60, r: 3, h: 1.7 }, { x: 38, z: -22, r: 4, h: 2.3 }, { x: -44, z: 36, r: 3.2, h: 1.9 }, { x: 44, z: 50, r: 3.6, h: 2.1 },
  { x: -36, z: -84, r: 2.4, h: 1.3 }, { x: 8, z: -52, r: 1.8, h: 1.0 }, { x: -6, z: 70, r: 2.6, h: 1.5 }, { x: 30, z: 84, r: 2.8, h: 1.6 },
];
export const LEAVES: LeafDef[] = [
  { x: 12, z: -66, y: 3.2, hx: 3.2, hz: 4.2, yaw: 0.4 },
  { x: -12, z: -46, y: 3.8, hx: 3.4, hz: 4.4, yaw: -0.3 },
  { x: -14, z: 46, y: 3.5, hx: 3.4, hz: 4.4, yaw: 0.5 },
  { x: 22, z: 64, y: 4, hx: 3.6, hz: 4.6, yaw: -0.4 },
];
export const MUSHROOMS: MushroomDef[] = [
  { x: -30, z: -84, stem: 2.6, capR: 4, stemR: 1 }, { x: 28, z: -86, stem: 3, capR: 4.4, stemR: 1.1 }, { x: -14, z: -30, stem: 2.2, capR: 3.2, stemR: 0.8 },
  { x: 36, z: -44, stem: 3.2, capR: 4.6, stemR: 1.1 }, { x: 24, z: 56, stem: 2.8, capR: 4, stemR: 1 }, { x: -24, z: 70, stem: 3.4, capR: 5, stemR: 1.2 },
  { x: 34, z: 80, stem: 2.4, capR: 3.4, stemR: 0.9 },
];
export const LOGS: LogDef[] = [{ x: -6, z: -64, hx: 1.0, hz: 5, h: 1.2, yaw: -0.5 }, { x: 8, z: 74, hx: 1.0, hz: 5.5, h: 1.2, yaw: 0.6 }];

export const PICKUPS: PickupDef[] = [
  { id: 'leaf1', kind: 'leaf', x: -20, y: 1.1, z: -62 },
  { id: 'leaf2', kind: 'leaf', x: 24, y: 1.1, z: -48 },
  { id: 'leaf3', kind: 'leaf', x: -34, y: 1.1, z: -24 },
  { id: 'leaf4', kind: 'leaf', x: -18, y: 2.5, z: 9 },
  { id: 'dew1', kind: 'dew', x: -8, y: 1, z: -76 }, { id: 'dew2', kind: 'dew', x: 16, y: 1, z: -78 },
  { id: 'dew3', kind: 'dew', x: -26, y: 1, z: -46 }, { id: 'dew4', kind: 'dew', x: 30, y: 1, z: -30 },
  { id: 'dew5', kind: 'dew', x: 30, y: 1, z: 40 }, { id: 'dew6', kind: 'dew', x: -30, y: 1, z: 52 },
  { id: 'seed1', kind: 'seed', x: 34, y: 1, z: -70 }, { id: 'seed2', kind: 'seed', x: -44, y: 1, z: 70 },
  { id: 'crystal1', kind: 'crystal', x: -20, y: 1.9, z: 22 }, { id: 'crystal2', kind: 'crystal', x: 24, y: 5.6, z: 56 },
  { id: 'flower1', kind: 'flower', x: 40, y: 1.2, z: -84 }, { id: 'flower2', kind: 'flower', x: -36, y: 1.2, z: 60 },
  { id: 'photo1', kind: 'photo', x: 46, y: 1.1, z: 76 },
];
export const CHECKPOINTS: CheckpointDef[] = [
  { id: 'cp0', x: 0, z: -90, r: 6 }, { id: 'cp1', x: 0, z: -52, r: 6 }, { id: 'cp2', x: 0, z: -16, r: 6 },
  { id: 'cp3', x: 0, z: 33, r: 6 }, { id: 'cp4', x: 10, z: 60, r: 6 },
];
export const NPCS: NpcDef[] = [
  { id: 'lino', kind: 'ant', name: 'Lino', x: 10, z: -17, yaw: -2.4 },
  { id: 'luna', kind: 'butterfly', name: 'Luna', x: -8, z: 40, yaw: 0.6 },
  { id: 'beto', kind: 'beetle', name: 'Beto', x: 14, z: 46, yaw: -2.6 },
];
export const RESCUE = { x: 9, z: 42, npc: 'beto' };
