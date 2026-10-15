import type { Settings } from '../systems/Settings';
import type { Surface } from '../physics/CollisionWorld';

/**
 * Áudio 100% procedural (Web Audio API): sem arquivos de terceiros, portanto sem
 * questões de licença. Barramentos independentes: música, ambiente, efeitos e diálogos.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<'music' | 'ambient' | 'sfx' | 'dialog', GainNode>;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private tension!: GainNode;
  private springs: AudioNode[] = [];
  private nextBird = 0; private nextNote = 0; private chordIdx = 0;
  private running = false;
  private settings: Settings | null = null;
  private tensionTarget = 0;
  private rainGain: GainNode | null = null;

  get ready(): boolean { return !!this.ctx; }
  get hasSprings(): boolean { return this.springs.length > 0; }

  /** Deve ser chamado dentro de um gesto do usuário (clique/toque). */
  init(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const mk = () => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.buses = { music: mk(), ambient: mk(), sfx: mk(), dialog: mk() };
    this.noise = this.makeNoise(3);
    this.buildWind();
    this.buildTension();
    if (this.settings) this.apply(this.settings);
    void ctx.resume();
  }

  apply(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    for (const k of ['music', 'ambient', 'sfx', 'dialog'] as const) this.buses[k].gain.setTargetAtTime(s[k], t, 0.05);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  private makeNoise(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) { // ruído rosa aproximado
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return buf;
  }

  private loopNoise(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    src.loopStart = Math.random() * 1; src.start();
    return src;
  }

  private buildWind(): void {
    const ctx = this.ctx!;
    const src = this.loopNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.25;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(this.windGain.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.07;
    const lg2 = ctx.createGain(); lg2.gain.value = 180;
    lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
    src.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.buses.ambient);
  }

  /** Chuva: ruído filtrado em laço, com volume 0..1. */
  setRain(v: number): void {
    if (!this.ctx) return;
    if (!this.rainGain) {
      const ctx = this.ctx; const src = this.loopNoise();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(this.rainGain); this.rainGain.connect(this.buses.ambient);
    }
    this.rainGain.gain.setTargetAtTime(v * 1.6, this.ctx.currentTime, 0.4);
  }

  /** Trovão: estrondo grave de ruído + queda de tom. */
  thunder(): void {
    if (!this.ctx) return;
    const ctx = this.ctx; const t = ctx.currentTime + 0.12;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(70, t + 2.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.3, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    src.connect(lp); lp.connect(g); g.connect(this.buses.sfx); src.start(t, Math.random() * 1.5, 2.7);
  }

  gust(): void { if (this.ctx) this.sweep(220, 520, 0.9, 0.06); }

  private buildTension(): void {
    const ctx = this.ctx!;
    this.tension = ctx.createGain(); this.tension.gain.value = 0;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const trem = ctx.createOscillator(); trem.frequency.value = 3.2;
    const tg = ctx.createGain(); tg.gain.value = 0.5;
    const amp = ctx.createGain(); amp.gain.value = 0.5;
    trem.connect(tg); tg.connect(amp.gain); trem.start(); o.start();
    o.connect(lp); lp.connect(amp); amp.connect(this.tension); this.tension.connect(this.buses.music);
  }

  /** Fonte espacial contínua (água corrente) em posição do mundo. */
  addSpring(x: number, y: number, z: number, gain = 2.2): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = this.loopNoise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.3; p.maxDistance = 400;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    src.connect(hp); hp.connect(g); g.connect(p); p.connect(this.buses.ambient);
    this.springs.push(p, g, hp, src);
  }

  /** Remove as fontes espaciais da fase anterior. */
  clearSprings(): void {
    for (const n of this.springs) { try { if (n instanceof AudioBufferSourceNode) n.stop(); n.disconnect(); } catch { /* já parado */ } }
    this.springs = [];
  }

  setListener(px: number, py: number, pz: number, fx: number, fz: number): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
      // O listener Web Audio é destro (z para trás); o Babylon é canhoto: invertemos z.
      l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = -fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  }

  setTension(v: number): void { this.tensionTarget = v; }

  start(): void { this.running = true; }
  stop(): void { this.running = false; }

  /** Agenda pássaros e música; chamar todo quadro. */
  update(playerPos: { x: number; y: number; z: number }): void {
    if (!this.ctx || !this.running) return;
    const t = this.ctx.currentTime;
    this.tension.gain.setTargetAtTime(this.tensionTarget * 0.12, t, 0.3);
    if (t > this.nextBird) { this.nextBird = t + 2.5 + Math.random() * 5; this.bird(playerPos); }
    // Música generativa: acordes suaves + notas pentatônicas
    const chords = [[48, 55, 59, 64], [45, 52, 57, 64], [41, 48, 55, 60], [43, 50, 55, 62]];
    if (t > this.nextNote) {
      const c = chords[this.chordIdx % 4];
      const step = Math.floor((t * 0.5) % 8);
      if (step === 0 || this.nextNote === 0) { for (const n of c) this.tone(this.mtof(n), 4.2, 0.05, 'sine', this.buses.music, 1.2); this.chordIdx++; }
      const pent = [60, 62, 64, 67, 69, 72, 74];
      this.tone(this.mtof(pent[Math.floor(Math.random() * pent.length)]), 1.6, 0.045, 'triangle', this.buses.music, 0.02);
      this.nextNote = t + (step % 2 === 0 ? 0.5 : 0.9) + Math.random() * 0.6;
      if (step === 0) this.nextNote = t + 4.0;
    }
  }

  private mtof(n: number): number { return 440 * Math.pow(2, (n - 69) / 12); }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType, bus: GainNode, attack = 0.01, dest?: AudioNode): void {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? bus); o.start(t); o.stop(t + dur + 0.05);
  }

  private bird(p: { x: number; y: number; z: number }): void {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 60;
    const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 12; pan.rolloffFactor = 1.4;
    pan.positionX.value = p.x + Math.sin(ang) * dist; pan.positionY.value = 12 + Math.random() * 20; pan.positionZ.value = p.z + Math.cos(ang) * dist;
    pan.connect(this.buses.ambient);
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1800;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const s = t + i * 0.13;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.5), s + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.55, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1);
      o.connect(g); g.connect(pan); o.start(s); o.stop(s + 0.12);
    }
  }

  /* ---------- efeitos ---------- */
  footstep(surface: Surface, run: boolean): void {
    if (!this.ctx) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const cfg: Record<Surface, [number, number, number]> = { soil: [500, 1.2, 0.16], leaf: [2200, 1.5, 0.12], stone: [3200, 5, 0.1], wood: [900, 3, 0.14], moss: [350, 0.8, 0.1] };
    const [f, q, v] = cfg[surface];
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.9 + Math.random() * 0.2); bp.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v * (run ? 1.2 : 0.8), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp); bp.connect(g); g.connect(this.buses.sfx);
    src.start(t, Math.random() * 2, 0.1);
  }
  jump(): void { if (this.ctx) this.sweep(260, 520, 0.14, 0.12); }
  bounce(): void { if (this.ctx) this.sweep(180, 720, 0.28, 0.14); }
  land(): void { if (this.ctx) this.footstep('soil', true); }
  collect(): void { if (!this.ctx) return; this.tone(880, 0.35, 0.18, 'sine', this.buses.sfx); setTimeout(() => this.ctx && this.tone(1320, 0.5, 0.15, 'sine', this.buses.sfx), 90); }
  interact(): void { if (this.ctx) this.tone(520, 0.12, 0.1, 'triangle', this.buses.sfx); }
  blip(): void { if (this.ctx) this.tone(300 + Math.random() * 120, 0.06, 0.07, 'triangle', this.buses.dialog); }
  observe(on: boolean): void { if (this.ctx) this.sweep(on ? 300 : 600, on ? 600 : 300, 0.25, 0.08); }
  cameraSwitch(): void { if (this.ctx) this.tone(660, 0.08, 0.06, 'square', this.buses.sfx); }
  complete(): void {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.ctx && this.tone(f, 0.9, 0.14, 'sine', this.buses.sfx), i * 140));
  }
  checkpoint(): void { if (this.ctx) { this.tone(587, 0.4, 0.1, 'sine', this.buses.sfx); setTimeout(() => this.ctx && this.tone(880, 0.5, 0.1, 'sine', this.buses.sfx), 120); } }
  warn(): void {
    if (!this.ctx) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(lp); lp.connect(g); g.connect(this.buses.sfx); o.start(t); o.stop(t + 0.65);
  }
  private sweep(a: number, b: number, dur: number, vol: number): void {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.buses.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
}
