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

const C: Record<string, DialogueDef> = {
  lino_intro: {
    id: 'lino_intro', speaker: 'Lino',
    lines: [
      'Marieta! Você chegou à nossa colônia! Eu disse que nos reencontraríamos.',
      'Mas chegou numa hora ruim: um louva-a-deus está rondando o formigueiro e nossos celeiros estão quase vazios.',
      'Ele enxerga bem quem se move à vista e tem um alcance enorme. Fique debaixo dos túneis e das folhas, e só atravesse quando ele virar as costas.',
      'Precisamos de quatro sementes para reabastecer o celeiro central. Com ele cheio, abrimos a barricada e você chega à câmara da Rainha.',
    ],
    onEnd: ['talk:lino'],
  },
  lino_again: { id: 'lino_again', speaker: 'Lino', lines: ['Quatro sementes para o celeiro! Procure perto das pedras e sob os cogumelos. E cuidado com o louva-a-deus!'] },
  lino_granary: { id: 'lino_granary', speaker: 'Lino', lines: ['Já tem as sementes! Leve-as ao celeiro, ao pé do formigueiro grande.'] },
  lino_after: { id: 'lino_after', speaker: 'Lino', lines: ['A barricada está aberta! A Rainha está esperando você, Marieta.'] },
  rainha_early: { id: 'rainha_early', speaker: 'Rainha Formiga', lines: ['Eu sinto sua chegada, pequena. Venha até a minha câmara, quando o caminho estiver livre.'] },
  rainha_intro: {
    id: 'rainha_intro', speaker: 'Rainha Formiga',
    lines: [
      'Então é você a joaninha que abasteceu o nosso celeiro. A colônia inteira lhe agradece.',
      'O louva-a-deus não age por maldade, apenas por fome. Mas ele ameaça os meus filhos, e uma tempestade se aproxima.',
      'Vai ser a maior prova que a mata já viu. Quando ela chegar, precisaremos de todos: você, Beto e todos os amigos.',
      'Vá em frente. Que as folhas lhe sirvam de abrigo.',
    ],
    onEnd: ['talk:rainha'],
  },
  rainha_after: { id: 'rainha_after', speaker: 'Rainha Formiga', lines: ['A tempestade está chegando. Prepare-se, Marieta. A colônia estará com você.'] },
};

/** Diálogos da Fase 4 conforme o estado das missões. */
export function pickColonyDialogue(npc: string, q: QuestLog): DialogueDef {
  const st = q.state('colonia');
  if (npc === 'lino') {
    if (st.status === 'active' && st.objective === 0) return C.lino_intro;
    if (st.status === 'active' && st.objective === 1) return C.lino_again;
    if (st.status === 'active' && st.objective === 2) return C.lino_granary;
    return C.lino_after;
  }
  if (st.status === 'active' && st.objective === 4) return C.rainha_intro;
  if (st.status === 'active' && st.objective < 4) return C.rainha_early;
  return C.rainha_after;
}

const S: Record<string, DialogueDef> = {
  beto_intro: {
    id: 'beto_intro', speaker: 'Beto',
    lines: [
      'Marieta! Aqui, debaixo da folha! Venha, a chuva está cada vez mais forte.',
      'Eu disse que a gente se veria de novo. Desta vez, não vou deixar você enfrentar isso sozinha.',
      'A enchente cortou o caminho para a colina, onde o resto da comunidade se abrigou. Precisamos de três folhas firmes para fazer uma jangada.',
      'Cuidado com as rajadas de vento e com os raios: um círculo brilhante no chão avisa onde vai cair. Saia de dentro dele! Fique sob as folhas quando puder.',
      'Eu vou com você. Fazemos isso juntos.',
    ],
    onEnd: ['talk:beto', 'flag:betoJoined'],
  },
  beto_again: { id: 'beto_again', speaker: 'Beto', lines: ['Três folhas firmes para a jangada. Estou logo atrás de você, Marieta!'] },
  beto_raft: { id: 'beto_raft', speaker: 'Beto', lines: ['As folhas! Venha até a beira da enchente, e eu seguro enquanto você encaixa.'] },
  beto_after: { id: 'beto_after', speaker: 'Beto', lines: ['Conseguimos juntos! Agora vamos até a colina, antes que a água suba mais.'] },
  zuzu_early: { id: 'zuzu_early', speaker: 'Zuzu', lines: ['Aqui, aqui! Eu sou a Zuzu! Atravesse a enchente e venha conversar!'] },
  zuzu_intro: {
    id: 'zuzu_intro', speaker: 'Zuzu',
    lines: [
      'Vocês conseguiram! Eu sou a Zuzu, a lagarta mais engraçada da mata. Estávamos todos preocupados!',
      'Ver vocês dois atravessando juntos, debaixo daquela chuva… ninguém esquece uma coisa dessas.',
      'A tempestade vai passar. E depois dela, um vale cheio de flores nos espera. Venham!',
    ],
    onEnd: ['talk:zuzu'],
  },
  zuzu_after: { id: 'zuzu_after', speaker: 'Zuzu', lines: ['A chuva já está diminuindo. Depois da tempestade, vem a esperança!'] },
};

