import type { QuestDef } from '../systems/Quests';

/** Missões da Fase 1 — O Jardim das Gotas. */
export const LEVEL1_QUESTS: QuestDef[] = [
  {
    id: 'jardim',
    title: 'A saída do jardim',
    objectives: [
      { id: 'tito', text: 'Converse com Tito, o caracol', type: 'talk', target: 'tito' },
      { id: 'gotas', text: 'Colete gotas de orvalho', type: 'collect', target: 'dew', count: 5 },
      { id: 'portao', text: 'Molhe a folha-portão para abri-la', type: 'interact', target: 'leafgate' },
      { id: 'abrigo', text: 'Encontre o abrigo do outro lado', type: 'reach', target: 'shelter' },
    ],
  },
  {
    id: 'sementes',
    title: 'Sementes para Tito',
    optional: true,
    objectives: [
      { id: 'colher', text: 'Encontre as sementes escondidas no jardim', type: 'collect', target: 'seed', count: 3 },
      { id: 'entregar', text: 'Entregue as sementes a Tito, no abrigo', type: 'talk', target: 'tito_end' },
    ],
  },
];

/** Missões da Fase 2 — O Rio (Novos Amigos). */
export const LEVEL2_QUESTS: QuestDef[] = [
  {
    id: 'rio',
    title: 'Atravessar o rio',
    objectives: [
      { id: 'lino', text: 'Converse com Lino, a formiga', type: 'talk', target: 'lino' },
      { id: 'folhas', text: 'Colete folhas especiais para a ponte', type: 'collect', target: 'leaf', count: 3 },
      { id: 'ponte', text: 'Construa a ponte no rio com Lino', type: 'interact', target: 'bridge' },
      { id: 'margem', text: 'Atravesse até a outra margem', type: 'reach', target: 'north' },
      { id: 'luna', text: 'Converse com Luna, a borboleta', type: 'talk', target: 'luna' },
      { id: 'beto', text: 'Encontre Beto, o besouro', type: 'talk', target: 'beto' },
    ],
  },
  {
    id: 'tesouros',
    title: 'Tesouros do rio',
    optional: true,
    objectives: [{ id: 'cristais', text: 'Encontre os cristais naturais do rio', type: 'collect', target: 'crystal', count: 2 }],
  },
];

/** Missões da Fase 3 — A Floresta (Desafios). */
export const LEVEL3_QUESTS: QuestDef[] = [
  {
    id: 'floresta',
    title: 'Atravessar a floresta',
    objectives: [
      { id: 'tico', text: 'Converse com Tico, o gafanhoto', type: 'talk', target: 'tico' },
      { id: 'cristais', text: 'Colete os cristais de luz nas alturas', type: 'collect', target: 'crystal', count: 3 },
      { id: 'altar', text: 'Acenda o altar de cristais para romper a teia', type: 'interact', target: 'altar' },
      { id: 'clareira', text: 'Chegue à clareira de Dona Olívia', type: 'reach', target: 'clearing' },
      { id: 'olivia', text: 'Converse com Dona Olívia, a aranha protetora', type: 'talk', target: 'olivia' },
    ],
  },
  {
    id: 'cogumelos',
    title: 'Flores da penumbra',
    optional: true,
    objectives: [{ id: 'flores', text: 'Encontre as flores raras da floresta', type: 'collect', target: 'flower', count: 2 }],
  },
];

/** Missões da Fase 4 — A Colônia (Em Perigo). */
export const LEVEL4_QUESTS: QuestDef[] = [
  {
    id: 'colonia',
    title: 'Salvar a colônia',
    objectives: [
      { id: 'lino', text: 'Converse com Lino, na entrada da colônia', type: 'talk', target: 'lino' },
      { id: 'sementes', text: 'Recolha sementes para o celeiro', type: 'collect', target: 'seed', count: 4 },
      { id: 'celeiro', text: 'Abasteça o celeiro para abrir a barricada', type: 'interact', target: 'granary' },
      { id: 'camara', text: 'Chegue à câmara da Rainha', type: 'reach', target: 'chamber' },
      { id: 'rainha', text: 'Converse com a Rainha Formiga', type: 'talk', target: 'rainha' },
    ],
  },
  {
    id: 'cristais_col',
    title: 'Tesouros do formigueiro',
    optional: true,
    objectives: [{ id: 'cr', text: 'Encontre os cristais escondidos na colônia', type: 'collect', target: 'crystal', count: 2 }],
  },
];
