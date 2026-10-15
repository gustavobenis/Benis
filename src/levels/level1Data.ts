import type { Surface } from '../physics/CollisionWorld';

/** Dados puros da Fase 1 — O Jardim das Gotas. Unidades: 1 ≈ comprimento do corpo de Marieta. */
export interface StoneDef { x: number; z: number; r: number; h: number; surface?: Surface }
export interface LeafDef { x: number; z: number; y: number; hx: number; hz: number; yaw: number }
export interface MushroomDef { x: number; z: number; stem: number; capR: number; stemR: number }
export interface StemDef { x: number; z: number; h: number; r: number }
export interface LogDef { x: number; z: number; hx: number; hz: number; h: number; yaw: number }
export interface PickupDef { id: string; kind: 'dew' | 'seed'; x: number; y: number; z: number }

export const BOUNDS: [number, number, number, number] = [-58, 58, -98, 98];
export const START = { x: 0, y: 0, z: -92 };
export const SHELTER = { x: 0, z: 90, r: 5 };
export const GATE = { x: 0, z: 78, hx: 4.5, hz: 1.4, h: 22 };

export const STONES: StoneDef[] = [
  { x: -8, z: -86, r: 2.4, h: 1.3 },
  { x: -9, z: -68, r: 2.2, h: 1.5 },
  { x: -26, z: -40, r: 3, h: 1.8 },
  { x: 30, z: 10, r: 4, h: 2.4 },
  { x: -30, z: 50, r: 2.6, h: 1.4 },
  { x: -34, z: 54, r: 1.8, h: 1.1 },
  { x: -28, z: 57, r: 2.1, h: 1.3 },
  { x: 14, z: -22, r: 1.6, h: 1.0 },
  { x: 36, z: -60, r: 2.8, h: 1.6 },
  { x: -42, z: 12, r: 3.2, h: 2.0 },
];

export const LEAVES: LeafDef[] = [
  { x: -7, z: -63, y: 2.7, hx: 2.6, hz: 3.6, yaw: 0.3 },
  { x: -4, z: -52, y: 4.4, hx: 3.2, hz: 4.2, yaw: -0.4 },
  { x: -6, z: -8, y: 11, hx: 2.8, hz: 13.5, yaw: 0 },     // ponte alta (caule → vôo)
  { x: -6, z: 15, y: 8, hx: 4.2, hz: 5, yaw: 0.2 },
  { x: -15, z: 25, y: 5, hx: 3.4, hz: 4, yaw: -0.5 },
  { x: -21, z: 33, y: 2.4, hx: 3.2, hz: 3.8, yaw: 0.4 },
  { x: 12, z: 28, y: 3.5, hx: 3.4, hz: 4.4, yaw: 0.6 },   // abrigo contra o pássaro
  { x: -4, z: 42, y: 4, hx: 3.6, hz: 4.6, yaw: -0.2 },    // abrigo contra o pássaro
  { x: 10, z: 46, y: 3.2, hx: 3, hz: 3.8, yaw: 0.9 },
];

export const MUSHROOMS: MushroomDef[] = [
  { x: -14, z: -58, stem: 3, capR: 4.5, stemR: 1.1 },
  { x: 22, z: -36, stem: 2.6, capR: 4, stemR: 1 },
  { x: 27, z: -29, stem: 1.8, capR: 2.6, stemR: 0.7 },
  { x: 17, z: -29, stem: 2.2, capR: 3, stemR: 0.8 },
  { x: 26, z: 38, stem: 3.4, capR: 5, stemR: 1.2 },
  { x: -36, z: -78, stem: 2.4, capR: 3.4, stemR: 0.9 },
];

export const STEMS: StemDef[] = [{ x: -6, z: -22.2, h: 11, r: 0.8 }];
export const LOGS: LogDef[] = [{ x: 10, z: -74, hx: 1.0, hz: 5.5, h: 1.2, yaw: 0.5 }];

export const PICKUPS: PickupDef[] = [
  { id: 'dew1', kind: 'dew', x: -8, y: 2.1, z: -86 },
  { id: 'dew2', kind: 'dew', x: 14, y: 1.0, z: -70 },
  { id: 'dew3', kind: 'dew', x: -4, y: 5.4, z: -50 },
  { id: 'dew4', kind: 'dew', x: 22, y: 1.0, z: -22 },
  { id: 'dew5', kind: 'dew', x: -6, y: 12, z: -6 },
  { id: 'dew6', kind: 'dew', x: -6, y: 9, z: 15 },
  { id: 'dew7', kind: 'dew', x: 20, y: 1.0, z: 24 },
  { id: 'dew8', kind: 'dew', x: -31, y: 1.0, z: 52 },
  { id: 'seed1', kind: 'seed', x: 22, y: 0.9, z: -36.6 },
  { id: 'seed2', kind: 'seed', x: 30, y: 3.4, z: 10 },
  { id: 'seed3', kind: 'seed', x: 11, y: 0.9, z: 46 },
];

export const CHECKPOINTS = [
  { id: 'cp0', x: 0, z: -92, r: 6 },
  { id: 'cp1', x: 0, z: -46, r: 6 },
  { id: 'cp2', x: 0, z: 30, r: 6 },
  { id: 'cp3', x: 0, z: 84, r: 6 },
];
export const PUDDLES = [{ id: 'p1', x: 6, z: -38, r: 6 }, { id: 'p2', x: -2, z: 4, r: 4.5 }];
export const NPCS = [
  { id: 'tito', x: 6, z: -84, yaw: -2.4 },
  { id: 'tito_end', x: -6, z: 90, yaw: 0.8 },
];
