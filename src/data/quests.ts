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
