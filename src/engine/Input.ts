/**
 * Entrada unificada: teclado + mouse, toque (joystick virtual + área de arraste + botões) e Gamepad API.
 * O jogo lê um `InputFrame` por quadro; ações de "clique único" são consumidas na leitura.
 */
export interface InputFrame {
  moveX: number; moveY: number; // -1..1 (Y positivo = frente)
  magnitude: number;            // 0..1 intensidade do movimento (toque/gamepad analógico)
  lookX: number; lookY: number; // delta em radianos neste quadro
  zoom: number;                 // delta de zoom (positivo = afastar)
  run: boolean;
  jumpHeld: boolean; jumpPressed: boolean;
  interact: boolean; observe: boolean; camera: boolean; pause: boolean;
  advance: boolean;             // avançar diálogo (E / Espaço / toque)
}

const LOOK_MOUSE = 0.0024;
const LOOK_TOUCH = 0.0042;

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private lookX = 0; private lookY = 0; private zoom = 0;
  private touchMove = { x: 0, y: 0 };
  private joyId = -1; private joyOrigin = { x: 0, y: 0 };
  private lookId = -1; private lookLast = { x: 0, y: 0 };
  private touchHeld = new Set<string>();
  private touchPressed = new Set<string>();
  private padPrev: boolean[] = [];
  private padPressed = new Set<string>();
  usingTouch = false;
  /** Ativado pelo jogo: quando falso, ignora entradas (menus). */
  enabled = false;
  pointerLocked = false;

  constructor(canvas: HTMLCanvasElement, private opts: { sensitivity: () => number; invertY: () => boolean; onFirstTouch: () => void; onUnlock: () => void }) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.touchHeld.clear(); });
    canvas.addEventListener('mousedown', () => { if (this.enabled && !this.usingTouch && !this.pointerLocked) canvas.requestPointerLock?.(); });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // Com pointer lock: olhar livre. Sem lock (ex.: iframe): arrastar com o botão esquerdo.
      if (this.pointerLocked || (e.buttons & 1 && !this.usingTouch)) this.addLook(e.movementX * LOOK_MOUSE, e.movementY * LOOK_MOUSE);
    });
    window.addEventListener('wheel', (e) => { if (this.enabled) this.zoom += Math.sign(e.deltaY) * 0.9; }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === canvas;
      if (was && !this.pointerLocked) this.opts.onUnlock();
    });
  }

  private addLook(dx: number, dy: number): void {
    const s = this.opts.sensitivity();
    this.lookX += dx * s;
    this.lookY += dy * s * (this.opts.invertY() ? -1 : 1);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.code;
    if (down) {
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(k)) e.preventDefault();
    } else this.keys.delete(k);
  }

  /** Liga os elementos de toque da interface. */
  bindTouch(els: { joyZone: HTMLElement; joyBase: HTMLElement; joyKnob: HTMLElement; lookZone: HTMLElement; buttons: Record<string, HTMLElement> }): void {
    const { joyZone, joyBase, joyKnob, lookZone, buttons } = els;
    const MAXR = 55;
    const first = () => { if (!this.usingTouch) { this.usingTouch = true; this.opts.onFirstTouch(); } };
    joyZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.joyId >= 0) return;
      first(); e.preventDefault();
      this.joyId = e.pointerId; joyZone.setPointerCapture(e.pointerId);
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      joyBase.style.display = 'block';
      joyBase.style.left = `${e.clientX}px`; joyBase.style.top = `${e.clientY}px`;
      joyKnob.style.transform = 'translate(-50%,-50%)';
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      let dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > MAXR) { dx = (dx / d) * MAXR; dy = (dy / d) * MAXR; }
      this.touchMove = { x: dx / MAXR, y: -dy / MAXR };
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = -1; this.touchMove = { x: 0, y: 0 }; joyBase.style.display = 'none';
    };
    joyZone.addEventListener('pointerup', endJoy); joyZone.addEventListener('pointercancel', endJoy);

    lookZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.lookId >= 0) return;
      first(); e.preventDefault();
      this.lookId = e.pointerId; lookZone.setPointerCapture(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.addLook((e.clientX - this.lookLast.x) * LOOK_TOUCH, (e.clientY - this.lookLast.y) * LOOK_TOUCH);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e: PointerEvent) => { if (e.pointerId === this.lookId) this.lookId = -1; };
    lookZone.addEventListener('pointerup', endLook); lookZone.addEventListener('pointercancel', endLook);

    for (const [name, el] of Object.entries(buttons)) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); first();
        el.setPointerCapture(e.pointerId);
        this.touchHeld.add(name); this.touchPressed.add(name);
        el.classList.add('down');
        if (name === 'jump' || name === 'interact') navigator.vibrate?.(12);
      });
      const up = () => { this.touchHeld.delete(name); el.classList.remove('down'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }
  }

  private pollGamepad(): { mx: number; my: number; lx: number; ly: number; run: boolean; jump: boolean } {
    const out = { mx: 0, my: 0, lx: 0, ly: 0, run: false, jump: false };
    const pad = navigator.getGamepads?.().find((p) => p && p.connected);
    if (!pad) return out;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    out.mx = dz(pad.axes[0] ?? 0); out.my = -dz(pad.axes[1] ?? 0);
    out.lx = dz(pad.axes[2] ?? 0); out.ly = dz(pad.axes[3] ?? 0);
    const b = pad.buttons.map((x) => x.pressed);
    const names: [number, string][] = [[2, 'interact'], [3, 'camera'], [4, 'observe'], [9, 'pause'], [0, 'jump']];
    for (const [i, n] of names) if (b[i] && !this.padPrev[i]) this.padPressed.add(n);
    out.jump = !!b[0]; out.run = !!b[1] || !!b[5];
    this.padPrev = b;
    return out;
  }

  /** Chamado todo quadro (mesmo em menus, para capturar pausa/gamepad). */
  read(dt: number): InputFrame {
    const pad = this.pollGamepad();
    const k = (c: string) => this.keys.has(c);
    const was = (c: string) => this.pressed.has(c);
    const wasT = (n: string) => this.touchPressed.has(n);
    const wasP = (n: string) => this.padPressed.has(n);

    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    let mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0) { const l = Math.hypot(mx, my); mx /= l; my /= l; }
    const tm = Math.hypot(this.touchMove.x, this.touchMove.y);
    if (tm > 0.12) { mx = this.touchMove.x / tm; my = this.touchMove.y / tm; mag = Math.min(1, tm); }
    const pm = Math.hypot(pad.mx, pad.my);
    if (pm > 0.05 && mag === 0) { mx = pad.mx / pm; my = pad.my / pm; mag = Math.min(1, pm); }
    const n = Math.hypot(mx, my);
    if (n > 1) { mx /= n; my /= n; }

    const run = k('ShiftLeft') || k('ShiftRight') || pad.run || (tm > 0.9);
    const jumpPressed = was('Space') || wasT('jump') || wasP('jump');
    const frame: InputFrame = {
      moveX: this.enabled ? mx : 0, moveY: this.enabled ? my : 0, magnitude: this.enabled ? mag : 0,
      lookX: this.enabled ? this.lookX + pad.lx * 2.2 * dt * this.opts.sensitivity() : 0,
      lookY: this.enabled ? this.lookY + pad.ly * 1.6 * dt * this.opts.sensitivity() * (this.opts.invertY() ? -1 : 1) : 0,
      zoom: this.enabled ? this.zoom : 0,
      run,
      jumpHeld: this.enabled && (k('Space') || this.touchHeld.has('jump') || pad.jump),
      jumpPressed: this.enabled && jumpPressed,
      interact: this.enabled && (was('KeyE') || wasT('interact') || wasP('interact')),
      observe: this.enabled && (was('KeyQ') || wasT('observe') || wasP('observe')),
      camera: this.enabled && (was('KeyF') || wasT('camera') || wasP('camera')),
      pause: was('Escape') || wasT('pause') || wasP('pause'),
      advance: was('KeyE') || was('Space') || was('Enter') || wasT('interact') || wasT('jump') || wasP('jump') || wasP('interact'),
    };
    this.lookX = this.lookY = this.zoom = 0;
    this.pressed.clear(); this.touchPressed.clear(); this.padPressed.clear();
    return frame;
  }

  exitPointerLock(): void { if (document.pointerLockElement) document.exitPointerLock(); }
}
