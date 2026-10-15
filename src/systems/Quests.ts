/**
 * Sistema de missões orientado a eventos.
 *
 * Cada missão tem objetivos sequenciais. Um objetivo avança quando recebe um
 * evento compatível (`talk`, `collect`, `reach`, `interact`). Estados:
 * `locked` → `active` → `done`. Todo o estado é serializável para salvamento.
 */
export type GameEvent =
  | { type: 'talk'; target: string }
  | { type: 'collect'; item: string; amount?: number }
  | { type: 'reach'; target: string }
  | { type: 'interact'; target: string };

export interface ObjectiveDef {
  id: string;
  text: string;
  /** Tipo de evento que avança o objetivo. */
  type: GameEvent['type'];
  /** `target` (talk/reach/interact) ou `item` (collect). */
  target: string;
  count?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  optional?: boolean;
  /** Missão que precisa estar concluída para esta iniciar (ou vazio = ativa desde o início). */
  after?: string;
  objectives: ObjectiveDef[];
}

export type QuestStatus = 'locked' | 'active' | 'done';
export interface QuestState { status: QuestStatus; objective: number; progress: number }

export type QuestNotice =
  | { kind: 'started'; quest: QuestDef }
  | { kind: 'objective'; quest: QuestDef; objective: ObjectiveDef }
  | { kind: 'progress'; quest: QuestDef; objective: ObjectiveDef; progress: number; count: number }
  | { kind: 'completed'; quest: QuestDef };

export class QuestLog {
  private states = new Map<string, QuestState>();
  private listeners: ((n: QuestNotice) => void)[] = [];

  constructor(private defs: QuestDef[]) { this.reset(); }

  onNotice(fn: (n: QuestNotice) => void): void { this.listeners.push(fn); }
  private emit(n: QuestNotice): void { for (const l of this.listeners) l(n); }

  reset(): void {
    this.states.clear();
    for (const q of this.defs) this.states.set(q.id, { status: q.after ? 'locked' : 'active', objective: 0, progress: 0 });
  }

  /** Dispara notificações iniciais das missões já ativas (novo jogo). */
  announceActive(): void {
    for (const q of this.defs) if (this.status(q.id) === 'active') this.emit({ kind: 'started', quest: q });
  }

  def(id: string): QuestDef { const q = this.defs.find((d) => d.id === id); if (!q) throw new Error(`Missão desconhecida: ${id}`); return q; }
  status(id: string): QuestStatus { return this.states.get(id)?.status ?? 'locked'; }
  state(id: string): QuestState { return this.states.get(id) ?? { status: 'locked', objective: 0, progress: 0 }; }
  all(): QuestDef[] { return this.defs; }
  isDone(id: string): boolean { return this.status(id) === 'done'; }

  /** Objetivo atual de uma missão ativa. */
  currentObjective(id: string): ObjectiveDef | undefined {
    const st = this.state(id);
    return st.status === 'active' ? this.def(id).objectives[st.objective] : undefined;
  }

  /** Objetivo principal exibido no HUD: primeira missão ativa não opcional. */
  mainObjective(): { quest: QuestDef; objective: ObjectiveDef; progress: number } | undefined {
    for (const q of this.defs) {
      if (q.optional || this.status(q.id) !== 'active') continue;
      const st = this.state(q.id);
      return { quest: q, objective: q.objectives[st.objective], progress: st.progress };
    }
    return undefined;
  }

  handle(ev: GameEvent): void {
    for (const q of this.defs) {
      const st = this.states.get(q.id)!;
      if (st.status !== 'active') continue;
      const obj = q.objectives[st.objective];
      if (obj.type !== ev.type) continue;
      const key = ev.type === 'collect' ? ev.item : ev.target;
      if (obj.target !== key) continue;
      const count = obj.count ?? 1;
      st.progress += ev.type === 'collect' ? ev.amount ?? 1 : 1;
      if (st.progress < count) { this.emit({ kind: 'progress', quest: q, objective: obj, progress: st.progress, count }); continue; }
      st.progress = 0;
      st.objective++;
      if (st.objective >= q.objectives.length) {
        st.status = 'done';
        this.emit({ kind: 'completed', quest: q });
        this.unlockDependents(q.id);
      } else {
        this.emit({ kind: 'objective', quest: q, objective: q.objectives[st.objective] });
      }
    }
  }

  private unlockDependents(doneId: string): void {
    for (const q of this.defs) {
      const st = this.states.get(q.id)!;
      if (q.after === doneId && st.status === 'locked') { st.status = 'active'; this.emit({ kind: 'started', quest: q }); }
    }
  }

  serialize(): Record<string, QuestState> { return Object.fromEntries(this.states); }
  load(data: Record<string, QuestState> | undefined): void {
    this.reset();
    for (const [id, st] of Object.entries(data ?? {})) if (this.states.has(id)) this.states.set(id, { ...st });
  }
}
