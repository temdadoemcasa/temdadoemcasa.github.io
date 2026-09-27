// Roda DENTRO do contexto do jogo (mesmo escopo de script de carreira.js):
// enxerga C, EVENTOS, sortearEventos, jogarTemporada, Historia...
// Reproduz o fluxo dos botoes (avancarCompleto -> iniciarRolagem ->
// mostrarDecisao -> fecharTemporadaCompleta -> mostrarMercado) sem animacao.
/* global C, EVENTOS, POSICOES, BASE, PAISES, TETO_NA_CRIACAO, funcaoDe, criarJogador, propostasIniciais, assinar,
   sortearEventos, sortearLesaoDados, aplicarLesao, projecao, resolverOpcao, Historia, jogarTemporada, ofertasDeRenovacao,
   pedirGarantia, chanceDeTitular, decidirTransferencia, mostrarLinha, mostrarAposentadoria, desenharPainelJogador,
   desenharTabelaCarreira, estrelas, degrau, clubesDoMundo */
(function (raiz) {
  "use strict";
  const TITULO_CONSEQ = {
    oportunidade: ["O titular sentiu no aquecimento"], bairro: ["Os amigos do bairro"], diretoria: ["A diretoria chamou você e a sua família"],
    bet_publi: ["A publicidade que ficou"], stjd: ["Denúncia no tribunal esportivo", "Seu nome numa investigação"], garagem: ["O carro e a fase ruim"],
    microfone: ["O microfone"], personagem: ["Você virou personagem"], racha: ["O racha"], legado: ["Conversa sobre o futuro"],
    operacao: ["Operação sobre apostas"], voltou: ["Ele voltou"], testemunha: ["Testemunha da acusação"], reencontro: ["Reencontro com <rival>"],
    bracadeira: ["A braçadeira"], cobranca: ["A torcida cobra"], joelho: ["O joelho de novo"],
    assalto: ["A saída do CT"], campanha: ["O rosto da campanha"], chantagem: ["O passado cobra"], cidade: ["A cidade é sua"],
    repatriar: ["Um clube brasileiro quer te repatriar"], naturalizacao: ["O passaporte"], capitao_selecao: ["A braçadeira da seleção"],
    casa: ["A arquibancada da infância"],
  };
  const normTitulo = (t) => (t.startsWith("Reencontro com") ? "Reencontro com <rival>" : t);
  const chaveEv = (ev) => (ev.id ? ev.id : `${ev.arco}|${normTitulo(ev.titulo)}`);
  const rotuloOp = (ev, op) => (ev.id === "foco" ? op.rotulo.replace(/ \(\d+\)$/, "") : op.rotulo);

  // ---------- estado salvavel (pra politica gulosa testar cada opcao) ----------
  function foto(J) {
    return {
      J: { ...J, efeito: structuredClone(J.efeito), historia: structuredClone(J.historia), emprestimo: J.emprestimo ? { ...J.emprestimo } : J.emprestimo,
        transferencias: [...J.transferencias], attrs: { ...J.attrs }, temasVistos: [...(J.temasVistos || [])] },
      pais: C.pais, rng: Math.random.estado(),
    };
  }
  function restaurar(J, f) {
    for (const k of Object.keys(J)) if (!(k in f.J)) delete J[k];
    Object.assign(J, f.J, { efeito: structuredClone(f.J.efeito), historia: structuredClone(f.J.historia), transferencias: [...f.J.transferencias],
      attrs: { ...f.J.attrs }, emprestimo: f.J.emprestimo ? { ...f.J.emprestimo } : f.J.emprestimo, temasVistos: [...f.J.temasVistos] });
    C.pais = f.pais; Math.random.restaurar(f.rng);
  }
  // valor "nota/fama": projecao do ano + um pouco de reputacao (futuro)
  function valor(J, longo = false) {
    const r = J.historia.rep;
    const repSoma = r.tecnico + r.disciplina + r.torcida + r.vestiario + r.imprensa;
    const p = projecao(J); // (o estado e restaurado depois de cada teste)
    const curto = 4 * p.nota + 1.2 * p.ovr + 0.5 * p.vitrine + 4 * (p.jogos / p.G) + 0.2 * repSoma;
    if (!longo) return curto;
    // estrategica: tambem pesa o que rende nos anos seguintes -- evolucao ate
    // os 24 (vira potencial), folego depois do pico, reputacao e marcas ruins
    const e = J.efeito, m = J.historia.marcas;
    return curto + (J.idade <= 24 ? 2.5 : 0.6) * e.evolucao + (J.idade >= J.idadePico - 1 ? 2 : 0) * e.queda + 0.3 * repSoma
      - (m.manchado ? 20 : 0) - (m.aliciado ? 6 : 0) - (m.vazou ? 4 : 0) - (m.bet_publi ? 2 : 0);
  }
  function avaliar(J, ev, op, erros, longo = false) {
    const f = foto(J);
    const um = (fn) => { try { fn(J); return valor(J, longo); } catch (e) { erros.push(`avaliar ${chaveEv(ev)}: ${e.message}`); return -1e9; } finally { restaurar(J, f); } };
    if (op.sempre) return um(op.sempre);
    const pc = op.chance(J);
    return pc * um(op.ok) + (1 - pc) * um(op.falha);
  }

  // ---------- politicas ----------
  const POLITICAS = {
    aleatoria: (ev, J, ctx) => Math.floor(ctx.rngPol() * ev.opcoes.length),
    primeira: () => 0,
    gulosa: (ev, J, ctx) => {
      let melhor = 0, mv = -Infinity;
      const vs = ev.opcoes.map((op) => avaliar(J, ev, op, ctx.erros));
      vs.forEach((v, i) => { if (v > mv + 1e-9) { mv = v; melhor = i; } });
      if (ctx.valores) ctx.valores.push([chaveEv(ev), vs.map((v) => Math.round(v * 100) / 100)]);
      return melhor;
    },
    // estrategica: a gulosa que tambem enxerga o longo prazo (e o mercado com cabeca)
    estrategica: (ev, J, ctx) => {
      let melhor = 0, mv = -Infinity;
      ev.opcoes.forEach((op, i) => { const v = avaliar(J, ev, op, ctx.erros, true); if (v > mv + 1e-9) { mv = v; melhor = i; } });
      return melhor;
    },
    // a pior jogada (so pra medir o efeito das escolhas; fora da bateria)
    pior: (ev, J, ctx) => {
      let pior = 0, mv = Infinity;
      ev.opcoes.forEach((op, i) => { const v = avaliar(J, ev, op, ctx.erros); if (v < mv - 1e-9) { mv = v; pior = i; } });
      return pior;
    },
    cautelosa: (ev, J) => {
      let melhor = 0, mr = Infinity;
      ev.opcoes.forEach((op, i) => {
        const risco = (op.chance ? 1 - op.chance(J) : 0) + (op.consequencia ? 0.25 : 0);
        if (risco <= mr + 1e-9) { mr = risco; melhor = i; } // empate: a ultima (a passiva, por convencao do jogo)
      });
      return melhor;
    },
  };
  POLITICAS.impaciente = POLITICAS.aleatoria;
  // assina: decisoes ao acaso, mas no mercado clica "Assinar" sempre que pode
  POLITICAS.assina = POLITICAS.aleatoria;

  // mercado (modo completo): botoes na ordem da tela
  const notaClube = (J, c) => {
    const pesoJogar = J.idade <= 23 ? 10 : 7, s = chanceDeTitular(J.ovr, c.nivel, J.idade);
    return c.forca + c.prestigio * 0.8 + s * pesoJogar - (s < 0.2 ? 5 : 0);
  };
  const MERCADO = {
    assina: (bs) => bs.find((b) => b.tipo === "assina") || bs.find((b) => b.tipo === "fica"),
    estrategica: (bs, J, ctx, linha) => MERCADO.gulosa(bs, J, ctx, linha),
    pior: (bs) => bs.find((b) => b.tipo === "fica") || bs[0],
    aleatoria: (bs, J, ctx) => bs[Math.floor(ctx.rngPol() * bs.length)],
    // (a cautelosa e a primeira nunca pedem: "pede" nao e a primeira nem a segura)
    impaciente: (bs, J, ctx) => bs[Math.floor(ctx.rngPol() * bs.length)],
    primeira: (bs) => bs.filter((b) => b.tipo !== "pede")[0],
    // gulosa ("nota e fama"): ambiciosa mas com cabeca -- sobe de degrau (ou vai
    // pra clube bem mais forte) quando tem chance real de jogar; se a vaga e
    // incerta, pede garantia; recusada a garantia, fica
    gulosa: (bs, J, ctx, linha) => {
      const joga = (c) => chanceDeTitular(J.ovr, c.nivel, J.idade);
      // clube barrou um salto de degrau com vaga real: pede pra ser vendido
      const pede = bs.find((b) => b.tipo === "pede");
      if (pede && !bs.some((b) => b.tipo === "assina" && degrau(b.c) > degrau(J.clube)) && pede.barradas.some((c) => degrau(c) > degrau(J.clube) && joga(c) >= 0.45)) return pede;
      const ofertas = bs.filter((b) => b.tipo === "assina" && (degrau(b.c) > degrau(J.clube) || b.c.forca > J.clube.forca + 2 || linha.rebaixado || notaClube(J, b.c) > notaClube(J, J.clube) + 1.2));
      const boas = ofertas.filter((b) => joga(b.c) >= 0.45).sort((a, b) => (degrau(b.c) - degrau(a.c)) || (b.c.forca - a.c.forca));
      if (boas.length) return boas[0];
      const incerta = ofertas.filter((b) => joga(b.c) >= 0.2).sort((a, b) => (degrau(b.c) - degrau(a.c)) || (b.c.forca - a.c.forca))[0];
      const g = incerta && bs.find((b) => b.tipo === "garantia" && b.c === incerta.c);
      if (g) return g;
      return bs.find((b) => b.tipo === "renova" && b.r.id === "aumento") || bs.find((b) => b.tipo === "renova" && b.r.id !== "curta") || bs.find((b) => b.tipo === "fica") || bs.find((b) => b.tipo === "renova");
    },
    cautelosa: (bs, J, ctx, linha) => {
      bs = bs.filter((b) => b.tipo !== "pede");
      if (linha.rebaixado) {
        const o = bs.filter((b) => b.tipo === "assina").sort((a, b) => notaClube(J, b.c) - notaClube(J, a.c))[0];
        if (o) return o;
      }
      return bs.find((b) => b.tipo === "renova" && b.r.id === "idolo") || bs.find((b) => b.tipo === "renova" && b.r.id !== "curta") || bs.find((b) => b.tipo === "renova") || bs.find((b) => b.tipo === "fica");
    },
  };
  const BASE_ESCOLHA = {
    assina: (ps) => ps[0],
    estrategica: (ps) => [...ps].sort((a, b) => chanceDeTitular(C.J.ovr, b.nivel, 16) * 10 + b.forca / 10 - (chanceDeTitular(C.J.ovr, a.nivel, 16) * 10 + a.forca / 10))[0],
    pior: (ps) => [...ps].sort((a, b) => a.forca - b.forca)[0],
    aleatoria: (ps, ctx) => ps[Math.floor(ctx.rngPol() * ps.length)],
    impaciente: (ps, ctx) => ps[Math.floor(ctx.rngPol() * ps.length)],
    primeira: (ps) => ps[0],
    gulosa: (ps) => [...ps].sort((a, b) => b.forca - a.forca)[0],
    cautelosa: (ps) => [...ps].sort((a, b) => chanceDeTitular(C.J.ovr, b.nivel, 16) - chanceDeTitular(C.J.ovr, a.nivel, 16))[0],
  };

  const estadoJanela = (J, rapido, ofertas, barradas) => `${rapido ? "rápido" : "completo"} · ${anosRestantes(J) >= 2 ? "com contrato" : anosRestantes(J) === 1 ? "último ano" : "livre"}`
    + ` · ${ofertas.length ? "com propostas liberadas" : "sem propostas"}${barradas.length && !rapido ? " · com propostas barradas" : ""}`;
  function mercado(J, linha, pol, ctx, reg, { rapido = false } = {}) {
    const ofertas = C.ofertasAbertas || [];
    // os botoes do clube vem do jogo (botoesDoClube), na ordem da tela
    const doClube = botoesDoClube(J, linha, { rapido });
    let bs = [...doClube, ...ofertas.flatMap((c) => [{ tipo: "assina", c }, { tipo: "garantia", c }])];
    // e2e: desenha a janela de verdade (mostrarMercado) e guarda os botoes
    if (ctx.e2e) ctx.e2e(estadoJanela(J, rapido, C.ofertasAbertas || [], C.ofertasBarradas || []), () => mostrarMercado(linha, rapido ? { so: ofertas } : {}));
    reg.estadosJanela = reg.estadosJanela || [];
    reg.estadosJanela.push([anosRestantes(J) >= 2 ? "com contrato" : anosRestantes(J) === 1 ? "último ano" : "livre", rapido ? "rápido" : "completo", doClube.map((b) => b.rotulo).join(" | ")]);
    // "Pede pra ser vendido" aparece quando o clube barrou propostas (completo)
    if (!rapido && (C.ofertasBarradas || []).length && anosRestantes(J) >= 1 && !J.pediuSaida) bs.splice(doClube.length, 0, { tipo: "pede", barradas: C.ofertasBarradas });
    for (let guarda = 0; guarda < 20; guarda++) {
      const b = MERCADO[pol](bs, J, ctx, linha) || bs.find((x) => x.tipo === "fica") || bs.find((x) => x.tipo === "renova") || bs[0];
      reg.mercado[b.tipo === "renova" ? `renova:${b.r.id}` : b.tipo] = (reg.mercado[b.tipo === "renova" ? `renova:${b.r.id}` : b.tipo] || 0) + 1;
      if (b.tipo === "renova") {
        const r = b.r;
        ctx.texto("rotulo-renovacao", b.rotulo);
        const texto = renovarCom(J, r); ctx.texto("renovacao", texto);
        J.janela = [...(J.janela || []), texto];
        Historia.registrar(J, { titulo: "Renovação", arco: null }, r, { texto, ok: null });
        break;
      }
      if (b.tipo === "fica") break;
      if (b.tipo === "pede") {
        const lib = pedirSaida(J);
        if (ctx.e2e) { C.ofertasAbertas = [...ofertas, ...lib]; ctx.e2e(`${estadoJanela(J, rapido, C.ofertasAbertas, C.ofertasBarradas || [])} · depois de pedir pra sair`, () => mostrarMercado(linha, { aviso: "pedido" })); }
        reg.mercado[`pede:${lib.length ? "liberou" : "segurou"}`] = (reg.mercado[`pede:${lib.length ? "liberou" : "segurou"}`] || 0) + 1;
        bs = [...bs.filter((x) => x.tipo !== "pede"), ...lib.flatMap((c) => [{ tipo: "assina", c }, { tipo: "garantia", c }])];
        continue;
      }
      const assinaAqui = (c, garantia) => {
        linha.transferencia = { para: c.nome, liga: c.liga, valor: valorDaVenda(J) };
        assinar(c, "mercado"); if (garantia) J.efeito.minutos += 0.15;
        J.janela = [...(J.janela || []), `Assinou com o ${c.nome}${garantia ? ", com vaga de titular prometida" : ""}. Valor da transferência: ${J.valor}. O primeiro ano é de adaptação.`];
        reg.transferencias++;
      };
      if (b.tipo === "assina") { assinaAqui(b.c, false); break; }
      const g = pedirGarantia(J, b.c, C.rng);
      reg.mercado[`garantia:${g.resultado}`] = (reg.mercado[`garantia:${g.resultado}`] || 0) + 1;
      if (g.resultado === "aceitou") { assinaAqui(b.c, true); break; }
      bs = bs.filter((x) => !(x.c === b.c && (x.tipo === "garantia" || g.resultado === "desistiu")));
    }
    // fechar() da tela: livre e sem renovar -> contrato padrao
    if (garantirContrato(J)) reg.mercado.padrao = (reg.mercado.padrao || 0) + 1;
    C.ofertasAbertas = null;
  }

  // ---------- uma temporada jogada na tela (modo rapido ou completo) ----------
  function temporadaInterativa(J, pol, ctx, reg) {
    const agendaAntes = J.historia.agenda.filter((a) => a.ano <= J.ano).map((a) => a.id);
    const evs = sortearEventos(J, C.rng);
    // consequencias vencidas x mostradas (o limite de 2 descarta sem avisar)
    const titulosMostrados = evs.map((e) => normTitulo(e.titulo));
    for (const id of agendaAntes) {
      reg.conseqDevidas[id] = (reg.conseqDevidas[id] || 0) + 1;
      if (TITULO_CONSEQ[id] && TITULO_CONSEQ[id].some((t) => titulosMostrados.includes(t))) reg.conseqMostradas[id] = (reg.conseqMostradas[id] || 0) + 1;
    }
    reg.eventosPorAno.push(evs.length);
    // iniciarRolagem: pontos no ano, lesao marcada, projecao inicial
    const resto = evs.filter((e) => e.id !== "foco").length;
    let j = 0;
    const pontos = evs.map((e) => (e.id === "foco" ? 0.02 : 0.22 + (j++ + 0.5) * (0.66 / resto) + (C.rng() - 0.5) * 0.08));
    const les = sortearLesaoDados(J, C.rng);
    J.lesaoPre = les ? { dados: les, pos: 0.1 + C.rng() * 0.8, aplicada: false } : null;
    if (!ctx.semBugProjecao) projecao(J);
    let prog = 0;
    const avancaAte = (alvo) => {
      const lp = J.lesaoPre;
      if (lp && !lp.aplicada && alvo >= lp.pos) { lp.aplicada = true; aplicarLesao(J, lp.dados); if (!ctx.semBugProjecao) projecao(J); }
      prog = alvo;
    };
    for (let i = 0; i < evs.length; i++) {
      if (i > 40) { reg.softlock.push(`mais de 40 eventos num ano (${J.ano})`); break; }
      avancaAte(pontos[i]);
      const ev = evs[i];
      const k = chaveEv(ev);
      if (!ev.opcoes || !ev.opcoes.length) { reg.softlock.push(`evento sem opcoes: ${k}`); continue; }
      ctx.texto(`titulo:${k}`, ev.titulo);
      ctx.texto(`texto:${k}`, ev.texto(J));
      ev.opcoes.forEach((op, oi) => {
        ctx.texto(`opcao:${k}`, op.rotulo);
        if (op.sempre && typeof ladosDaOpcao === "function") {
          const antes = JSON.stringify({ e: J.efeito, h: J.historia.rep, a: J.historia.agenda, c: J.clube.id, p: C.pais, r: Math.random.estado() });
          const l = ladosDaOpcao(J, op);
          if (l.bom.length) ctx.texto(`lados:${k}`, `+ ${l.bom.join(", ")}`);
          if (l.ruim.length) ctx.texto(`lados:${k}`, `− ${l.ruim.join(", ")}`);
          const depois = JSON.stringify({ e: J.efeito, h: J.historia.rep, a: J.historia.agenda, c: J.clube.id, p: C.pais, r: Math.random.estado() });
          if (antes !== depois) reg.softlock.push(`ladosDaOpcao mudou o estado: ${k}#${oi}`);
          reg.lados[`${k}#${oi}`] = l;
        }
        if (op.chance) { const pc = op.chance(J); if (!Number.isFinite(pc) || pc < 0 || pc > 1) reg.textosRuins.push(`chance invalida ${k}#${oi}: ${pc}`); }
      });
      reg.vistos.push(k);
      const idx = POLITICAS[pol](ev, J, ctx);
      const op = ev.opcoes[idx];
      const r = resolverOpcao(J, op, C.rng);
      ctx.texto(`resultado:${k}`, r.texto);
      reg.escolhas.push([k, `${idx}:${rotuloOp(ev, op)}`, r.ok, J.idade]);
      J.efeito.textos.push({ titulo: ev.titulo, escolha: op.rotulo, texto: r.texto, ok: r.ok });
      Historia.registrar(J, ev, op, r);
      if (r.emSeguida) {
        const prox = pontos[i + 1] ?? 1;
        const ponto = Math.min(prog + 0.05, (prog + prox) / 2);
        evs.splice(i + 1, 0, r.emSeguida); pontos.splice(i + 1, 0, ponto);
      }
      if (!ctx.semBugProjecao) projecao(J);
    }
    avancaAte(1);
    // fecharTemporadaCompleta
    let linha;
    if (C.modo !== "completo") {
      // fecharTemporadaCompleta do rapido: salto de degrau vira decisao
      linha = jogarTemporada({ decidir: false });
      const salto = J.aposentado ? null : propostaDeSalto(J, C.ofertasAbertas || []);
      if (salto) {
        linha.saltoPendente = true;
        C.ofertasAbertas = [salto];
        mercado(J, linha, pol, ctx, reg, { rapido: true });
        reg.saltos++;
      } else if (!J.aposentado) { janelaAutomatica(J, linha); if (linha.transferencia) reg.transferencias++; }
    } else {
      linha = jogarTemporada({ decidir: false });
      if (!J.aposentado) mercado(J, linha, pol, ctx, reg);
    }
    return linha;
  }

  function criarJogadorAleatorio(rngP, modo) {
    const posicoes = Object.keys(POSICOES);
    C.pos = posicoes[Math.floor(rngP() * posicoes.length)];
    C.pais = rngP() < 0.8 ? "BRA" : PAISES[1 + Math.floor(rngP() * (PAISES.length - 1))].id;
    C.nome = "TESTE"; C.numero = 9; C.pe = "Direito"; C.modo = modo;
    const f = funcaoDe(C.pos);
    C.attrs = { ...BASE[f] };
    let pontos = 30;
    for (let g = 0; pontos > 0 && g < 100; g++) {
      const ks = Object.keys(C.attrs).filter((k) => C.attrs[k] - BASE[f][k] < 15 && C.attrs[k] + 5 <= TETO_NA_CRIACAO);
      const k = ks[Math.floor(rngP() * ks.length)];
      C.attrs[k] += 5; pontos -= 5;
    }
    C.tabelaAnterior = null; C.ofertasAbertas = null; C.eventos = null; C.rolagem = null;
  }

  // ---------- uma carreira inteira ----------
  raiz.rodarCarreira = function ({ semente, pol, modo, rngPol, rngJog, semBugProjecao = false, capturar, e2e = null }) {
    const reg = {
      vistos: [], escolhas: [], mercado: {}, transferencias: 0, softlock: [], textosRuins: [], erros: [], eventosPorAno: [],
      conseqDevidas: {}, conseqMostradas: {}, simulouApos: null, saltos: 0, lados: {}, valores: [],
    };
    const ctx = { rngPol, erros: reg.erros, semBugProjecao, texto: capturar, valores: pol === "gulosa" ? reg.valores : null, e2e };
    rngJog.semear(semente);
    criarJogadorAleatorio(rngPol, modo);
    criarJogador();
    const J = C.J;
    const props = propostasIniciais();
    if (ctx.e2e) ctx.e2e("peneira", () => { const alvo = document.getElementById("propostas-base"); alvo.replaceChildren(); for (const c of props) alvo.append(cartaoDeProposta(c, () => {}, { contexto: "base", rotulo: "Assina" })); }, "propostas-base");
    const esc = BASE_ESCOLHA[pol](props, ctx);
    reg.base = { divisao: esc.divisao, opcoes: props.map((p) => p.divisao).join("") };
    assinar(esc, "base");
    const ini = { pos: C.pos, pais: C.pais, ovr: J.ovr, potencial: J.potencial, pico: J.idadePico };
    const paraSimular = pol === "impaciente" ? 2 + Math.floor(rngPol() * 6) : Infinity;
    let anos = 0;
    while (!J.aposentado) {
      if (anos >= 40) { reg.softlock.push("mais de 40 temporadas"); break; }
      let linha;
      if (anos >= paraSimular) {
        if (reg.simulouApos === null) { reg.simulouApos = anos; C.eventos = null; C.ofertasAbertas = null; C.rolagem = null; }
        linha = jogarTemporada();
        if (linha.transferencia) reg.transferencias++;
      } else linha = temporadaInterativa(J, pol, ctx, reg);
      mostrarLinha(linha);
      anos++;
    }
    desenharPainelJogador(); desenharTabelaCarreira(); mostrarAposentadoria();
    // ---- resumo ----
    const H = J.historico;
    const tot = H.reduce((a, h) => ({ j: a.j + h.jogos, g: a.g + h.gols, a: a.a + h.assist }), { j: 0, g: 0, a: 0 });
    const ligaTipo = (h) => (/Série [BCD]/.test(h.liga) ? "inf" : h.liga === "Brasileirão" ? "A" : "ext");
    const ext = C.exterior.ligas;
    const continenteDaLiga = (liga) => { const l = ext.find((x) => x.nome === liga); return l ? `${l.continente}${l.prestigio >= 4 ? "+" : ""}` : null; };
    const lugares = H.map((h) => (ligaTipo(h) === "ext" ? continenteDaLiga(h.liga) : ligaTipo(h)));
    const auge = Math.max(...H.map((h) => h.ovr), J.ovr);
    const trilha = J.historia.trilha;
    const nulos = H.filter((h) => !Number.isFinite(h.ovr) || (h.nota !== null && !Number.isFinite(h.nota)) || !Number.isFinite(h.gols)).length;
    return {
      semente, pol, modo, ...ini, base: reg.base,
      temporadas: H.length, idadeFim: J.idade, aposentadoForcada: J.idade >= (funcaoDe(C.pos) === "GOL" ? 42 : 40),
      auge, ovrFinal: J.ovr, jogos: tot.j, gols: tot.g, assist: tot.a,
      titulos: J.titulos.length, titulosClube: J.titulos.filter((t) => !t.selecao).length, premios: J.premios.length,
      bolaDeOuro: J.premios.filter((p) => p.nome === "Bola de Ouro").length,
      selecao: H.some((h) => h.selecao), jogosSelecao: H.reduce((a, h) => a + (h.selecao ? h.selecao.jogos : 0), 0),
      clubes: new Set(H.map((h) => h.clube)).size, transferencias: J.transferencias.filter((t) => !t.emprestimo).length,
      emprestimos: J.transferencias.filter((t) => t.emprestimo).length / 2,
      lugares, europaElite: lugares.includes("europa+"), europa: lugares.some((l) => l && l.startsWith("europa")),
      serieA: lugares.includes("A"), soInferior: lugares.every((l) => l === "inf"),
      temporadasPerdidas: H.filter((h) => h.jogos === 0).length,
      suspensoes: trilha.filter((t) => /Suspenso|Gancho longo|Gancho de um ano|não entra mais em campo/.test(t.texto || "")).length,
      rep: J.historia.rep, marcas: Object.keys(J.historia.marcas),
      arcos: [...new Set(trilha.filter((t) => t.arco).map((t) => t.arco))],
      trilhaAuto: trilha.filter((t) => / \(no automático\)$/.test(t.escolha)).map((t) => `${t.arco}|${normTitulo(t.titulo)}#${t.escolha}`),
      voltouFormador: (() => { const t = trilha.find((x) => x.escolha === "Topa voltar"); return t ? H.some((h) => h.ano >= t.ano + 1 && h.clube === H[0].clube) : null; })(),
      vistos: reg.vistos, escolhas: reg.escolhas, mercado: reg.mercado, eventosPorAno: reg.eventosPorAno,
      conseqDevidas: reg.conseqDevidas, conseqMostradas: reg.conseqMostradas, simulouApos: reg.simulouApos,
      softlock: reg.softlock, textosRuins: reg.textosRuins, erros: reg.erros, nulos,
      eliteSeguidos: H.filter((h, i) => i > 0 && lugares[i] === "europa+" && lugares[i - 1] === "europa+" && h.clube !== H[i - 1].clube).length,
      eliteSeguidosSemMotivo: H.filter((h, i) => i > 0 && lugares[i] === "europa+" && lugares[i - 1] === "europa+" && h.clube !== H[i - 1].clube
        && (J.transferencias.find((t) => t.para === h.clube && t.ano === h.ano) || {}).motivo === "liberado").length,
      motivos: J.transferencias.filter((t) => !t.emprestimo).map((t) => `${t.motivo || "?"}@${t.ano - 2010}`),
      umAnoSo: H.filter((h, i) => i > 0 && i < H.length - 1 && h.clube !== H[i - 1].clube && H[i + 1].clube !== h.clube).length,
      final: (() => { const f = nomeDoFinal(J); capturar("final", `${f.titulo} ${f.texto} ${f.depois || ""}`.trim()); return f.titulo; })(),
      potencialFinal: J.potencial, potencialSorteado: J.potencialSorteado, saltos: reg.saltos, valores: reg.valores,
      temasApostas: J.historia.trilha.filter((t) => ["Dinheiro curto", "O grupo de apostas", "O aliciador"].includes(t.arco)).map((t) => t.arco).filter((v, i, a) => a.indexOf(v) === i),
      puladas: J.historia.trilha.filter((t) => t.escolha === "ficou pra trás").length,
      estreiaAno1: reg.escolhas.some(([k, , , idade]) => k === "estreia" && idade === 16),
      virouTecnico: !!J.viraTecnico, despediu: !!J.ultimaTemporada, paisFinal: C.pais,
    };
  };
})(globalThis);
