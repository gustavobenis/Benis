import type { Settings } from '../systems/Settings';
import { ITEM_INFO, ITEM_ORDER, type Inventory, type ItemId } from '../systems/Inventory';
import type { QuestLog } from '../systems/Quests';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} ausente do HTML`);
  return el as T;
};

type ScreenId = 'loading' | 'menu' | 'pause' | 'settings' | 'controls' | 'complete' | 'credits';
const SCREENS: ScreenId[] = ['loading', 'menu', 'pause', 'settings', 'controls', 'complete', 'credits'];

/** As 8 fases da arte de referência; só as marcadas `ready` existem. */
export const PHASES = [
  { name: 'O Jardim', sub: 'Início da Jornada', art: 'radial-gradient(circle at 40% 35%,#9fe07a,#2e7a4a 70%)' },
  { name: 'O Rio', sub: 'Novos Amigos', art: 'radial-gradient(circle at 40% 35%,#bfeee6,#2f7f8f 70%)' },
  { name: 'A Floresta', sub: 'Desafios', art: 'radial-gradient(circle at 40% 35%,#8fd08a,#1d5436 70%)' },
  { name: 'A Colônia', sub: 'Em Perigo', art: 'radial-gradient(circle at 40% 35%,#f1b46a,#7a4a22 70%)' },
  { name: 'A Tempestade', sub: 'Grande Prova', art: 'radial-gradient(circle at 40% 35%,#6b7fb8,#1d2340 70%)' },
  { name: 'O Vale das Flores', sub: 'Esperança', art: 'radial-gradient(circle at 40% 35%,#f58ac0,#7a3f88 70%)' },
  { name: 'O Ninho Verde', sub: 'Um Novo Lar', art: 'radial-gradient(circle at 40% 35%,#c9e07a,#4b7a2a 70%)' },
  { name: 'Juntos Sempre', sub: 'Final', art: 'radial-gradient(circle at 40% 35%,#ffcf8a,#b4582e 70%)' },
];
export const READY_PHASES = 8;

export interface UIHandlers {
  newGame(level: number): void; continueGame(): void; resume(): void; toMenu(): void; freeRoam(): void; nextLevel(): void;
  settingsChanged(s: Settings): void; drawMap(c: HTMLCanvasElement): void; advanceDialogue(): void;
  closeSettings(): void; closeControls(): void; startFlight(): void; nextScenery(): void;
}

const SLIDERS: [keyof Settings, string, number, number, number][] = [
  ['master', 'Volume geral', 0, 1, 0.05], ['music', 'Música', 0, 1, 0.05], ['ambient', 'Ambiente', 0, 1, 0.05],
  ['sfx', 'Efeitos', 0, 1, 0.05], ['dialog', 'Diálogos', 0, 1, 0.05],
  ['sensitivity', 'Sensibilidade da câmera', 0.3, 2.5, 0.1], ['cameraDistance', 'Distância da câmera', 0.6, 1.8, 0.1], ['uiScale', 'Tamanho da interface', 0.8, 1.4, 0.05],
];

export class UI {
  private toastTimer = 0; private hintTimer = 0; private typing = { text: '', i: 0, done: true, acc: 0 };
  private lastObj = '';
  onBlip: () => void = () => {};

  constructor(private h: UIHandlers, private settings: () => Settings) {
    $('btn-new').onclick = () => h.newGame(1);
    $('btn-fly').onclick = () => h.startFlight();
    $('b-scene').onclick = () => h.nextScenery();
    $('btn-credits').onclick = () => this.showScreen('credits');
    $('credits-close').onclick = () => this.showScreen('menu');
    $('complete-next').onclick = () => h.nextLevel();
    $('btn-continue').onclick = () => h.continueGame();
    $('btn-settings').onclick = () => { this.showScreen('settings'); this.buildSettings(); };
    $('btn-controls').onclick = () => { this.showScreen('controls'); this.buildControls(); };
    $('settings-close').onclick = () => h.closeSettings();
    $('controls-close').onclick = () => h.closeControls();
    $('complete-free').onclick = () => h.freeRoam();
    $('complete-menu').onclick = () => h.toMenu();
    $('dialogue').addEventListener('pointerdown', (e) => { e.preventDefault(); h.advanceDialogue(); });
    $('pause-nav').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      const act = b.dataset.act, tab = b.dataset.tab;
      if (act === 'resume') h.resume();
      else if (act === 'menu') h.toMenu();
      else if (act === 'settings') { this.showScreen('settings'); this.buildSettings(); }
      else if (act === 'controls') { this.showScreen('controls'); this.buildControls(); }
      else if (tab) this.pauseTab(tab);
    });
  }

  /* ---------- telas ---------- */
  showScreen(id: ScreenId | null): void { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  isOpen(id: ScreenId): boolean { return !$(id).classList.contains('hidden'); }
  setHud(on: boolean): void { $('hud').classList.toggle('hidden', !on); }
  setTouch(on: boolean): void { $('touch').classList.toggle('hidden', !on); document.body.classList.toggle('touch', on); }
  setLoading(p: number): void { $('loadbar').style.width = `${Math.round(p * 100)}%`; }
  loadError(msg: string): void { const e = $('loaderr'); e.textContent = msg; e.classList.remove('hidden'); }
  enableContinue(on: boolean): void { ($('btn-continue') as HTMLButtonElement).disabled = !on; }
  applyScale(): void { document.documentElement.style.setProperty('--ui', String(this.settings().uiScale)); }
  /** Liga/desliga o visual do modo de voo (HUD de altitude/velocidade, botões de toque renomeados). */
  setFlightUi(on: boolean): void {
    document.body.classList.toggle('flight', on);
    const lab = (id: string, icon: string, text: string) => { $(id).innerHTML = `${icon}<small>${text}</small>`; };
    if (on) { lab('t-jump', '⤒', 'Subir'); lab('t-interact', '⤓', 'Descer'); lab('t-observe', '⚡', 'Turbo'); }
    else { lab('t-jump', '⤒', 'Pular'); lab('t-interact', '✋', 'Agir'); lab('t-observe', '👁', 'Observar'); }
  }
  flightInfo(alt: number, speed: number, scenery: string): void {
    $('fl-alt').textContent = `${Math.max(0, alt).toFixed(0)} m`; $('fl-spd').textContent = `${(speed * 3.6).toFixed(0)} km/h`; $('fl-name').textContent = scenery;
  }
  bindFullscreen(): void {
    const b = $('b-full'); const doc = document as Document & { webkitFullscreenElement?: Element };
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (!root.requestFullscreen && !root.webkitRequestFullscreen) { b.classList.add('hidden'); return; }
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    b.addEventListener('click', () => {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) void document.exitFullscreen?.();
      else { void (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.()); (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); }
    });
  }
  fade(on: boolean): void { $('fade').classList.toggle('on', on); }

  touchElements() {
    return { joyZone: $('joy-zone'), joyBase: $('joy-base'), joyKnob: $('joy-knob'), lookZone: $('look-zone'),
      buttons: { jump: $('t-jump'), interact: $('t-interact'), observe: $('t-observe'), camera: $('b-camera'), pause: $('b-pause') } };
  }

  /* ---------- HUD ---------- */
  setObjective(quest: string, text: string, progress?: { n: number; of: number }): void {
    const key = quest + text + (progress ? `${progress.n}/${progress.of}` : '');
    if (key === this.lastObj) return; this.lastObj = key;
    $('obj-quest').textContent = quest;
    $('obj-text').textContent = progress ? `${text} (${progress.n}/${progress.of})` : text;
    $('obj-pbar').classList.toggle('hidden', !progress);
    if (progress) $('obj-bar').style.width = `${(progress.n / progress.of) * 100}%`;
  }
  setItems(inv: Inventory): void {
    const list = inv.entries();
    const shown: [ItemId, number][] = list.length ? list : [['dew', 0], ['seed', 0]];
    $('items').innerHTML = shown.map(([id, n]) => `<span class="slot" title="${ITEM_INFO[id].name}"><i class="ic" style="background:${ITEM_INFO[id].art}"></i>${n}</span>`).join('');
  }
  private lastHearts = '';
  setHearts(n: number, max: number): void {
    const key = `${n}/${max}`; if (key === this.lastHearts) return; this.lastHearts = key;
    let h = '';
    for (let i = 0; i < max; i++) h += `<svg viewBox="0 0 24 22" role="img" aria-label="Coração ${i + 1}"><path d="M12 21C5 15 1 11.5 1 7.2 1 4 3.5 1.5 6.6 1.5c2 0 3.9 1 5.4 3 1.5-2 3.4-3 5.4-3C20.5 1.5 23 4 23 7.2 23 11.5 19 15 12 21Z" fill="${i < n ? '#e53550' : '#3a3a3a'}" stroke="#fff" stroke-width="1.5"/></svg>`;
    $('hearts').innerHTML = h;
  }
  /** Faixa de seleção de fases (arte de referência). */
  buildLevels(unlocked: number, current: number): void {
    $('levels-row').innerHTML = '';
    PHASES.forEach((p, i) => {
      const n = i + 1, ok = n <= Math.min(unlocked, READY_PHASES);
      const b = document.createElement('button');
      b.className = `phase${ok ? '' : ' locked'}${n === current ? ' cur' : ''}`;
      b.disabled = !ok; b.setAttribute('aria-label', `Fase ${n}: ${p.name}${ok ? '' : ' (bloqueada)'}`);
      b.innerHTML = `<span class="disc" style="background:${p.art}">${ok ? '' : '<i class="lock">🔒</i>'}</span><b>${n}. ${p.name}</b><span>${n > READY_PHASES ? 'Em breve' : p.sub}</span>`;
      if (ok) b.onclick = () => this.h.newGame(n);
      $('levels-row').appendChild(b);
    });
  }

  toast(text: string, ms = 2600): void {
    const t = $('toast'); t.textContent = text; t.classList.remove('hidden');
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
  }
  hint(text: string | null, ms = 7000): void {
    const t = $('hint'); clearTimeout(this.hintTimer);
    if (!text) { t.classList.add('hidden'); return; }
    t.textContent = text; t.classList.remove('hidden'); this.hintTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
  }
  prompt(text: string | null): void {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    if (p.textContent !== text) p.textContent = text;
    p.classList.remove('hidden');
  }
  danger(level: number): void { $('danger').style.opacity = String(Math.min(1, level)); }
  cameraLabel(text: string): void {
    const el = $('cam-label'); el.textContent = text; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1400);
  }
  minimap(): HTMLCanvasElement { return $('minimap') as HTMLCanvasElement; }

  /* ---------- diálogo ---------- */
  /** Ícone de cada personagem na caixa de diálogo. */
  private static readonly ICONS: Record<string, string> = {
    Tito: '🐌', 'Sr. Caramujo': '🐌', Lino: '🐜', 'Rainha Formiga': '👑', Luna: '🦋', Beto: '🪲', Dário: '🪲', Tico: '🦗', Freddy: '🎸',
    'Dona Olívia': '🕷️', Zuzu: '🐛', Rita: '🪰',
  };
  showDialogue(speaker: string, text: string): void {
    $('dialogue').classList.remove('hidden');
    $('dlg-icon').textContent = UI.ICONS[speaker] ?? '💬';
    $('dlg-name').textContent = speaker;
    this.typing = { text, i: 0, done: false, acc: 0 };
    $('dlg-text').textContent = '';
  }
  hideDialogue(): void { $('dialogue').classList.add('hidden'); }
  get typingDone(): boolean { return this.typing.done; }
  finishTyping(): void { this.typing.done = true; this.typing.i = this.typing.text.length; $('dlg-text').textContent = this.typing.text; }
  tickDialogue(dt: number): void {
    const t = this.typing; if (t.done) return;
    t.acc += dt * 55;
    while (t.acc >= 1 && t.i < t.text.length) { t.acc -= 1; t.i++; if (t.i % 3 === 0 && t.text[t.i - 1] !== ' ') this.onBlip(); }
    $('dlg-text').textContent = t.text.slice(0, t.i);
    if (t.i >= t.text.length) t.done = true;
  }

  /* ---------- pausa ---------- */
  openPause(): void { this.showScreen('pause'); $('pause-body').innerHTML = ''; }
  private pauseTab(tab: string): void {
    const body = $('pause-body');
    if (tab === 'inv') {
      const inv = this.inventoryRef;
      body.innerHTML = '<h3>Itens colecionáveis</h3><div class="collect">' + ITEM_ORDER.map((id) => {
        const n = inv?.count(id) ?? 0, it = ITEM_INFO[id];
        return `<div class="citem${n ? '' : ' zero'}"><i class="ic" style="background:${it.art}"></i><div><b>${it.plural}</b><small>${it.use}</small><em>${n}</em></div></div>`;
      }).join('') + '</div>';
    } else if (tab === 'journal') {
      const q = this.questsRef;
      body.innerHTML = '<h3>Diário de missões</h3>' + (q ? q.all().map((d) => {
        const st = q.state(d.id);
        if (st.status === 'locked') return '';
        const objs = d.objectives.map((o, i) => {
          const done = st.status === 'done' || i < st.objective;
          const prog = !done && i === st.objective && (o.count ?? 1) > 1 ? ` (${st.progress}/${o.count})` : '';
          return `<div class="${done ? 'done' : ''}">${done ? '✔' : i === st.objective ? '▶' : '·'} ${o.text}${prog}</div>`;
        }).join('');
        return `<div class="quest"><b>${d.title}</b>${d.optional ? '<span class="tagopt">opcional</span>' : ''}${st.status === 'done' ? ' ✅' : ''}${objs}</div>`;
      }).join('') : '');
    } else if (tab === 'map') {
      body.innerHTML = '<h3>Mapa do jardim</h3><canvas id="bigmap" width="240" height="400"></canvas>';
      this.h.drawMap($('bigmap') as HTMLCanvasElement);
    }
  }
  inventoryRef: Inventory | null = null; questsRef: QuestLog | null = null;

  /* ---------- configurações ---------- */
  buildSettings(): void {
    const s = this.settings(); const body = $('settings-body'); body.innerHTML = '';
    const emit = () => { this.applyScale(); this.h.settingsChanged(s); };
    for (const [k, label, lo, hi, step] of SLIDERS) {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="${lo}" max="${hi}" step="${step}" value="${s[k] as number}">`;
      (row.querySelector('input') as HTMLInputElement).oninput = (e) => { (s[k] as number) = Number((e.target as HTMLInputElement).value); emit(); };
      body.appendChild(row);
    }
    const selects: [keyof Settings, string, [string, string][]][] = [
      ['quality', 'Qualidade gráfica', [['auto', 'Automática'], ['eco', 'Econômica'], ['balanced', 'Equilibrada'], ['high', 'Alta']]],
      ['difficulty', 'Dificuldade', [['calm', 'História tranquila'], ['balanced', 'Aventura equilibrada'], ['explorer', 'Exploradora']]],
    ];
    for (const [k, label, opts] of selects) {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label for="s-${k}">${label}</label><select id="s-${k}">${opts.map(([v, t]) => `<option value="${v}" ${s[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      (row.querySelector('select') as HTMLSelectElement).onchange = (e) => { (s[k] as string) = (e.target as HTMLSelectElement).value; emit(); };
      body.appendChild(row);
    }
    const checks: [keyof Settings, string][] = [['invertY', 'Inverter eixo vertical da câmera'], ['reduceMotion', 'Reduzir movimento (balanço de câmera)'], ['visualAssist', 'Assistência visual (mostrar itens no mapa)']];
    for (const [k, label] of checks) {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label for="s-${k}">${label}</label><input id="s-${k}" type="checkbox" ${s[k] ? 'checked' : ''}>`;
      (row.querySelector('input') as HTMLInputElement).onchange = (e) => { (s[k] as boolean) = (e.target as HTMLInputElement).checked; emit(); };
      body.appendChild(row);
    }
  }

  buildControls(): void {
    $('controls-body').innerHTML = `
      <table class="keys">
        <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / setas</td><td>Mover</td></tr>
        <tr><td><kbd>Shift</kbd></td><td>Correr</td></tr>
        <tr><td><kbd>Espaço</kbd></td><td>Pular · segure no ar para planar (após aprender com Tito)</td></tr>
        <tr><td><kbd>W</kbd> junto a um caule verde</td><td>Escalar</td></tr>
        <tr><td><kbd>E</kbd></td><td>Interagir / conversar</td></tr>
        <tr><td><kbd>F</kbd></td><td>Alternar câmera (3ª pessoa → 1ª pessoa → orbital)</td></tr>
        <tr><td><kbd>Q</kbd></td><td>Modo de observação (realça itens e objetivos)</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Pausar</td></tr>
        <tr><td>Mouse / roda</td><td>Girar câmera (clique na tela para capturar) / distância</td></tr>
        <tr><td>Toque</td><td>Joystick à esquerda, arraste à direita para a câmera, botões Pular / Agir / Observar</td></tr>
        <tr><td>Controle</td><td>Analógico esquerdo move · direito câmera · A pula · X age · Y câmera · LB observa · Start pausa</td></tr>
      </table>`;
  }

  complete(d: { title: string; text: string; stats: string; next: boolean; final: boolean }): void {
    $('complete-title').textContent = d.title;
    $('complete-text').textContent = d.text;
    $('complete-stats').innerHTML = d.stats;
    $('complete-next').classList.toggle('hidden', !d.next);
    document.querySelector('#complete .sheet')?.classList.toggle('victory', d.final);
    this.showScreen('complete');
  }
}
