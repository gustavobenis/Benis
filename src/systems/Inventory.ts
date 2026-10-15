export type ItemId = 'dew' | 'seed' | 'leaf' | 'flower' | 'crystal' | 'photo';

/** Os seis tipos colecionáveis da arte de referência. `art` é o gradiente do ícone redondo. */
export const ITEM_INFO: Record<ItemId, { name: string; plural: string; use: string; art: string }> = {
  dew: { name: 'Gota de orvalho', plural: 'Gotas de Orvalho', use: 'Vida extra e portões', art: 'radial-gradient(circle at 35% 30%,#d6f4ee,#4aa3b0)' },
  seed: { name: 'Semente', plural: 'Sementes', use: 'Pontos e plantio', art: 'radial-gradient(circle at 35% 30%,#ffbe7a,#a05a1e)' },
  leaf: { name: 'Folha especial', plural: 'Folhas Especiais', use: 'Habilidades e pontes', art: 'radial-gradient(circle at 35% 30%,#bff09a,#2e7a4a)' },
  flower: { name: 'Flor rara', plural: 'Flores Raras', use: 'Colecionáveis', art: 'radial-gradient(circle at 35% 30%,#ff9ccb,#a6428c)' },
  crystal: { name: 'Cristal natural', plural: 'Cristais Naturais', use: 'Conquistas', art: 'radial-gradient(circle at 35% 30%,#bfe3ff,#4a6fd0)' },
  photo: { name: 'Foto da jornada', plural: 'Fotos da Jornada', use: 'Galeria', art: 'radial-gradient(circle at 35% 30%,#f1e6c8,#8a7a56)' },
};
export const ITEM_ORDER = Object.keys(ITEM_INFO) as ItemId[];

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
