import { describe, expect, it } from 'vitest';
import { CollisionWorld, createBody } from '../src/physics/CollisionWorld';

const OPTS = { accel: 12, jump: false, jumpSpeed: 10, glide: false, climb: false, climbSpeed: 3 };

function sim(w: CollisionWorld, b: ReturnType<typeof createBody>, secs: number, wx: number, wz: number, o = {}) {
  for (let i = 0; i < secs * 60; i++) w.step(b, 1 / 60, wx, wz, { ...OPTS, ...o });
}

describe('CollisionWorld', () => {
  it('pousa no chão e fica parado', () => {
    const w = new CollisionWorld();
    const b = createBody(0, 3, 0);
    sim(w, b, 1, 0, 0);
    expect(b.y).toBe(0);
    expect(b.grounded).toBe(true);
  });

  it('não atravessa uma pedra alta', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'cyl', x: 0, z: 5, r: 2, yBase: 0, yTop: 4, surface: 'stone' });
    const b = createBody(0, 0, 0);
    sim(w, b, 3, 0, 8);
    expect(Math.hypot(b.x, b.z - 5)).toBeGreaterThanOrEqual(2 + b.radius - 0.05);
    expect(b.y).toBe(0);
  });

  it('sobe degraus baixos automaticamente', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'cyl', x: 0, z: 3, r: 2, yBase: 0, yTop: 0.5, surface: 'stone' });
    const b = createBody(0, 0, 0);
    sim(w, b, 0.5, 0, 5);
    expect(b.y).toBeCloseTo(0.5, 2);
    expect(b.surface).toBe('stone');
  });

  it('salta sobre uma pedra de 1.5 e pousa no topo', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'cyl', x: 0, z: 3, r: 2, yBase: 0, yTop: 1.5, surface: 'stone' });
    const b = createBody(0, 0, 0);
    sim(w, b, 0.2, 0, 3);
    for (let i = 0; i < 50; i++) w.step(b, 1 / 60, 0, 3, { ...OPTS, jump: i === 0 });
    expect(b.y).toBeCloseTo(1.5, 2);
  });

  it('caixas giradas funcionam como plataforma', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'box', x: 0, z: 0, hx: 1, hz: 5, yBase: 2, yTop: 2.4, yaw: Math.PI / 2, surface: 'leaf' });
    expect(w.groundAt(4, 0, 2.4).y).toBe(2.4); // após girar 90°, o lado longo fica em X
    expect(w.groundAt(0, 4, 2.4).y).toBe(0);
  });

  it('planar reduz a velocidade de queda', () => {
    const w = new CollisionWorld();
    const a = createBody(0, 20, 0), c = createBody(0, 20, 0);
    sim(w, a, 1, 0, 0);
    sim(w, c, 1, 0, 0, { glide: true });
    expect(c.y).toBeGreaterThan(a.y + 5);
  });

  it('escala caules marcados como escaláveis', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'cyl', x: 0, z: 2, r: 0.8, yBase: 0, yTop: 6, surface: 'wood', climbable: true });
    const b = createBody(0, 0, 0);
    sim(w, b, 2.5, 0, 4, { climb: true });
    expect(b.y).toBeGreaterThan(3);
  });

  it('respeita os limites do mundo', () => {
    const w = new CollisionWorld();
    w.bounds = [-5, 5, -5, 5];
    const b = createBody(0, 0, 0);
    sim(w, b, 3, 20, 0);
    expect(b.x).toBeLessThanOrEqual(5);
  });

  it('detecta cobertura sob folhas e zonas', () => {
    const w = new CollisionWorld();
    w.add({ kind: 'box', x: 0, z: 0, hx: 3, hz: 3, yBase: 3, yTop: 3.3, yaw: 0, surface: 'leaf' });
    w.zones.push({ id: 'p', x: 20, z: 0, r: 3, type: 'puddle' });
    expect(w.isCovered(0, 0, 0)).toBe(true);
    expect(w.isCovered(10, 0, 0)).toBe(false);
    expect(w.zoneAt(21, 0, 'puddle')?.id).toBe('p');
    expect(w.cameraClip([0, 1, -10], [0, 1, 10])).toBeLessThanOrEqual(1);
  });
});

describe('Água e plataformas móveis', () => {
  it('a correnteza arrasta quem está na água e não quem está sobre uma pedra', () => {
    const w = new CollisionWorld();
    w.waters.push({ minX: -50, maxX: 50, minZ: 0, maxZ: 20, flowX: 4, flowZ: 0 });
    w.add({ kind: 'cyl', x: 10, z: 10, r: 2, yBase: 0, yTop: 0.9, surface: 'stone' });
    const a = createBody(0, 0, 10), c = createBody(10, 0.9, 10);
    c.grounded = true;
    sim(w, a, 1, 0, 0); sim(w, c, 1, 0, 0);
    expect(a.inWater).toBe(true);
    expect(a.x).toBeGreaterThan(3);
    expect(c.inWater).toBe(false);
    expect(Math.abs(c.x - 10)).toBeLessThan(0.1);
  });

  it('plataforma móvel carrega quem está em cima', () => {
    const w = new CollisionWorld();
    const mv = { ax: 6, az: 0, speed: 1, phase: 0, cx: 0, cz: 0, dx: 0, dz: 0 };
    w.add({ kind: 'box', x: 0, z: 0, hx: 3, hz: 3, yBase: 0.1, yTop: 0.5, yaw: 0, surface: 'leaf', move: mv });
    const b = createBody(0, 0.5, 0);
    b.grounded = true;
    let t = 0;
    for (let i = 0; i < 90; i++) { t += 1 / 60; w.updateMovers(t); w.step(b, 1 / 60, 0, 0, OPTS); }
    expect(b.x).toBeGreaterThan(3);              // acompanhou a folha (~6·sin(1.5) ≈ 6)
    expect(b.y).toBeCloseTo(0.5, 2);
  });
});
