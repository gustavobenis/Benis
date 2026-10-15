/** Patrulha de um predador (aranha-caçadora): lógica pura, sem Babylon, para ser testável. */
export interface PatrolOpts { points: [number, number][]; speed: number; range: number; halfCone: number; senseRadius: number; seeTime: number; pause: number }

export type PatrolEvent = 'seen' | null;

export class Patrol {
  x: number; z: number; yaw = 0;
  /** 0..1: quanto falta para o predador te notar. */
  alert = 0;
  moving = false;
  private i = 0; private wait = 0; private exposure = 0;

  constructor(private o: PatrolOpts) { [this.x, this.z] = o.points[0]; this.i = 1 % o.points.length; }

  /** `covered`: o jogador está sob uma cobertura (tronco, folha) e só é percebido de muito perto. */
  update(dt: number, p: { x: number; z: number }, covered: boolean): PatrolEvent {
    const o = this.o;
    if (this.wait > 0) { this.wait -= dt; this.moving = false; }
    else {
      const [tx, tz] = o.points[this.i];
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { this.i = (this.i + 1) % o.points.length; this.wait = o.pause; this.moving = false; }
      else {
        const want = Math.atan2(dx, dz);
        let diff = want - this.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 5);
        const step = Math.min(d, o.speed * dt);
        this.x += (dx / d) * step; this.z += (dz / d) * step; this.moving = true;
      }
    }
    const dist = Math.hypot(p.x - this.x, p.z - this.z);
    let visible = false;
    if (dist <= o.senseRadius) visible = true;
    else if (!covered && dist <= o.range) {
      const to = Math.atan2(p.x - this.x, p.z - this.z);
      let d = to - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      visible = Math.abs(d) <= o.halfCone;
    }
    this.exposure = visible ? this.exposure + dt : Math.max(0, this.exposure - dt * 1.5);
    this.alert = Math.min(1, this.exposure / o.seeTime);
    if (this.exposure >= o.seeTime) { this.exposure = 0; this.alert = 0; this.wait = 1.5; return 'seen'; }
    return null;
  }
}
