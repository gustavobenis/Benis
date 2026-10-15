export interface DialogueDef {
  id: string;
  speaker: string;
  lines: string[];
  /** Eventos/ações nomeados disparados ao terminar o diálogo. */
  onEnd?: string[];
}

/** Executor simples: avança linha a linha e informa quando termina. */
export class DialogueRunner {
  private current: DialogueDef | null = null;
  private index = 0;

  get active(): boolean { return this.current !== null; }
  get speaker(): string { return this.current?.speaker ?? ''; }
  get line(): string { return this.current?.lines[this.index] ?? ''; }
  get isLast(): boolean { return !!this.current && this.index >= this.current.lines.length - 1; }

  start(d: DialogueDef): void { this.current = d; this.index = 0; }

  /** Avança. Retorna as ações finais quando o diálogo acaba, ou null enquanto continua. */
  advance(): string[] | null {
    if (!this.current) return null;
    if (this.index < this.current.lines.length - 1) { this.index++; return null; }
    const actions = this.current.onEnd ?? [];
    this.current = null;
    this.index = 0;
    return actions;
  }
}
