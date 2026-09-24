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
      rep: { torcida: 0, vestiario: 0, imprensa: 0 },
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
    for (const [k, v] of Object.entries(mudancas)) r[k] = clamp(r[k] + v, -LIMITE, LIMITE);
  };
  const agendar = (J, id, anos, dados = {}) => h(J).agenda.push({ id, ano: J.ano + anos, dados });
  const marcar = (J, k, v = true) => { h(J).marcas[k] = v; };

  // A reputacao pesa na temporada (uma vez por ano, antes de jogar)
  Historia.aplicarReputacao = function (J) {
    const r = h(J).rep;
    J.efeito.nota += clamp(r.torcida * 0.03, -0.15, 0.15);
    J.efeito.vitrine += r.torcida * 0.3 + r.imprensa * 0.5;
    J.efeito.minutos += clamp(r.vestiario * 0.015, -0.08, 0.08);
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

  // --- os arcos -----------------------------------------------------------------

  const INICIOS = [
    {
      id: "aliciador", arco: "O aliciador",
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
      id: "rival", arco: "O rival",
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
      id: "mentor", arco: "O mentor",
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
          falha: (JJ) => { JJ.efeito.lesao += 0.5; JJ.efeito.evolucao -= 1; return "Rompeu de vez em outubro. Temporada perdida e um passo pra trás."; } },
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
    if (eventos.length < 2 && rng() < (completo ? 0.6 : 0.35)) {
      const livres = INICIOS.filter((a) => !est.iniciados[a.id] && a.quando(J));
      if (livres.length) {
        const a = livres[Math.floor(rng() * livres.length)];
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

  Historia.registrar = function (J, ev, op, r) {
    h(J).trilha.push({
      ano: J.ano, idade: J.idade, clube: J.clube ? J.clube.nome : "",
      arco: ev.arco || null, titulo: ev.titulo, escolha: op.rotulo, texto: r.texto, ok: r.ok,
      consequencia: ev.consequencia || null,
    });
  };

  raiz.Historia = Historia;
})(typeof window !== "undefined" ? window : globalThis);
