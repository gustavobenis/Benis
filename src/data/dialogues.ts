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

const R: Record<string, DialogueDef> = {
  lino_intro: {
    id: 'lino_intro', speaker: 'Lino',
    lines: [
      'Opa! Uma joaninha! Eu sou o Lino, formiga trabalhadora. Trabalho nesta margem desde antes do sol nascer.',
      'O rio cresceu depois da tempestade. A correnteza leva qualquer um que ficar na água por muito tempo!',
      'Eu sei construir uma ponte com folhas especiais, mas preciso de três. Procure-as nesta margem, as boas têm um brilho verde.',
      'Se preferir arriscar, há pedras e folhas flutuantes. Mas cuidado: se a água te pegar, ela não perdoa.',
    ],
    onEnd: ['talk:lino'],
  },
  lino_again: { id: 'lino_again', speaker: 'Lino', lines: ['Três folhas especiais, certo? Elas brilham em verde. Olhe nas pedras e perto dos cogumelos.'] },
  lino_bridge: { id: 'lino_bridge', speaker: 'Lino', lines: ['Você tem as folhas! Venha até a beira do rio, perto de mim, e vamos construir a ponte juntos.'] },
  lino_after: { id: 'lino_after', speaker: 'Lino', lines: ['Boa travessia, Marieta! Fale com a Luna, na outra margem. Ela conhece tudo por aqui.'] },
  luna_early: { id: 'luna_early', speaker: 'Luna', lines: ['Vejo você daí, pequena! Ainda não dá para conversar com o rio no meio. Chegue até aqui.'] },
  luna_intro: {
    id: 'luna_intro', speaker: 'Luna',
    lines: [
      'Que corajosa! Eu sou a Luna. Sou borboleta, e das alturas vejo tudo o que acontece na mata.',
      'Vi alguém ajudando os que se perdem perto da água: um besouro de carapaça verde-esmeralda, chamado Beto.',
      'Ele está logo adiante, perto da grande pedra. Vá encontrá-lo!',
    ],
    onEnd: ['talk:luna'],
  },
  luna_after: { id: 'luna_after', speaker: 'Luna', lines: ['Beto fica logo adiante, perto da grande pedra. Ele é gentil, você vai gostar dele.'] },
  beto_rescue: {
    id: 'beto_rescue', speaker: 'Beto',
    lines: [
      'Calma, calma! Segure firme. A correnteza levou você, mas eu te peguei.',
      'Eu sou o Beto. Costumo ficar por aqui para ajudar quem cai no rio.',
      'Você está bem? Que bom! Vi que não desistiu de atravessar. Isso é coragem de verdade.',
      'Descanse um pouco. Quando quiser, fale comigo de novo.',
    ],
    onEnd: ['flag:metBeto'],
  },
  beto_intro: {
    id: 'beto_intro', speaker: 'Beto',
    lines: [
      'Então é você a joaninha de quem a Luna falou! Prazer, eu sou o Beto.',
      'Cuido desta margem. Quem atravessa o rio costuma chegar assustado, mas você chegou com um sorriso.',
      'Se você precisar de ajuda, é só chamar. A mata é grande, mas não precisa ser enfrentada sozinha.',
      'Tem uma floresta logo adiante, cheia de desafios. Vamos juntos?',
    ],
    onEnd: ['flag:metBeto', 'talk:beto'],
  },
  beto_after: { id: 'beto_after', speaker: 'Beto', lines: ['A Floresta nos espera. Estou pronto quando você estiver, Marieta.'] },
};

/** Diálogos da Fase 2 conforme o estado das missões. */
export function pickRioDialogue(npc: string, q: QuestLog, flags: Set<string>): DialogueDef {
  const st = q.state('rio');
  if (npc === 'lino') {
    if (st.status === 'active' && st.objective === 0) return R.lino_intro;
    if (st.status === 'active' && st.objective === 1) return R.lino_again;
    if (st.status === 'active' && st.objective === 2) return R.lino_bridge;
    return R.lino_after;
  }
  if (npc === 'luna') {
    if (st.status === 'active' && st.objective === 4) return R.luna_intro;
    if (st.status === 'active' && st.objective < 4) return R.luna_early;
    return R.luna_after;
  }
  // beto
  if (st.status === 'active' && st.objective === 5) return R.beto_intro;
  if (!flags.has('metBeto')) return R.beto_rescue;
  return R.beto_after;
}

const F: Record<string, DialogueDef> = {
  tico_intro: {
    id: 'tico_intro', speaker: 'Tico',
    lines: [
      'Pulo, pulo, pulo! Olha só quem chegou à floresta! Eu sou o Tico, o gafanhoto mais divertido da mata!',
      'Aqui é escuro e cheio de desafios. Os troncos viram túneis, as raízes viram degraus… e os cogumelos cor-de-rosa são trampolins!',
      'Cuidado com a aranha-caçadora, de olhos vermelhos. Ela patrulha o centro da floresta e enxerga bem de frente. Esconda-se debaixo dos troncos!',
      'Para passar pela muralha de teia, acenda o altar de cristais. Há três cristais de luz lá no alto, quique nos cogumelos para alcançá-los!',
    ],
    onEnd: ['talk:tico'],
  },
  tico_again: { id: 'tico_again', speaker: 'Tico', lines: ['Três cristais de luz, lá no alto! Quique nos cogumelos cor-de-rosa e use as asas para alcançar as folhas.'] },
  tico_altar: { id: 'tico_altar', speaker: 'Tico', lines: ['Com os cristais, vá até o altar no meio da floresta, depois da aranha-caçadora. Ele acende e rompe a teia!'] },
  tico_after: { id: 'tico_after', speaker: 'Tico', lines: ['Você é demais, Marieta! Vá até a clareira, Dona Olívia espera por você.'] },
  olivia_early: { id: 'olivia_early', speaker: 'Dona Olívia', lines: ['Estou ouvindo seus passos, pequena. Venha até a clareira, a teia já não impede.'] },
  olivia_intro: {
    id: 'olivia_intro', speaker: 'Dona Olívia',
    lines: [
      'Bem-vinda, minha querida. Eu sou a Dona Olívia. Cuido desta floresta e de quem passa por ela.',
      'Não se assuste com minha aparência: nem toda aranha é caçadora. Minhas teias protegem a mata das tempestades.',
      'Você enfrentou a floresta com coragem e astúcia. Há uma colônia depois daqui que precisa de ajuda.',
      'Siga em frente. Beto e os outros vão estar com você.',
    ],
    onEnd: ['talk:olivia'],
  },
  olivia_after: { id: 'olivia_after', speaker: 'Dona Olívia', lines: ['A colônia espera por você, Marieta. Vá com cuidado e confie nos amigos.'] },
};

/** Diálogos da Fase 3 conforme o estado das missões. */
export function pickForestDialogue(npc: string, q: QuestLog): DialogueDef {
  const st = q.state('floresta');
  if (npc === 'tico') {
    if (st.status === 'active' && st.objective === 0) return F.tico_intro;
    if (st.status === 'active' && st.objective === 1) return F.tico_again;
    if (st.status === 'active' && st.objective === 2) return F.tico_altar;
    return F.tico_after;
  }
  if (st.status === 'active' && st.objective === 4) return F.olivia_intro;
  if (st.status === 'active' && st.objective < 4) return F.olivia_early;
  return F.olivia_after;
}
