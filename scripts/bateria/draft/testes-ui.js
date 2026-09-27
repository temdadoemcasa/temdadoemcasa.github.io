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
console.log(`testes de UI: ${ok} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
