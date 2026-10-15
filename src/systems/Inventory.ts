export type ItemId = 'dew' | 'seed' | 'fiber';

export const ITEM_INFO: Record<ItemId, { name: string; icon: string }> = {
  dew: { name: 'Gota de orvalho', icon: '💧' },
  seed: { name: 'Semente', icon: '🌱' },
  fiber: { name: 'Fibra vegetal', icon: '🧵' },
};

export class Inventory {
  private items = new Map<ItemId, number>();

  add(id: ItemId, n = 1): number {
    const v = (this.items.get(id) ?? 0) + n;
    this.items.set(id, v);
    return v;
  }
  count(id: ItemId): number { return this.items.get(id) ?? 0; }
  /** Consome `n` itens. Retorna false (sem alterar nada) se não houver o suficiente. */
  remove(id: ItemId, n = 1): boolean {
    if (this.count(id) < n) return false;
    this.items.set(id, this.count(id) - n);
    return true;
  }
  entries(): [ItemId, number][] { return [...this.items.entries()].filter(([, n]) => n > 0); }
  serialize(): Record<string, number> { return Object.fromEntries(this.items); }
  load(data: Record<string, number> | undefined): void {
    this.items.clear();
    for (const [k, v] of Object.entries(data ?? {})) if (k in ITEM_INFO && v > 0) this.items.set(k as ItemId, v);
  }
}
