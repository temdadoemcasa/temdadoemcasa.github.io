// Testes da logica de tela do draft.js (fase 2) com stubs de DOM. Uso: node testes-ui.js
"use strict";
const vm = require("vm");
const { carregar } = require("./carregar.js");
const A = carregar(); const { D, ESQUEMAS, Motor } = A; const ctx = A.ctx;
let ok = 0, falhas = 0; const conf = (c, msg) => { if (c) ok++; else { falhas++; console.log("FALHOU:", msg); } };
const novoDraft = (esquema = "4-3-3") => {
  D.esquema = esquema; D.dificuldade = "normal"; D.desafio = null;
  D.onze = ESQUEMAS[esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: null }));
  D.banco = A.BANCO_VAGAS.map((pos) => ({ pos, jogador: null }));
  D.vaga = 0; D.leques = {}; D.trocas = 1; D.trocasUsadas = 0;
};
// 1) id interno: nome de convidado nao colide
A.semear(3); D.nome = "Fortaleza"; D.sai = "Chapecoense"; D.continental = "lib";
novoDraft();
todas: for (const s of A.todasVagas()) { s.jogador = A.lequeDaVaga(A.todasVagas().indexOf(s))[0]; }
{
  const t = A.montarTemporada({ semente: 1, rngGrupo: A.random });
  conf(t.times[t.usuario].usuario === true && t.times[t.usuario].nome === "Fortaleza" && t.times.Fortaleza && !t.times.Fortaleza.usuario, "id do usuario colide com o convidado Fortaleza");
}
// 2) escolher: 16 vagas (onze + banco), trava de toque duplo, draft completo
vm.runInContext(`abrirLeque = () => { lequeAtual(); }; mostrarResumo = () => { globalThis.__resumo = (globalThis.__resumo || 0) + 1; };
  globalThis.__agora = 0; performance.now = () => globalThis.__agora;`, ctx);