/** Diálogos da Fase 5 conforme o estado das missões. */
export function pickStormDialogue(npc: string, q: QuestLog): DialogueDef {
  const st = q.state('tempestade');
  if (npc === 'beto') {
    if (st.status === 'active' && st.objective === 0) return S.beto_intro;
    if (st.status === 'active' && st.objective === 1) return S.beto_again;
    if (st.status === 'active' && st.objective === 2) return S.beto_raft;
    return S.beto_after;
  }
  if (st.status === 'active' && st.objective === 4) return S.zuzu_intro;
  if (st.status === 'active' && st.objective < 4) return S.zuzu_early;
  return S.zuzu_after;
}

const V: Record<string, DialogueDef> = {
  rita_intro: {
    id: 'rita_intro', speaker: 'Rita',
    lines: [
      'Marieta! Beto! Que alívio, vocês atravessaram a tempestade! Eu sou a Rita, a libélula exploradora.',
      'Olhem ao redor: a chuva destruiu o nosso vale, mas as sementes estão despertando. Falta pouco para tudo florescer outra vez!',
      'O Jardim da Esperança só volta à vida com quatro flores raras, e elas estão nas alturas, em flores gigantes.',
      'Procure as colunas de pólen dourado no ar: são correntes de ar quente! Entre numa delas, no ar, e ela leva você para cima.',
    ],
    onEnd: ['talk:rita'],
  },
  rita_again: { id: 'rita_again', speaker: 'Rita', lines: ['Quatro flores raras, lá no alto! Entre nas colunas de pólen dourado e deixe a corrente de ar levar você.'] },
  rita_garden: { id: 'rita_garden', speaker: 'Rita', lines: ['Você tem as flores! Leve-as ao Jardim da Esperança, no meio do vale, e replante.'] },
  rita_after: { id: 'rita_after', speaker: 'Rita', lines: ['O vale está florescendo! Suba ao mirante: o pôr do sol de lá é inesquecível.'] },
  freddy_early: { id: 'freddy_early', speaker: 'Freddy', lines: ['Já escuto os seus passos! Suba até o mirante e eu toco uma música para vocês.'] },
  freddy_intro: {
    id: 'freddy_intro', speaker: 'Freddy',
    lines: [
      'Chegaram! Eu sou o Freddy, o grilo músico. Compus uma canção para a esperança, e agora ela tem uma plateia!',
      'Marieta, você não desistiu na tempestade, nem na enchente, nem na floresta. E o Beto sempre ao seu lado.',
      'Há um ninho verde mais adiante, onde a comunidade vai construir um novo lar. Todos estão esperando por vocês.',
    ],
    onEnd: ['talk:freddy'],
  },
  freddy_after: { id: 'freddy_after', speaker: 'Freddy', lines: ['Que a música acompanhe vocês até o Ninho Verde!'] },
};

/** Diálogos da Fase 6 conforme o estado das missões. */
export function pickValleyDialogue(npc: string, q: QuestLog): DialogueDef {
  const st = q.state('vale');
  if (npc === 'rita') {
    if (st.status === 'active' && st.objective === 0) return V.rita_intro;
    if (st.status === 'active' && st.objective === 1) return V.rita_again;
    if (st.status === 'active' && st.objective === 2) return V.rita_garden;
    return V.rita_after;
  }
  if (st.status === 'active' && st.objective === 4) return V.freddy_intro;
  if (st.status === 'active' && st.objective < 4) return V.freddy_early;
  return V.freddy_after;
}

