import type { DialogueDef } from '../systems/Dialogue';
import type { QuestLog } from '../systems/Quests';

const D: Record<string, DialogueDef> = {
  tito_intro: {
    id: 'tito_intro', speaker: 'Tito',
    lines: [
      'Ora, ora… uma joaninha! Você caiu do céu depois daquela tempestade, não foi?',
      'Eu sou o Tito. Passo os dias lendo a umidade das trilhas. O jardim está estranho desde a chuva.',
      'A saída fica adiante, mas a folha-portão está seca e enrolada. Ela só abre se for molhada com cinco gotas de orvalho.',
      'Procure gotas nas pedras e nas folhas altas. E lembre-se: você tem asas! Segure ESPAÇO (ou o botão de salto) no ar para planar.',
      'Aperte Q para observar o ambiente — tudo o que for importante brilha. Boa sorte, pequena!',
    ],
    onEnd: ['unlockGlide', 'talk:tito'],
  },
  tito_again: {
    id: 'tito_again', speaker: 'Tito',
    lines: ['Cinco gotas de orvalho para a folha-portão. Nas pedras, nas folhas altas… e olhe para cima, o caule do capim leva longe.'],
  },
  tito_gate_ready: {
    id: 'tito_gate_ready', speaker: 'Tito',
    lines: ['Já tem as gotas! Vá até a folha-portão, no fim do jardim. Ela vai agradecer.'],
  },
  tito_after: {
    id: 'tito_after', speaker: 'Tito',
    lines: ['O caminho está aberto. Vá, Marieta. A mata é grande, mas você é maior do que pensa.'],
  },
  tito_end_default: {
    id: 'tito_end_default', speaker: 'Tito',
    lines: ['Cheguei antes de você? Peguei um atalho pela folha molhada. Segredo de caracol!', 'Se encontrar sementes pelo jardim, traga-as para mim. Eu adoro plantar coisas.'],
  },
  tito_end_seeds: {
    id: 'tito_end_seeds', speaker: 'Tito',
    lines: ['Três sementes! Que tesouro. Vou plantá-las perto do abrigo — um dia este jardim terá um bosque.', 'Obrigado, Marieta. Dizem que, para além da floresta, um besouro de brilho esmeralda anda ajudando quem se perde…'],
    onEnd: ['talk:tito_end'],
  },
  tito_end_finish: {
    id: 'tito_end_finish', speaker: 'Tito',
    lines: ['Quando estiver pronta, siga adiante. O Tronco dos Segredos espera por você.'],
  },
};

/** Escolhe o diálogo de um NPC conforme o estado das missões. */
export function pickDialogue(npc: string, q: QuestLog): DialogueDef {
  if (npc === 'tito') {
    const st = q.state('jardim');
    if (st.status === 'active' && st.objective === 0) return D.tito_intro;
    if (st.status === 'active' && st.objective === 1) return D.tito_again;
    if (st.status === 'active' && st.objective === 2) return D.tito_gate_ready;
    return D.tito_after;
  }
  // tito_end
  const seeds = q.state('sementes');
  if (seeds.status === 'active' && seeds.objective === 1) return D.tito_end_seeds;
  if (seeds.status === 'done') return D.tito_end_finish;
  return D.tito_end_default;
}