const esc = (j) => vm.runInContext("escolher", ctx)(j);
novoDraft();
vm.runInContext("abrirLeque()", ctx);
ctx.__agora = 1000; esc(D.leques[0][0]); conf(D.vaga === 1, "1a escolha nao andou");
vm.runInContext("abrirLeque()", ctx);
ctx.__agora = 1100; esc(D.leques[1][0]); conf(D.vaga === 1 && !D.onze[1].jogador, "toque duplo em 100 ms escolheu a vaga seguinte");
ctx.__agora = 1400; esc(D.leques[1][0]); conf(D.vaga === 2, "escolha depois da trava nao andou");
for (let k = 0; k < 40 && D.vaga >= 0; k++) { vm.runInContext("abrirLeque()", ctx); ctx.__agora += 400; esc(D.leques[D.vaga][0]); }
conf(D.vaga < 0 && ctx.__resumo === 1 && A.todasVagas().every((s) => s.jogador), "draft (11 + 5) nao completou");
conf(D.banco.every((s) => A.encaixeNaVaga(s.jogador, s.pos) > 0), "reserva sem encaixe");
ctx.__agora += 400; esc(A.r.indice.comNota[50]); conf(ctx.__resumo === 1, "clique com draft completo fez algo");
// 3) forca: entrosamento e encaixe mexem; esquema reescala o elenco sem perder ninguem
const f0 = A.forcaDoElenco();
conf(Number.isFinite(f0.atq) && Number.isFinite(f0.def), "forca NaN");
const antes = new Set(A.todasVagas().map((s) => s.jogador));
A.trocarEsquema("5-3-2");
conf(D.esquema === "5-3-2" && D.onze.length === 11 && D.banco.length === 5 && A.todasVagas().every((s) => antes.has(s.jogador)), "trocar esquema perdeu jogador");
const mc = A.r.indice.comNota.find((j) => A.FUNCAO.get(j) === "VOL");
conf(A.encaixeNaVaga(mc, "MC") === A.ENCAIXE.secundaria, "volante no MC deveria ser 'joga ai as vezes'");
const zag = A.r.indice.comNota.find((j) => A.FUNCAO.get(j) === "ZAG");
conf(A.encaixeNaVaga(zag, "CA") === A.ENCAIXE.fora, "zagueiro de centroavante deveria ser fora de posicao");
// 4) temporada: situacao do BR e do grupo antes da 1a rodada; postura; janela
D.temp = A.montarTemporada({ semente: 7, rngGrupo: A.random }); D.times = D.temp.times;
const situacao = vm.runInContext("situacao", ctx);
conf(situacao("bra") === "—", "BR antes da 1a rodada: " + situacao("bra"));
conf(/^Grupo [A-H]$/.test(situacao(D.continental)), "grupo antes da 1a rodada: " + situacao(D.continental));
const f = A.forcaDoElenco();
const rivalFraco = { atq: f.atq - 4, def: f.def - 4 }, rivalForte = { atq: f.atq + 4, def: f.def + 4 };
const pc = (postura, o) => { const a = A.ajusteDeContexto(f, { ...o, postura }); return a.atq + a.def; };
conf(pc("ataque", { casa: true, rival: rivalFraco }) > pc("equilibrado", { casa: true, rival: rivalFraco }), "pra cima em casa contra fraco deveria compensar");
conf(pc("ataque", { casa: false, rival: rivalForte }) < pc("equilibrado", { casa: false, rival: rivalForte }), "pra cima fora contra forte deveria custar");
conf(pc("retranca", { casa: false, rival: rivalForte }) > pc("equilibrado", { casa: false, rival: rivalForte }), "fechadinho fora contra forte deveria compensar");
let viuJanela = false;
while (!Motor.terminou(D.temp)) {
  if (A.janelaAberta(D.temp) && !viuJanela) {
    viuJanela = true;
    const k = 3, sai = A.todasVagas()[k].jogador, leque = A.lequeDaJanela(k);
    conf(leque.length === 5 && !leque.includes(sai), "leque da janela");
    conf(A.aplicarJanela(k, leque[0]) && A.todasVagas()[k].jogador === leque[0] && !A.janelaAberta(D.temp), "janela nao trocou ou nao fechou");
  }
  Motor.avancar(D.temp);
}
conf(viuJanela, "janela nunca abriu");
conf(D.temp.ttc.ocorrencias.every((o) => o.jogador && o.jogos >= 1), "ocorrencia de lesao/suspensao invalida");
// 5) cobradores de estrangeiro e expulso fora da fila
const cobradores = vm.runInContext("cobradores", ctx);
const est = cobradores("Boca Juniors"); conf(!est[0].startsWith("cobrador") && est.length >= 5, "Boca sem nomes: " + est.slice(0, 3));
const lista = cobradores("Flamengo"); conf(!cobradores("Flamengo", new Set([lista[0]])).includes(lista[0]), "expulso continua na fila");
// 6) desafio do dia: mesmo leque com Math.random diferentes; semente muda com a data
const primeiroLeque = (seed, data) => { A.semear(seed); novoDraft(); D.desafio = { data, semente: `ttc-${data}` }; const l = A.lequeAtual().map((j) => j.player_id).join(","); D.desafio = null; return l; };
conf(primeiroLeque(1, "2026-09-27") === primeiroLeque(2, "2026-09-27"), "desafio: leques diferentes no mesmo dia");
conf(primeiroLeque(1, "2026-09-27") !== primeiroLeque(1, "2026-09-28"), "desafio: mesmo leque em dias diferentes");
// 6b) reta final: rodada do Brasileirao so e decisiva com algo em jogo; mata-mata sempre
{
  let semNada = 0, comAlgo = 0, mataNao = 0, cedo = 0, incoerente = 0;
  for (let s = 0; s < 12; s++) {
    A.semear(600 + s); D.sai = "Chapecoense"; D.continental = s % 2 ? "sul" : "lib";
    novoDraft(); for (let k = 0; k < 16; k++) { D.vaga = k; A.todasVagas()[k].jogador = A.lequeAtual()[0]; }
    const t = A.montarTemporada({ semente: 900 + s, rngGrupo: A.random }); D.temp = t; D.times = t.times;
    while (!Motor.terminou(t)) {
      const e = t.etapas[t.i], prox = Motor.agenda(t, 1)[0];
      if (prox && prox.indice === t.i) {
        const dec = A.decisivaParaUsuario(t, e);
        if (e.mata && !dec) mataNao++;
        if (e.comp === "bra") {
          const ej = A.emJogoNoBrasileirao(t);
          if (dec !== Boolean(ej)) incoerente++;
          if (dec && 38 - t.bra.rodada > 6) cedo++;
          if (t.bra.rodada >= 35) { if (dec) comAlgo++; else semNada++; }
          if (dec && !/^Em jogo: /.test(A.contextoDecisivo(t, e).texto)) incoerente++;
        }
      }
      Motor.avancar(t);
    }
  }
  conf(mataNao === 0, "mata-mata nao decisivo");
  conf(cedo === 0 && incoerente === 0, `rodada decisiva fora da reta final (${cedo}) ou sem 'Em jogo' no cartao (${incoerente})`);
  conf(semNada > 0 && comAlgo > 0, `36a-38a deveriam ser decisivas so as vezes (decisivas ${comAlgo}, sem nada em jogo ${semNada})`);
}

