/* Prata da Casa: a historia do jogador, com escolhas que tem consequencia.

   Os eventos soltos de carreira.js (treino, festa, penalti...) resolvem e
   somem. Aqui ficam os ARCOS: uma escolha marca o jogador, mexe na
   reputacao e agenda o que vem depois -- na mesma temporada (depois do jogo
   decisivo) ou num ano seguinte. No fim da carreira a trilha inteira vira o
   fluxograma "Sua historia".

   Reputacao (de -5 a 5), aplicada todo ano em jogarTemporada:
     torcida  -> nota e vitrine          vestiario -> minutos
     imprensa -> vitrine (mercado)

   Formato de evento: o mesmo de EVENTOS (carreira.js). Opcao resolve por
   `sempre` ou por `chance` + `ok`/`falha`, e pode devolver texto OU
   { texto, emSeguida } -- `emSeguida` e um evento que entra logo depois,
   na mesma temporada. `consequencia: true` na opcao mostra o aviso de que
   a escolha vai voltar. Nada aqui e exagero de proposito: e o que acontece
   na carreira de verdade, com a resenha do canal. */
(function (raiz) {
  "use strict";

  const LIMITE = 5;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const Historia = {};

  Historia.iniciar = function (J) {
    J.historia = {
      // tecnico: confianca do treinador (zera quando troca de clube)
      // disciplina: a cabeca fora de campo (treino, noite, dinheiro, apostas)
      rep: { torcida: 0, vestiario: 0, imprensa: 0, tecnico: 0, disciplina: 0 },
      marcas: {},
      agenda: [],   // { id, ano, dados }
      trilha: [],   // { ano, idade, clube, arco, titulo, escolha, texto, ok, consequencia }
      iniciados: {},
      rival: null,
    };
    return J.historia;
  };

  const h = (J) => J.historia || Historia.iniciar(J);
  const rep = (J, mudancas) => {
    const r = h(J).rep;
    for (const [k, v] of Object.entries(mudancas)) r[k] = clamp((r[k] || 0) + v, -LIMITE, LIMITE);
  };
  const polemica = (J) => { h(J).marcas.polemica = (h(J).marcas.polemica || 0) + 1; };
  const nPolemica = (J) => h(J).marcas.polemica || 0;

  // fase da carreira: as perguntas mudam com a idade e a experiencia
  //   base (ate 19): sem dinheiro, pouco minuto, atras de uma chance
  //   afirmacao (20-24): primeiro dinheiro, redes, apostas, polemica
  //   auge (25-30): lideranca, crise, grandes decisoes
  //   veterano (31+): corpo, legado
  const fase = (J) => (J.idade <= 19 ? "base" : J.idade <= 24 ? "afirmacao" : J.idade <= 30 ? "auge" : "veterano");
  Historia.fase = fase;
  Historia.NOMES_FASE = { base: "Base", afirmacao: "Afirmação", auge: "Auge", veterano: "Veterano" };

  // trocou de clube: tecnico novo (confianca zera), vestiario pela metade
  Historia.novoClube = function (J) {
    const r = h(J).rep;
    r.tecnico = 0;
    r.vestiario = Math.round((r.vestiario || 0) / 2);
  };
  const agendar = (J, id, anos, dados = {}) => h(J).agenda.push({ id, ano: J.ano + anos, dados });
  const marcar = (J, k, v = true) => { h(J).marcas[k] = v; };

  // A reputacao pesa na temporada (uma vez por ano, antes de jogar)
  Historia.aplicarReputacao = function (J) {
    const r = h(J).rep;
    J.efeito.nota += clamp(r.torcida * 0.03, -0.15, 0.15);
    J.efeito.vitrine += r.torcida * 0.3 + r.imprensa * 0.5;
    J.efeito.minutos += clamp(r.vestiario * 0.015, -0.08, 0.08);
    // o tecnico decide quem joga; a disciplina decide quem evolui e quem se machuca
    const tec = r.tecnico || 0, disc = r.disciplina || 0;
    J.efeito.minutos += clamp(tec * 0.025, -0.15, 0.12);
    J.efeito.nota += clamp(disc * 0.02, -0.1, 0.1);
    J.efeito.evolucao += clamp(disc * 0.15, -0.6, 0.6);
    if (disc < 0) J.efeito.lesao += -disc * 0.02;
    // e na evolucao: ambiente bom faz crescer, ambiente ruim trava. O
    // vestiario (o dia a dia do treino) pesa mais que torcida e imprensa.
    J.efeito.evolucao += clamp(r.vestiario * 0.1 + r.torcida * 0.05 + r.imprensa * 0.04, -0.8, 0.8);
  };

  // o rival: um jogador de verdade da Serie A, de outro clube, que vira o
  // antagonista da carreira (o mesmo nome volta nos arcos seguintes)
  function sortearRival(J, rng) {
    const times = (C.r.times || []).filter((t) => t.nome !== (J.clube && J.clube.nome));
    for (let tentativa = 0; tentativa < 20 && times.length; tentativa++) {
      const t = times[Math.floor(rng() * times.length)];
      const bons = t.jogadores.filter((j) => j.overall !== null && j.overall >= 76 && j.posicao !== "G");
      if (bons.length) {
        const j = bons[Math.floor(rng() * bons.length)];
        return { nome: j.nome, time: t.nome };
      }
    }
    return { nome: "o camisa 10 deles", time: "o rival" };
  }

  // chance do time passar no mata-mata: o jogador pesa, a sorte tambem
  const chanceDeClassificar = (J) => clamp(0.5 + (J.ovr - 74) / 40, 0.25, 0.75);

  // a chance que aparece pra quem esta no banco: rotina e disciplina pesam
  function oportunidade(J) {
    return {
      arco: "A rotina", consequencia: "Primeira semana no alojamento",
      titulo: "O titular sentiu no aquecimento",
      texto: () => "O técnico olha pro banco. Você é um dos três garotos da base relacionados.",
      opcoes: [
        { rotulo: "Levanta e se oferece", consequencia: true,
          chance: (JJ) => clamp(0.35 + (h(JJ).rep.disciplina || 0) * 0.07 + (h(JJ).marcas.rotina ? 0.1 : 0) + (JJ.ovr - (JJ.clube.nivel ?? 65)) / 30, 0.15, 0.85),
          ok: (JJ) => { rep(JJ, { tecnico: 2 }); JJ.efeito.minutos += 0.12; JJ.efeito.vitrine += 1; marcar(JJ, "aproveitou"); return "Entrou, jogou simples, e não saiu mais do time."; },
          falha: (JJ) => { rep(JJ, { tecnico: -1 }); JJ.efeito.nota -= 0.1; return "Nervoso, errou os dois primeiros passes. Voltou pro banco no jogo seguinte."; } },
        { rotulo: "Espera ser chamado",
          sempre: (JJ) => { JJ.efeito.minutos -= 0.03; return "O técnico chamou outro garoto. Ele foi bem."; } },
      ],
    };
  }

  // --- os arcos -----------------------------------------------------------------

  const INICIOS = [
    {
      id: "aliciador", arco: "O aliciador", fases: ["afirmacao", "auge"], peso: (J) => 1 + (h(J).marcas.bet_publi ? 1.5 : 0) + (h(J).marcas.vazou ? 2 : 0) + (h(J).marcas.bet_insistiu ? 1 : 0),
      quando: (J) => J.idade >= 19 && J.idade <= 33,
      evento: () => ({
        titulo: "Uma mensagem no direct",
        texto: () => "Perfil sem foto, conta nova. Oferece R$ 100 mil pra você tomar um amarelo no primeiro tempo do próximo jogo. \"É só um cartão, ninguém vai saber.\"",
        opcoes: [
          { rotulo: "Aceita o dinheiro", consequencia: true,
            sempre: (J) => { marcar(J, "aliciado"); agendar(J, "operacao", 1); return "O cartão veio aos 23 minutos, numa falta boba. O dinheiro caiu na conta de um primo."; } },
          { rotulo: "Ignora e apaga", consequencia: true,
            sempre: (J) => { if (C.rng() < 0.5) agendar(J, "voltou", 1); return "Bloqueou e seguiu a vida. Parecia coisa pequena."; } },
          { rotulo: "Mostra pro clube", consequencia: true,
            sempre: (J) => { rep(J, { imprensa: 1, torcida: 1 }); marcar(J, "denunciou"); agendar(J, "testemunha", 1); return "O jurídico levou o print pra polícia. Na coletiva, o presidente te chamou de exemplo."; } },
        ],
      }),
    },
    {
      id: "rival", arco: "O rival", fases: ["afirmacao", "auge"],
      quando: (J) => J.idade >= 18 && J.clube && J.clube.tipo !== "ext",
      evento: (J, rng) => {
        const r = h(J).rival || (h(J).rival = sortearRival(J, rng));
        return {
          titulo: "Provocação antes do mata-mata",
          texto: () => `${r.nome}, do ${r.time}, disse na coletiva que você "ainda não jogou nada". Tem jogo de volta na quarta, valendo vaga.`,
          opcoes: [
            { rotulo: "Responde nas redes", consequencia: true, chance: chanceDeClassificar,
              ok: (JJ) => { marcar(JJ, "respondeu"); rep(JJ, { torcida: 1 }); return { texto: "Classificou. E a sua resposta nas redes virou print em todo lugar.", emSeguida: depoisDaVitoria(JJ, true) }; },
              falha: (JJ) => { marcar(JJ, "respondeu"); rep(JJ, { torcida: -1 }); return { texto: "Eliminado. O print da sua resposta voltou em forma de meme.", emSeguida: depoisDaDerrota(JJ, true) }; } },
            { rotulo: "Deixa pra lá", consequencia: true, chance: chanceDeClassificar,
              ok: (JJ) => ({ texto: "Classificou sem dizer uma palavra na semana.", emSeguida: depoisDaVitoria(JJ, false) }),
              falha: (JJ) => ({ texto: "Eliminado. Pelo menos não tem print seu rodando.", emSeguida: depoisDaDerrota(JJ, false) }) },
          ],
        };
      },
    },
    {
      id: "renovacao", arco: "A renovação",
      quando: (J) => J.idade >= 21 && J.idade <= 31 && J.anosNoClube >= 1,
      evento: (J) => ({
        titulo: "O presidente quer renovar agora",
        texto: () => `Antes da janela, o ${J.clube.nome} oferece contrato longo, salário bom e multa alta. "Queremos você aqui por muitos anos."`,
        opcoes: [
          { rotulo: "Assina", consequencia: true,
            sempre: (JJ) => { rep(JJ, { torcida: 1, vestiario: 1 }); JJ.efeito.vitrine -= 1; marcar(JJ, "fiel", JJ.clube.nome); agendar(JJ, "bracadeira", 2, { clube: JJ.clube.nome }); return "Foto com a camisa e a caneta. A torcida comprou a ideia; o mercado esfriou um pouco."; } },
          { rotulo: "Espera a janela", consequencia: true,
            sempre: (JJ) => { rep(JJ, { torcida: -1 }); JJ.efeito.vitrine += 2; agendar(JJ, "cobranca", 1, { clube: JJ.clube.nome }); return "Seu empresário espalhou que você está \"avaliando o mercado\". A arquibancada não gostou."; } },
        ],
      }),
    },
    {
      id: "mentor", arco: "O mentor", fases: ["base"],
      quando: (J) => J.idade <= 19,
      evento: () => ({
        titulo: "O capitão te chamou",
        texto: () => "O veterano do elenco viu você no treino e propôs: meia hora a mais todo dia, só vocês dois.",
        opcoes: [
          { rotulo: "Topa na hora", consequencia: true,
            sempre: (J) => { J.efeito.evolucao += 1; rep(J, { vestiario: 1 }); marcar(J, "mentorado"); return "Ele corrigiu o seu corpo no chute e o posicionamento. Você nunca mais esqueceu."; } },
          { rotulo: "Prefere treinar sozinho",
            sempre: () => "Ele deu de ombros. Cada um tem o seu jeito." },
        ],
      }),
    },
    {
      id: "dor", arco: "O joelho",
      quando: (J) => J.idade >= 20,
      evento: () => ({
        titulo: "A final e o joelho",
        texto: () => "O joelho incha depois dos treinos. Ninguém sabe ainda. A final é domingo e o técnico conta com você.",
        opcoes: [
          { rotulo: "Esconde e joga", consequencia: true, chance: (J) => clamp(0.35 + ((J.attrs.FIS ?? J.attrs.REF ?? 60) - 60) / 60, 0.2, 0.7),
            ok: (J) => { J.efeito.vitrine += 2; J.efeito.nota += 0.15; rep(J, { torcida: 1 }); marcar(J, "joelho"); agendar(J, "joelho", 1); return "Jogou os 90, foi decisivo. No vestiário, o gelo não bastou."; },
            falha: (J) => { J.efeito.lesao += 0.3; rep(J, { vestiario: -1 }); return "Saiu aos 20 minutos, e todo mundo descobriu que você sabia. Três meses fora."; } },
          { rotulo: "Conta pro médico",
            sempre: (J) => { J.efeito.minutos -= 0.03; rep(J, { vestiario: 1 }); return "Ficou fora da final. Tratou certo, voltou inteiro. O grupo respeitou."; } },
        ],
      }),
    },
  ];

  INICIOS.push(...[
    // ===== BASE (16-19): sem dinheiro, pouco minuto, atras de uma chance =====
    {
      id: "rotina", arco: "A rotina", abre: true, fases: ["base"], peso: () => 6,
      quando: (J) => J.idade <= 17,
      evento: () => ({
        titulo: "Primeira semana no alojamento",
        texto: () => "Quarto dividido com mais três garotos, ajuda de custo que mal paga a passagem e o time principal treinando no campo ao lado.",
        opcoes: [
          { rotulo: "Chega uma hora antes todo dia", consequencia: true,
            sempre: (J) => { rep(J, { disciplina: 1, tecnico: 1 }); J.efeito.evolucao += 0.5; marcar(J, "rotina"); return { texto: "Academia vazia, bola parada, repetição. O preparador do profissional começou a reparar.", emSeguida: oportunidade(J) }; } },
          { rotulo: "Faz o que o treino pede",
            sempre: (J) => { agendar(J, "oportunidade", 1); return "Cumpriu tudo, sem chamar atenção. Nem pra bem, nem pra mal."; } },
          { rotulo: "Folga é pra voltar pro bairro", consequencia: true,
            sempre: (J) => { rep(J, { disciplina: -1 }); marcar(J, "bairro"); agendar(J, "bairro", 1); return "Toda folga, ônibus de volta pros amigos. Na segunda, o preparador reparou no peso."; } },
        ],
      }),
    },
    {
      id: "aperto", arco: "Dinheiro curto", fases: ["base"], peso: () => 4,
      quando: (J) => J.idade >= 17 && J.idade <= 19,
      evento: () => ({
        titulo: "O mês não fecha em casa",
        texto: () => "A ajuda de custo da base não paga as contas da família. Um site de apostas oferece R$ 5 mil por mês pra você divulgar o link no seu perfil.",
        opcoes: [
          { rotulo: "Divulga o site", consequencia: true,
            sempre: (J) => { rep(J, { disciplina: -1 }); marcar(J, "bet_publi"); agendar(J, "bet_publi", 2); return "Dinheiro no primeiro dia. O link está na sua bio, e a sua família respirou."; } },
          { rotulo: "Pede adiantamento ao clube",
            sempre: (J) => { rep(J, { tecnico: 1 }); return "O clube adiantou dois meses. O coordenador da base gostou de você ter vindo falar."; } },
          { rotulo: "Arruma um bico nas folgas", chance: () => 0.55,
            ok: (J) => { rep(J, { disciplina: 1 }); return "Aula de futebol pra criança no sábado de manhã. Pagou as contas sem atrapalhar o treino."; },
            falha: (J) => { J.efeito.evolucao -= 0.4; J.efeito.lesao += 0.04; return "Cansaço acumulado. Treinou pior o mês inteiro."; } },
        ],
      }),
    },
    // ===== AFIRMACAO (20-24): primeiro dinheiro, redes, apostas =====
    {
      id: "contrato", arco: "O primeiro contrato", abre: true, fases: ["base", "afirmacao"], peso: () => 5,
      quando: (J) => J.idade >= 19 && J.idade <= 21,
      evento: () => ({
        titulo: "Primeiro salário de verdade",
        texto: () => "Contrato profissional assinado. Pela primeira vez, o dinheiro sobra.",
        opcoes: [
          { rotulo: "Compra o carro dos sonhos", consequencia: true,
            sempre: (J) => { J.efeito.vitrine += 0.5; marcar(J, "ostentacao"); agendar(J, "garagem", 1); return "Chegou no CT de carro importado. Todo mundo viu, inclusive quem não devia."; } },
          { rotulo: "Tira a família do aluguel",
            sempre: (J) => { rep(J, { disciplina: 1, torcida: 1 }); J.efeito.nota += 0.05; return "Chave da casa na mão da sua mãe. O vídeo emocionou a cidade."; } },
          { rotulo: "Guarda quase tudo",
            sempre: (J) => { rep(J, { disciplina: 1 }); return "Ninguém reparou. O seu extrato reparou."; } },
        ],
      }),
    },
    {
      id: "grupo", arco: "O grupo de apostas", fases: ["afirmacao", "auge"], peso: (J) => 2 + (h(J).marcas.bet_publi ? 2 : 0),
      quando: (J) => J.idade >= 20 && J.idade <= 30,
      evento: () => ({
        titulo: "O grupo da infância",
        texto: () => "No grupo de WhatsApp dos amigos, a galera aposta nos seus jogos. Pedem pra você contar quem vai jogar no domingo.",
        opcoes: [
          { rotulo: "Conta a escalação", consequencia: true,
            sempre: (J) => { rep(J, { disciplina: -1 }); marcar(J, "vazou"); agendar(J, "stjd", 1 + (C.rng() < 0.5 ? 1 : 0)); return "Parecia bobeira. Eles ganharam uma boa grana e mandaram um áudio agradecendo."; } },
          { rotulo: "Sai do grupo",
            sempre: (J) => { rep(J, { disciplina: 1 }); return "Saiu sem explicar. Uns ficaram chateados, depois passou."; } },
          { rotulo: "Avisa que isso dá punição", consequencia: true, chance: () => 0.6,
            ok: (J) => { rep(J, { disciplina: 1 }); return "O grupo mudou de assunto e ninguém mais perguntou."; },
            falha: (J) => { agendar(J, "stjd", 2, { leve: true }); return "Continuaram apostando, agora sem te perguntar. Mas o seu nome ainda está no grupo."; } },
        ],
      }),
    },
    {
      id: "polemica", arco: "O polêmico", fases: ["afirmacao", "auge"], peso: () => 3,
      quando: (J) => J.idade >= 20 && J.idade <= 31 && J.clube && J.clube.tipo !== "ext",
      evento: () => ({
        titulo: "Gol no clássico, na casa deles",
        texto: () => "Você fez o gol da vitória fora de casa. A torcida rival está a dez metros, xingando desde o aquecimento.",
        opcoes: [
          { rotulo: "Comemora provocando", consequencia: true, chance: () => 0.55,
            ok: (J) => { polemica(J); rep(J, { torcida: 2, imprensa: 1, tecnico: -1 }); J.efeito.vitrine += 2; agendar(J, "microfone", 1); return "Foto do ano. A sua torcida fez mural; o técnico te deu uma bronca, rindo."; },
            falha: (J) => { polemica(J); rep(J, { torcida: 1, imprensa: -2, tecnico: -2 }); J.efeito.minutos -= 0.04; agendar(J, "microfone", 1); return "Confusão generalizada, segundo amarelo, e o time sofreu o empate com um a menos."; } },
          { rotulo: "Corre pro banco",
            sempre: (J) => { rep(J, { vestiario: 1 }); return "Abraço coletivo. A imagem que ficou foi a do grupo."; } },
        ],
      }),
    },
    // ===== AUGE (25-30): lideranca e crise =====
    {
      id: "crise", arco: "A crise", fases: ["auge"], peso: () => 3,
      quando: (J) => J.idade >= 24 && J.idade <= 32 && J.anosNoClube >= 1,
      evento: (J) => ({
        titulo: "O vestiário contra o técnico",
        texto: () => `Cinco derrotas seguidas no ${J.clube.nome}. Os veteranos querem pedir a demissão do técnico e querem você junto.`,
        opcoes: [
          { rotulo: "Fica com o técnico", consequencia: true,
            sempre: (JJ) => { rep(JJ, { tecnico: 2, vestiario: -2 }); agendar(JJ, "racha", 1, { clube: JJ.clube.nome }); return "O técnico ficou e sabe quem segurou a barra. O grupo passou a te olhar diferente."; } },
          { rotulo: "Fica com o grupo", chance: () => 0.6,
            ok: (JJ) => { rep(JJ, { vestiario: 2 }); h(JJ).rep.tecnico = 0; return "O técnico caiu. O novo chegou sem saber de nada, e o grupo te deve essa."; },
            falha: (JJ) => { rep(JJ, { vestiario: 1, tecnico: -3 }); JJ.efeito.minutos -= 0.06; return "O técnico ficou. E sabe quem estava na reunião."; } },
          { rotulo: "Fica de fora da briga",
            sempre: () => "Ninguém te agradeceu, ninguém te cobrou." },
        ],
      }),
    },
    // ===== VETERANO (31+): corpo e legado =====
    {
      id: "corpo", arco: "O corpo", abre: true, fases: ["veterano"], peso: () => 5,
      quando: (J) => J.idade >= 31,
      evento: () => ({
        titulo: "O corpo começou a cobrar",
        texto: () => "A recuperação ficou mais lenta. O preparador sugere jogar um jogo por semana, no máximo.",
        opcoes: [
          { rotulo: "Aceita a gestão de carga", consequencia: true,
            sempre: (J) => { rep(J, { tecnico: 1 }); J.efeito.queda += 0.8; J.efeito.minutos -= 0.08; agendar(J, "legado", 2); return "Menos jogos, mais inteiro nos grandes."; } },
          { rotulo: "Quer jogar tudo", consequencia: true, chance: (J) => clamp(0.3 + ((J.attrs.FIS ?? J.attrs.REF ?? 60) - 65) / 50, 0.15, 0.7),
            ok: (J) => { J.efeito.queda += 0.3; J.efeito.vitrine += 1; agendar(J, "legado", 2); return "Jogou quase tudo, como aos 25. A imprensa chamou de fora de série."; },
            falha: (J) => { J.efeito.lesao += 0.25; J.efeito.queda -= 0.5; agendar(J, "legado", 1); return "A panturrilha estourou em setembro. O recado do corpo foi claro."; } },
        ],
      }),
    },
  ]);

  // --- o que vem depois (na mesma temporada) ------------------------------------

  function depoisDaVitoria(J, respondeu) {
    const r = h(J).rival;
    return {
      arco: "O rival", consequencia: "Provocação antes do mata-mata",
      titulo: "Depois do apito",
      texto: () => `A câmera te acha no gramado. ${r.nome} passa do seu lado de cabeça baixa.`,
      opcoes: [
        { rotulo: "Tira onda com ele", consequencia: true,
          sempre: (JJ) => { rep(JJ, { torcida: 2, imprensa: -1 }); marcar(JJ, "zoou"); agendar(JJ, "reencontro", 1); return "Mandou tchau com a mão. O vídeo passou de um milhão de views. Ele não vai esquecer."; } },
        { rotulo: "Cumprimenta e sai", sempre: (JJ) => { rep(JJ, { imprensa: 1 }); return respondeu ? "Ganhou na bola e foi elegante no fim. A imprensa gostou do contraste." : "Aperto de mão e troca de camisa. Gesto que ninguém zoa."; } },
      ],
    };
  }

  function depoisDaDerrota(J, respondeu) {
    const r = h(J).rival;
    return {
      arco: "O rival", consequencia: "Provocação antes do mata-mata",
      titulo: respondeu ? "Você virou meme" : "A zoeira veio igual",
      texto: () => `${r.nome} postou a foto da classificação com uma legenda pra você. A torcida dele não perdoa.`,
      opcoes: [
        { rotulo: "Responde a zoeira", consequencia: true, chance: () => 0.4,
          ok: (JJ) => { rep(JJ, { torcida: 1 }); return "A resposta foi melhor que a provocação. Virou empate nas redes."; },
          falha: (JJ) => { rep(JJ, { torcida: -1, vestiario: -1 }); agendar(JJ, "reencontro", 1); return "Não pegou bem. Virou meme pela segunda vez na semana."; } },
        { rotulo: "Fica quieto e treina", sempre: (JJ) => { JJ.efeito.evolucao += 0.6; marcar(JJ, "combustivel"); agendar(JJ, "reencontro", 1); return "Salvou o print no celular. Combustível pro ano que vem."; } },
      ],
    };
  }

  // --- o que volta num ano seguinte ---------------------------------------------

  const CONSEQUENCIAS = {
    // --- A rotina ---
    oportunidade: (J) => oportunidade(J),
    bairro: () => ({
      arco: "A rotina", consequencia: "Folga é pra voltar pro bairro",
      titulo: "Os amigos do bairro",
      texto: () => "Aniversário do seu melhor amigo no sábado à noite. Domingo tem jogo às 11h e você está relacionado.",
      opcoes: [
        { rotulo: "Vai e volta cedo", chance: () => 0.5,
          ok: () => "Voltou à meia-noite. Ninguém ficou sabendo.",
          falha: (J) => { rep(J, { disciplina: -1, tecnico: -2 }); marcar(J, "noite"); agendar(J, "diretoria", 1); return "Foto sua no story às três da manhã. O técnico viu antes do jogo."; } },
        { rotulo: "Vai até o fim", consequencia: true, chance: () => 0.25,
          ok: (J) => { rep(J, { disciplina: -1 }); return "Chegou virado, jogou mal, mas ninguém ligou os pontos. Dessa vez."; },
          falha: (J) => { rep(J, { disciplina: -2, tecnico: -3 }); J.efeito.minutos -= 0.1; marcar(J, "noite"); agendar(J, "diretoria", 1); return "Chegou no hotel da concentração às seis. Cortado do jogo e da lista seguinte."; } },
        { rotulo: "Manda um áudio e fica", consequencia: true,
          sempre: (J) => { rep(J, { disciplina: 1 }); marcar(J, "escolheu"); return "O amigo disse que entendeu. Você dormiu cedo e foi o melhor em campo no domingo."; } },
      ],
    }),
    diretoria: () => ({
      arco: "A rotina", consequencia: "Os amigos do bairro",
      titulo: "A diretoria chamou você e a sua família",
      texto: () => "A conversa é curta: ou a rotina muda, ou o contrato não é renovado.",
      opcoes: [
        { rotulo: "Muda tudo: psicóloga e nutricionista",
          sempre: (J) => { rep(J, { disciplina: 2, tecnico: 1 }); J.efeito.evolucao += 0.5; return "Primeiro ano inteiro sem nenhuma bronca. O técnico voltou a confiar."; } },
        { rotulo: "Diz que é perseguição", chance: () => 0.3,
          ok: () => "Ficou por isso mesmo. Por enquanto.",
          falha: (J) => { rep(J, { tecnico: -2 }); J.efeito.minutos -= 0.25; return "Encostado no time B pelo resto do ano."; } },
      ],
    }),
    // --- Dinheiro curto ---
    bet_publi: (J) => ({
      arco: "Dinheiro curto", consequencia: "Divulga o site",
      titulo: "A publicidade que ficou",
      texto: () => `O ${J.clube.nome} proibiu publicidade de sites de aposta. O seu contrato com o site ainda vale mais um ano.`,
      opcoes: [
        { rotulo: "Rompe e paga a multa",
          sempre: (JJ) => { rep(JJ, { disciplina: 1 }); return "Custou caro, mas o assunto morreu ali."; } },
        { rotulo: "Mantém a parceria", consequencia: true, chance: () => 0.4,
          ok: () => "Ninguém cobrou. O dinheiro seguiu entrando.",
          falha: (JJ) => { rep(JJ, { tecnico: -1, imprensa: -2 }); marcar(JJ, "bet_insistiu"); return "Virou matéria: \"jogador divulga site proibido pelo próprio clube\". Multa interna e bronca pública."; } },
      ],
    }),
    // --- O grupo de apostas ---
    stjd: (J, dados) => (dados && dados.leve ? {
      arco: "O grupo de apostas", consequencia: "O grupo da infância",
      titulo: "Seu nome numa investigação",
      texto: () => "Uma casa de apostas marcou movimento estranho nos seus jogos. O grupo dos seus amigos está no relatório.",
      opcoes: [
        { rotulo: "Mostra as mensagens", sempre: (JJ) => { rep(JJ, { imprensa: 1 }); return "Ficou provado que você avisou e não passou nada. Caso arquivado."; } },
        { rotulo: "Não fala nada", chance: () => 0.6,
          ok: () => "Arquivaram por falta de prova. Ficou o susto.",
          falha: (JJ) => { rep(JJ, { imprensa: -2 }); JJ.efeito.minutos -= 0.08; return "O silêncio pegou mal. Afastado preventivamente por um mês."; } },
      ],
    } : {
      arco: "O grupo de apostas", consequencia: "Conta a escalação",
      titulo: "Denúncia no tribunal esportivo",
      texto: () => "Uma casa de apostas marcou movimento estranho nos seus jogos. As mensagens do grupo chegaram no tribunal: foi você quem passou a escalação.",
      opcoes: [
        { rotulo: "Assume e colabora", chance: () => 0.6,
          ok: (JJ) => { rep(JJ, { imprensa: -1, tecnico: -1 }); JJ.efeito.minutos -= 0.15; JJ.efeito.vitrine -= 1.5; return "Gancho de 30 dias e multa. Ficou a lição, e a desconfiança."; },
          falha: (JJ) => { rep(JJ, { imprensa: -2, torcida: -2, tecnico: -2 }); JJ.efeito.minutos -= 0.35; JJ.efeito.vitrine -= 3; return "Gancho de quatro meses. O clube soltou nota e o patrocinador saiu."; } },
        { rotulo: "Nega tudo", chance: () => 0.3,
          ok: (JJ) => { rep(JJ, { imprensa: -1 }); return "Faltou prova. Mas o assunto voltou em toda entrevista."; },
          falha: (JJ) => { rep(JJ, { imprensa: -3, torcida: -3, vestiario: -2, tecnico: -3 }); JJ.efeito.minutos -= 0.6; JJ.efeito.vitrine -= 5; return "As mensagens vazaram na íntegra. Suspenso por quase um ano."; } },
      ],
    }),
    // --- O primeiro contrato ---
    garagem: () => ({
      arco: "O primeiro contrato", consequencia: "Compra o carro dos sonhos",
      titulo: "O carro e a fase ruim",
      texto: () => "Três jogos sem render. Um torcedor fotografou seu carro na saída do CT e escreveu: \"joga menos que o motor\".",
      opcoes: [
        { rotulo: "Responde nas redes", consequencia: true, chance: () => 0.35,
          ok: (J) => { polemica(J); rep(J, { imprensa: 1 }); return "A resposta foi engraçada e virou meme a seu favor."; },
          falha: (J) => { polemica(J); rep(J, { torcida: -2, tecnico: -1 }); return "A resposta pegou mal. Agora é você contra metade da arquibancada."; } },
        { rotulo: "Vende o carro e fica quieto",
          sempre: (J) => { rep(J, { disciplina: 1, torcida: 1 }); return "Voltou a ir de carro comum. A torcida reparou, e o futebol voltou junto."; } },
        { rotulo: "Ignora e treina",
          sempre: (J) => { J.efeito.evolucao += 0.3; return "Deixou falar. Quem responde é o próximo jogo."; } },
      ],
    }),
    // --- O polemico ---
    microfone: () => ({
      arco: "O polêmico", consequencia: "Gol no clássico, na casa deles",
      titulo: "O microfone",
      texto: () => "Você começou no banco no último jogo. O repórter quer saber o que achou da escolha do técnico.",
      opcoes: [
        { rotulo: "Critica o técnico ao vivo", consequencia: true, chance: (J) => clamp(0.3 + h(J).rep.torcida * 0.06, 0.15, 0.6),
          ok: (J) => { polemica(J); rep(J, { torcida: 1, imprensa: 1 }); h(J).rep.tecnico = 1; if (nPolemica(J) >= 2) agendar(J, "personagem", 1); return "A torcida ficou do seu lado. O técnico caiu duas semanas depois, e o novo te pôs no time."; },
          falha: (J) => { polemica(J); rep(J, { tecnico: -4, vestiario: -1 }); J.efeito.minutos -= 0.15; if (nPolemica(J) >= 2) agendar(J, "personagem", 1); return "Afastado do grupo por uma semana. Voltou pro banco e ficou lá."; } },
        { rotulo: "Diz que respeita a decisão",
          sempre: (J) => { rep(J, { tecnico: 1 }); return "Resposta de manual. O técnico agradeceu no treino."; } },
      ],
    }),
    personagem: () => ({
      arco: "O polêmico", consequencia: "O microfone",
      titulo: "Você virou personagem",
      texto: () => "Programa de TV te quer toda semana. Cada frase sua vira manchete, a favor ou contra.",
      opcoes: [
        { rotulo: "Aceita o palco", chance: () => 0.5,
          ok: (J) => { J.efeito.vitrine += 3; rep(J, { imprensa: 2, tecnico: -1 }); return "Audiência alta e patrocínio novo. O clube tolera enquanto você decide jogos."; },
          falha: (J) => { rep(J, { imprensa: -2, torcida: -2, tecnico: -2 }); J.efeito.minutos -= 0.08; return "Uma frase fora de contexto virou crise. Nota oficial do clube e banco."; } },
        { rotulo: "Some da mídia por um tempo",
          sempre: (J) => { rep(J, { disciplina: 1 }); h(J).marcas.polemica = Math.max(0, nPolemica(J) - 1); return "Três meses sem entrevista. O assunto voltou a ser o seu futebol."; } },
      ],
    }),
    // --- A crise ---
    racha: (J, dados) => (J.clube.nome !== dados.clube ? null : {
      arco: "A crise", consequencia: "Fica com o técnico",
      titulo: "O racha",
      texto: () => "O técnico que você defendeu ainda está aqui. No vestiário, um grupo não fala com você.",
      opcoes: [
        { rotulo: "Chama todo mundo pra conversar", chance: () => 0.55,
          ok: (JJ) => { rep(JJ, { vestiario: 2 }); return "Conversa dura, mas acabou em abraço. Grupo fechado de novo."; },
          falha: (JJ) => { rep(JJ, { vestiario: -1 }); return "Ninguém cedeu. Você terminou o ano isolado, mas titular."; } },
        { rotulo: "Deixa o tempo resolver",
          sempre: (JJ) => { rep(JJ, { vestiario: 1 }); return "Aos poucos, com vitórias, o clima melhorou sozinho."; } },
      ],
    }),
    // --- O corpo ---
    legado: (J) => ({
      arco: "O corpo", consequencia: "O corpo começou a cobrar",
      titulo: "Conversa sobre o futuro",
      texto: () => `O presidente do ${J.clube.nome} oferece um lugar na comissão técnica quando você parar.`,
      opcoes: [
        { rotulo: "Aceita e começa o curso de treinador",
          sempre: (JJ) => { rep(JJ, { vestiario: 1, tecnico: 1 }); marcar(JJ, "futuro_tecnico"); JJ.efeito.queda += 0.3; return "Aulas à noite, prancheta no ônibus. Os garotos já te chamam de professor."; } },
        { rotulo: "Ainda não é hora",
          sempre: () => "Agradeceu. A cabeça ainda está dentro de campo." },
      ],
    }),

    operacao: (J) => ({
      arco: "O aliciador", consequencia: "Uma mensagem no direct",
      titulo: "Operação sobre apostas",
      texto: () => "Uma investigação sobre manipulação de apostas chegou nos cartões do ano passado. O seu nome está numa planilha apreendida.",
      opcoes: [
        { rotulo: "Colabora com a investigação", chance: () => 0.6,
          ok: (JJ) => { JJ.efeito.minutos -= 0.3; JJ.efeito.vitrine -= 2; rep(JJ, { imprensa: -1 }); return "Admitiu e colaborou. Seis jogos de gancho e multa. A carreira segue, marcada."; },
          falha: (JJ) => { JJ.efeito.minutos -= 0.6; JJ.efeito.vitrine -= 4; rep(JJ, { torcida: -2, imprensa: -2 }); return "Gancho longo. O clube anunciou que você não entra mais em campo este ano."; } },
        { rotulo: "Nega tudo", chance: () => 0.35,
          ok: (JJ) => { rep(JJ, { imprensa: -1 }); return "As provas não fecharam. Ficou a desconfiança em cada cartão seu."; },
          falha: (JJ) => { JJ.efeito.minutos -= 0.7; JJ.efeito.vitrine -= 5; rep(JJ, { torcida: -3, vestiario: -2, imprensa: -2 }); return "As mensagens vazaram. Gancho de um ano, e o vestiário parou de falar com você."; } },
      ],
    }),
    voltou: (J) => ({
      arco: "O aliciador", consequencia: "Uma mensagem no direct",
      titulo: "Ele voltou",
      texto: () => "O mesmo perfil. Agora são R$ 250 mil por um pênalti cometido, e a mensagem tem o nome da sua rua.",
      opcoes: [
        { rotulo: "Leva pra polícia", sempre: (JJ) => { rep(JJ, { imprensa: 2, torcida: 1 }); marcar(JJ, "denunciou"); return "Prenderam o grupo. Você depôs de testemunha e virou capa do caderno de esporte."; } },
        { rotulo: "Bloqueia de novo", sempre: () => "Trocou de número. Dormiu mal por uma semana." },
      ],
    }),
    testemunha: (J) => ({
      arco: "O aliciador", consequencia: "Uma mensagem no direct",
      titulo: "Testemunha da acusação",
      texto: () => "O caso virou processo. O promotor quer o seu depoimento público.",
      opcoes: [
        { rotulo: "Depõe", sempre: (JJ) => { rep(JJ, { imprensa: 1, vestiario: -1 }); return "Três jogadores de outros clubes foram suspensos. No vestiário, uns te olham torto."; } },
        { rotulo: "Pede sigilo", sempre: () => "Depôs em sala fechada. Ninguém ficou sabendo." },
      ],
    }),
    reencontro: (J) => {
      const r = h(J).rival;
      const zoou = h(J).marcas.zoou;
      return {
        arco: "O rival", consequencia: zoou ? "Depois do apito" : "Provocação antes do mata-mata",
        titulo: `Reencontro com ${r.nome}`,
        texto: () => zoou ? `${r.nome} não esqueceu o tchau. Na véspera, avisou que ia te marcar o jogo inteiro.` : `Um ano depois, ${r.nome} de novo pela frente. Ele lembra da zoeira; você também.`,
        opcoes: [
          { rotulo: "Encara no mano a mano", chance: (JJ) => clamp(0.45 + (JJ.ovr - 76) / 30 + (h(JJ).marcas.combustivel ? 0.08 : 0), 0.2, 0.8),
            ok: (JJ) => { rep(JJ, { torcida: 2 }); JJ.efeito.vitrine += 1.5; return "Ganhou o duelo e o jogo. No fim, ele veio trocar de camisa. Rivalidade encerrada com respeito."; },
            falha: (JJ) => { rep(JJ, { torcida: -1 }); JJ.efeito.nota -= 0.1; return "Ele levou a melhor desta vez. A zoeira voltou pro seu lado."; } },
          { rotulo: "Joga pro time",
            sempre: (JJ) => { rep(JJ, { vestiario: 1 }); return "Não caiu na pilha. Tocou fácil, o time ganhou, e o técnico elogiou na coletiva."; } },
        ],
      };
    },
    bracadeira: (J, dados) => (J.clube.nome !== dados.clube ? null : {
      arco: "A renovação", consequencia: "O presidente quer renovar agora",
      titulo: "A braçadeira",
      texto: () => `Dois anos depois da renovação, o técnico do ${J.clube.nome} quer você como capitão.`,
      opcoes: [
        { rotulo: "Aceita", sempre: (JJ) => { rep(JJ, { vestiario: 2, torcida: 1 }); JJ.efeito.nota += 0.1; marcar(JJ, "capitao", JJ.clube.nome); return "Braçadeira no braço. Agora é você quem fala no vestiário antes do jogo."; } },
        { rotulo: "Prefere só jogar", sempre: () => "Recusou com educação. Foco no próprio jogo." },
      ],
    }),
    cobranca: (J, dados) => (J.clube.nome !== dados.clube ? null : {
      arco: "A renovação", consequencia: "O presidente quer renovar agora",
      titulo: "A torcida cobra",
      texto: () => "A janela passou, você ficou, e tem faixa na arquibancada: \"Quem não quer ficar, que vá\".",
      opcoes: [
        { rotulo: "Beija o escudo depois do gol", chance: () => 0.55,
          ok: (JJ) => { rep(JJ, { torcida: 2 }); return "Gol, beijo no escudo, arquibancada de pé. Página virada."; },
          falha: (JJ) => { rep(JJ, { torcida: -1, imprensa: -1 }); return "Não fez gol no jogo. O beijo ficou pra outro dia, e a faixa ficou lá."; } },
        { rotulo: "Pede desculpa na coletiva", sempre: (JJ) => { rep(JJ, { torcida: 1 }); return "Falou que o foco é o clube. Metade acreditou."; } },
      ],
    }),
    joelho: (J) => ({
      arco: "O joelho", consequencia: "A final e o joelho",
      titulo: "O joelho de novo",
      texto: () => "O joelho que você escondeu na final voltou a doer na pré-temporada.",
      opcoes: [
        { rotulo: "Faz a cirurgia", sempre: (JJ) => { JJ.efeito.lesao += 0.35; JJ.efeito.queda += 0.6; return "Quatro meses fora, mas o joelho ficou novo. Coisa que só a cirurgia resolve."; } },
        { rotulo: "Infiltração e segue", chance: () => 0.5,
          ok: () => "Aguentou o ano inteiro na base do remédio.",
          falha: (JJ) => { JJ.efeito.lesao = 1; JJ.efeito.evolucao -= 1; return "Rompeu de vez na pré-temporada. Temporada perdida e um passo pra trás."; } },
      ],
    }),
    aprendiz: (J) => ({
      arco: "O mentor", consequencia: "O capitão te chamou",
      titulo: "O garoto da base",
      texto: () => "Um menino de 16 anos pede pra ficar depois do treino com você. Do jeito que o capitão fez contigo.",
      opcoes: [
        { rotulo: "Ensina tudo", sempre: (JJ) => { rep(JJ, { vestiario: 2 }); JJ.efeito.queda += 0.5; return "Dois anos depois ele estreia no profissional e cita o seu nome na primeira entrevista."; } },
        { rotulo: "Não tem tempo", sempre: () => "Ele entendeu. Foi pedir pra outro." },
      ],
    }),
  };

  // --- o que entra no ano ---------------------------------------------------------

  // Consequencias vencidas primeiro (ate 2), depois no maximo um arco novo
  // por temporada, com chance -- a carreira nao vira uma novela a cada ano.
  Historia.eventosDoAno = function (J, rng, { completo }) {
    const est = h(J);
    const devidos = est.agenda.filter((a) => a.ano <= J.ano);
    est.agenda = est.agenda.filter((a) => a.ano > J.ano);
    const eventos = [];
    for (const a of devidos) {
      const ev = CONSEQUENCIAS[a.id] && CONSEQUENCIAS[a.id](J, a.dados);
      if (ev && eventos.length < 2) eventos.push(ev);
    }
    // o mentor aos 30: fecha o arco de quem aceitou o capitao aos 17
    if (est.marcas.mentorado && J.idade >= 30 && !est.iniciados.aprendiz) {
      est.iniciados.aprendiz = true;
      eventos.push(CONSEQUENCIAS.aprendiz(J));
    }
    // o arco que abre cada fase entra sempre (rotina aos 16, contrato aos 20, corpo aos 31)
    const abertura = INICIOS.find((a) => a.abre && !est.iniciados[a.id] && a.fases.includes(fase(J)) && a.quando(J));
    if (abertura && eventos.length < 2) {
      est.iniciados[abertura.id] = true;
      eventos.push({ arco: abertura.arco, ...abertura.evento(J, rng) });
    } else if (eventos.length < 2 && rng() < (completo ? 0.6 : 0.35)) {
      // so arcos da fase atual (os antigos valem pra qualquer fase), com peso:
      // o arco que abre a fase (rotina aos 16, contrato aos 20...) vem antes
      const f = fase(J);
      const livres = INICIOS.filter((a) => !est.iniciados[a.id] && (!a.fases || a.fases.includes(f)) && a.quando(J));
      if (livres.length) {
        const pesos = livres.map((a) => (a.peso ? a.peso(J) : 1));
        let x = rng() * pesos.reduce((p, q) => p + q, 0), k = 0;
        while (k < livres.length - 1 && (x -= pesos[k]) > 0) k++;
        const a = livres[k];
        est.iniciados[a.id] = true;
        eventos.push({ arco: a.arco, ...a.evento(J, rng) });
      }
    }
    return eventos;
  };

  // "Simular o resto": consequencia vencida nao some -- resolve sozinha,
  // pela primeira opcao (a mais comum), e entra na trilha como automatica.
  // Arco novo nao comeca no automatico.
  Historia.resolverAutomatico = function (J, rng, resolver) {
    const est = h(J);
    const devidos = est.agenda.filter((a) => a.ano <= J.ano);
    est.agenda = est.agenda.filter((a) => a.ano > J.ano);
    for (const a of devidos) {
      const ev = CONSEQUENCIAS[a.id] && CONSEQUENCIAS[a.id](J, a.dados);
      if (!ev) continue;
      const op = ev.opcoes[0];
      const r = resolver(J, op, rng);
      Historia.registrar(J, ev, { rotulo: `${op.rotulo} (no automático)` }, r);
    }
  };

  // reputacao mexida de fora dos arcos (a renovacao da janela, carreira.js)
  Historia.mexerReputacao = function (J, mudancas) { rep(J, mudancas); };

  Historia.registrar = function (J, ev, op, r) {
    h(J).trilha.push({
      ano: J.ano, idade: J.idade, clube: J.clube ? J.clube.nome : "",
      arco: ev.arco || null, titulo: ev.titulo, escolha: op.rotulo, texto: r.texto, ok: r.ok,
      consequencia: ev.consequencia || null,
    });
  };

  raiz.Historia = Historia;
})(typeof window !== "undefined" ? window : globalThis);