const N: Record<string, DialogueDef> = {
  caramujo_intro: {
    id: 'caramujo_intro', speaker: 'Sr. Caramujo',
    lines: [
      'Devagar e sempre, jovem joaninha. Eu sou o Sr. Caramujo, e já vi muitas estações passarem por esta mata.',
      'Sobreviver à tempestade foi só o começo. Agora a comunidade precisa de um lar que resista: o Ninho Verde, feito de folhas macias.',
      'Precisamos de seis folhas: três para erguer as paredes e três para o telhado. Ninguém constrói um lar sozinho, mas alguém tem que começar.',
      'Ah, e cuidado com o Dário. Ele é um besouro desconfiado, mas ninguém é teimoso por maldade. Às vezes só falta confiança.',
    ],
    onEnd: ['talk:caramujo'],
  },
  caramujo_again: { id: 'caramujo_again', speaker: 'Sr. Caramujo', lines: ['Seis folhas macias, jovem. Três para as paredes, três para o telhado. Sem pressa, mas sem parar.'] },
  caramujo_after: { id: 'caramujo_after', speaker: 'Sr. Caramujo', lines: ['Já vejo o ninho crescendo. Foi você quem começou, Marieta, e isso importa mais do que parece.'] },
  dario_grumpy: {
    id: 'dario_grumpy', speaker: 'Dário',
    lines: ['Quem é você? Eu juntei estas folhas primeiro. Tem pouco para todos, e eu não vou dividir à toa.', 'Se quer minha confiança, traga duas sementes e prove que não é só mais uma que quer o que é meu.'],
  },
  dario_thanks: {
    id: 'dario_thanks', speaker: 'Dário',
    lines: ['Duas sementes… para mim? Ninguém nunca fez isso. Eu achei que todo mundo só queria tirar de mim.', 'Me desculpe, Marieta. Eu me assustei com a tempestade e acabei virando um chato. Quero ajudar a construir o ninho.'],
    onEnd: ['give:seed:2', 'flag:dario', 'talk:dario'],
  },
  dario_friend: { id: 'dario_friend', speaker: 'Dário', lines: ['Estou dando uma força com as folhas. Obrigado por confiar em mim, Marieta.'] },
  beto_early: { id: 'beto_early', speaker: 'Beto', lines: ['Estou aqui, no ninho, esperando você. Quando as paredes e o telhado estiverem de pé, venha me ver!'] },
  beto_nest: {
    id: 'beto_nest', speaker: 'Beto',
    lines: [
      'Olhe só o que você construiu, Marieta. Um lar de verdade, de folhas e de amizade.',
      'No começo, na enchente, eu só queria ajudar. Mas fui descobrindo que o que eu mais gostava era estar ao seu lado.',
      'Amanhã, quando o sol nascer no Vale do Novo Amanhecer, a comunidade inteira vai se juntar. Eu queria muito que você estivesse lá comigo.',
    ],
    onEnd: ['talk:beto'],
  },
  beto_nest_after: { id: 'beto_nest_after', speaker: 'Beto', lines: ['Venha, o Vale do Novo Amanhecer nos espera. Juntos.'] },
};

/** Diálogos da Fase 7 conforme o estado das missões. */
export function pickNestDialogue(npc: string, q: QuestLog, flags: Set<string>): DialogueDef {
  const st = q.state('ninho');
  if (npc === 'caramujo') {
    if (st.status === 'active' && st.objective === 0) return N.caramujo_intro;
    if (st.status === 'active' && st.objective < 4) return N.caramujo_again;
    return N.caramujo_after;
  }
  if (npc === 'dario') {
    const d = q.state('dario');
    if (flags.has('dario')) return N.dario_friend;
    if (d.status === 'active' && d.objective === 1) return N.dario_thanks;
    return N.dario_grumpy;
  }
  if (st.status === 'active' && st.objective === 5) return N.beto_nest;
  if (st.status === 'active' && st.objective < 5) return N.beto_early;
  return N.beto_nest_after;
}