// 7) fluxo pelas funcoes de tela reais, com DOM falso (domfalso.js): botoes com cartao aberto
(async () => {
  const { domFalso } = require("./domfalso.js");
  const T = carregar(domFalso());
  const run = (c) => vm.runInContext(c, T.ctx);
  const TD = T.D;
  const montar = (seed, desafio = null) => {
    T.semear(seed);
    TD.nome = "Teste FC"; TD.sai = "Chapecoense"; TD.continental = "lib"; TD.dificuldade = "normal"; TD.esquema = "4-3-3"; TD.desafio = desafio;
    TD.onze = T.ESQUEMAS["4-3-3"].map(([pos, x, y]) => ({ pos, x, y, jogador: null })); TD.banco = T.BANCO_VAGAS.map((pos) => ({ pos, jogador: null }));
    TD.leques = {}; TD.trocasUsadas = 0;
    for (let k = 0; k < 16; k++) { TD.vaga = k; T.todasVagas()[k].jogador = T.lequeAtual()[0]; }
    TD.vaga = -1;
    run("comecarTemporada()");
  };
  // 7a) regressao: "Ate o proximo jogo decisivo" com o cartao do decisivo aberto
  montar(11);
  await run("simularAteDecisivo()");
  let c = run("D.cartao");
  conf(c && c.tipo === "decisivo", "1o aperto em 'ate o decisivo' nao mostrou o cartao");
  const pendente = c && c.etapa;
  conf(pendente && /contra /.test(run("contextoDecisivo(D.temp, D.cartao.etapa)").texto), "cartao do mata-mata sem adversario (sorteio nao revelado)");
  const iAntes = TD.temp.i;
  await run("simularAteDecisivo()");
  conf(TD.temp.i > iAntes, "BUG 1: 'ate o decisivo' com cartao aberto nao andou");
  conf(TD.temp.historico.some((h) => h.etapa === pendente && h.doUsuario), "o decisivo pendente nao foi jogado");
  conf(TD.temp.ttc.posturas.get(pendente) === "equilibrado", "decisivo pulado deveria ir no Equilibrado");
  let viuJanela = false, parado = 0, apertos = 0;
  for (; apertos < 80 && !T.Motor.terminou(TD.temp); apertos++) {
    const antes = TD.temp.i;
    await run("simularAteDecisivo()");
    c = run("D.cartao");
    if (c && c.tipo === "janela") viuJanela = true;
    if (TD.temp.i === antes && !T.Motor.terminou(TD.temp)) parado++;
  }
  conf(T.Motor.terminou(TD.temp) && parado === 0, `temporada nao terminou so com 'ate o decisivo' (${apertos} apertos, ${parado} sem andar)`);
  conf(viuJanela, "janela nao apareceu no caminho do 'ate o decisivo'");
  conf(TD.temp.ttc.janelaUsada, "passar pela janela com outro botao deveria fechar a janela");
  // 7b) "Proximo jogo" com o cartao aberto joga o decisivo
  montar(12);
  for (let k = 0; k < 40 && !(run("D.cartao") && run("D.cartao").tipo === "decisivo"); k++) await run("proximoJogo()");
  c = run("D.cartao");
  conf(c && c.tipo === "decisivo", "proximo jogo nunca mostrou cartao de decisivo");
  const n0 = TD.temp.historico.filter((h) => h.doUsuario).length;
  await run("proximoJogo()");
  conf(TD.temp.historico.filter((h) => h.doUsuario).length === n0 + 1 && TD.temp.historico.some((h) => h.etapa === c.etapa && h.doUsuario), "proximo jogo com cartao aberto nao jogou o decisivo");
  // 7c) postura escolhida no cartao vale no jogo
  for (let k = 0; k < 60 && !(run("D.cartao") && run("D.cartao").tipo === "decisivo"); k++) await run("proximoJogo()");
  c = run("D.cartao");
  if (c && c.tipo === "decisivo") {
    const botao = run("$('jogo').querySelectorAll('.pd-posturas .botao')").find((b) => b.textContent === "Fechadinho");
    botao.click(); await new Promise((r) => setTimeout(r, 20));
    conf(TD.temp.ttc.posturas.get(c.etapa) === "retranca" && TD.temp.historico.some((h) => h.etapa === c.etapa), "botao Fechadinho nao jogou com a postura");
  }
  // 7d) janela: aparece no "Proximo jogo" e da pra pular
  montar(13);
  let janela = null;
  for (let k = 0; k < 120 && !T.Motor.terminou(TD.temp); k++) {
    await run("proximoJogo()");
    c = run("D.cartao");
    if (c && c.tipo === "janela") { janela = TD.temp.etapas[TD.temp.i].data; break; }
  }
  conf(Boolean(janela), "janela nao apareceu no 'proximo jogo'");
  const seguir = run("$('jogo').querySelectorAll('.janela .botao')").find((b) => b.textContent === "Seguir sem trocar");
  seguir.click();
  conf(!run("D.cartao") && TD.temp.ttc.janelaUsada && !run("janelaAberta()"), "'Seguir sem trocar' nao fechou a janela");
  // 7e) desafio: texto de copiar com data, semente e a linha de comparacao
  montar(14, { data: "2026-09-27", semente: "ttc-2026-09-27" });
  await run("simular(() => false, { respeitarDecisivo: false })");
  conf(T.Motor.terminou(TD.temp), "simular tudo nao terminou a temporada");
  let copiado = "";
  T.ctx.navigator.clipboard.writeText = async (t) => { copiado = t; };
  const copiar = run("$('balanco').querySelectorAll('.bl-rodape .botao')").find((b) => b.textContent === "Copiar resultado");
  copiar.click(); await new Promise((r) => setTimeout(r, 20));
  conf(/^Desafio 27\/09: .*— e você\?$/m.test(copiado) && /semente ttc-2026-09-27/.test(copiado), "texto do desafio sem data/semente/linha de comparacao: " + copiado.split("\n")[0]);
  console.log("exemplo do texto do desafio:\n  " + copiado.split("\n").slice(0, 3).join("\n  "));
  console.log(`janela abriu antes do jogo de ${janela}`);
  console.log(`testes de UI: ${ok} ok, ${falhas} falhas`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.log("FALHOU com excecao:", e); process.exit(1); });
