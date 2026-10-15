import { describe, expect, it } from 'vitest';
import { Patrol } from '../src/game/Patrol';

const OPTS = { points: [[0, 0], [0, 40]] as [number, number][], speed: 4, range: 14, halfCone: 1, senseRadius: 3, seeTime: 1, pause: 0 };
function run(p: Patrol, secs: number, player: { x: number; z: number }, covered: boolean) {
  let ev = null;
  for (let i = 0; i < secs * 60; i++) { const e = p.update(1 / 60, player, covered); if (e) ev = e; }
  return ev;
}

describe('Patrol (aranha-caçadora)', () => {
  it('anda entre os pontos', () => {
    const p = new Patrol(OPTS);
    run(p, 3, { x: 100, z: 100 }, false);
    expect(p.z).toBeGreaterThan(8);
  });
  it('percebe quem fica exposto à frente dela', () => {
    const p = new Patrol({ ...OPTS, points: [[0, 0], [0, 0.1]] }); p.yaw = 0;
    expect(run(p, 2, { x: 0, z: 8 }, false)).toBe('seen');
  });
  it('não percebe quem está atrás', () => {
    const p = new Patrol({ ...OPTS, points: [[0, 0], [0, 0.1]] }); p.yaw = 0;
    expect(run(p, 3, { x: 0, z: -9 }, false)).toBeNull();
  });
  it('quem está sob cobertura passa despercebido, exceto de muito perto', () => {
    const p = new Patrol({ ...OPTS, points: [[0, 0], [0, 0.1]] }); p.yaw = 0;
    expect(run(p, 3, { x: 0, z: 8 }, true)).toBeNull();
    expect(run(p, 2, { x: 0, z: 2 }, true)).toBe('seen');
  });
});
