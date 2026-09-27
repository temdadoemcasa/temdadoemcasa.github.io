// Bateria (fase 2): draft com banco + temporada completa, com as funcoes reais do draft.js.
// Uso: node sim.js <plano.json> <inicio> <fim> <saida.jsonl>
// Cada tentativa i usa semente SEMENTE_BASE + 1000003*i + 7 (SEMENTE_BASE padrao 0). O mesmo
// gerador alimenta o Math.random do draft.js, as politicas e a semente do motor.
"use strict";
const fs = require("fs");
const { carregar } = require("./carregar.js");
const A = carregar();
const { D, ESQUEMAS, Motor } = A;
const BASE = Number(process.env.SEMENTE_BASE || 0);

// ---- politicas de escolha no leque ----
const EIXOS_MEDIOS = { RIT: 70, FIN: 70, PAS: 70, DRI: 70, DEF: 70, FIS: 70, REF: 70, EVI: 70, MAO: 70, PES: 70, SAI: 70 };
const vagaVazia = (pos) => ({ nome: "_vaga", posicao: A.FAMILIA[A.VAGAS[pos][0]][0], overall: 75, eixos: EIXOS_MEDIOS });
// forca do time (ataque + defesa) com o candidato na vaga k e as vagas vazias com um jogador medio
function forcaCom(j, k) {
  const onze = D.onze.map((s, i) => ({ pos: s.pos, jogador: i === k ? j : (s.jogador || vagaVazia(s.pos)) }));
  const banco = D.banco.map((s, i) => ({ pos: s.pos, jogador: i + D.onze.length === k ? j : (s.jogador || vagaVazia(s.pos)) }));
  const f = A.forcaDoElenco(onze, banco, D.esquema);
  return f.atq + f.def;
}
const maior = (leque, f) => leque.reduce((m, j) => (f(j) > f(m) ? j : m));
const POL = {
  aleatorio: (leque) => leque[Math.floor(A.random() * leque.length)],
  melhor: (leque) => maior(leque, (j) => j.overall),
  pior: (leque) => maior(leque, (j) => -j.overall),
  humano: (leque) => (A.random() < 0.7 ? POL.melhor(leque) : POL.aleatorio(leque)),
  inteligente: (leque, k) => maior(leque, (j) => forcaCom(j, k)),
};

// espelha comecar-draft + abrirLeque/lequeAtual + escolher + trocar-leque (draft.js)
function draftar(p) {
  D.dificuldade = p.dificuldade || "normal";
  D.esquema = p.esquema;
  D.onze = ESQUEMAS[p.esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: null }));
  D.banco = A.BANCO_VAGAS.map((pos) => ({ pos, jogador: null }));
  D.vaga = 0; D.trocas = A.DIFICULDADES[D.dificuldade].trocas; D.trocasUsadas = 0; D.leques = {};
  const log = [];
  let guard = 0;
  const tijolo = A.NIVEIS.find((n) => n.id === "tijolo").min;
  while (D.vaga >= 0) {
    if (++guard > 100) throw new Error("draft em loop");
    const k = D.vaga;
    const slot = A.todasVagas()[k];
    let leque = A.lequeAtual();
    if (p.troca && D.trocas > 0 && Math.max(...leque.map((j) => j.overall)) < tijolo) {
      D.trocas -= 1; D.trocasUsadas += 1; delete D.leques[k];
      leque = A.lequeAtual();
    }
    const esc = POL[p.politica](leque, k);
    const maiorNota = Math.max(...leque.map((j) => j.overall));
    log.push({ pos: slot.pos, ov: esc.overall, max: maiorNota, n: leque.length, naoMaior: esc.overall < maiorNota, enc: A.encaixeNaVaga(esc, slot.pos), id: esc.player_id });
    slot.jogador = esc;
    delete D.leques[k];
    D.vaga = A.proximaVaga();
  }
  return log;
}

// ---- decisoes na temporada ("bom") ----
function posturaBoa(temp, etapa) {
  const ctx = A.contextoDecisivo(temp, etapa);
  if (etapa.mata && typeof ctx.saldoIda === "number") return ctx.saldoIda < 0 ? "ataque" : ctx.saldoIda > 0 ? "retranca" : "equilibrado";
  if (etapa.comp === "bra" && ctx.rival) {
    const tab = Motor.ordenar(temp.bra.tabela);
    const pos = (id) => tab.findIndex((l) => l.id === id) + 1;
    const pts = (id) => temp.bra.tabela.get(id).pts;
    const eu = temp.usuario, dif = pts(eu) - pts(ctx.rival);
    if (pos(eu) >= 17) return "ataque";
    if (Math.abs(dif) <= 3) return dif < 0 ? "ataque" : dif > 0 ? "retranca" : "equilibrado";
  }
  return "equilibrado";
}
// jogo comum: pra cima em casa contra mais fraco, fechadinho fora contra mais forte
function posturaDoContexto(temp, par) {
  if (!par) return "equilibrado";
  const eu = temp.usuario, casa = par.casa === eu, rival = temp.times[casa ? par.fora : par.casa], me = temp.times[eu];
  const dif = (rival.atq + rival.def) - (me.atq + me.def);
  if (casa && !par.neutro && dif < -2) return "ataque";
  if (!casa && !par.neutro && dif > 2) return "retranca";
  return "equilibrado";
}
function melhorEsquema() {
  const jogadores = A.todasVagas().map((s) => s.jogador);
  let melhor = D.esquema, mv = -Infinity;
  for (const e of Object.keys(ESQUEMAS)) {
    const r = A.escalarNoEsquema(jogadores, e);
    const f = A.forcaDoElenco(r.onze, r.banco, e);
    if (f.atq + f.def > mv + 1e-9) { mv = f.atq + f.def; melhor = e; }
  }
  return melhor;
}
function janelaBoa(temp) {
  temp.ttc.janelaVista = true;
  const vagas = A.todasVagas();
  // sai o titular que menos rende na vaga (lesionado longo conta como meio jogador)
  let pior = -1, pv = Infinity;
  D.onze.forEach((s, k) => {
    const lesao = temp.ttc.lesoes.get(s.jogador) || 0;
    const v = A.valorNaVaga(s.jogador, s.pos) * (lesao > 4 ? 0.5 : 1);
    if (v < pv) { pv = v; pior = k; }
  });
  const antes = forcaCom(vagas[pior].jogador, pior);
  const leque = A.lequeDaJanela(pior);
  const melhor = maior(leque, (j) => forcaCom(j, pior));
  if (forcaCom(melhor, pior) > antes) { A.aplicarJanela(pior, melhor); return 1; }
  temp.ttc.janelaUsada = true;
  return 0;
}

// ---- temporada ----
function temporada(p) {
  // decisao: padrao | bom (tudo) | postura | janela | esquema | semEsquema (postura + janela)
  const quer = (o) => p.decisao === "bom" || p.decisao === o || (p.decisao === "semEsquema" && o !== "esquema");
  if (quer("esquema")) { const e = melhorEsquema(); if (e !== D.esquema) A.trocarEsquema(e); }
  const temp = A.montarTemporada({ semente: Math.floor(A.random() * 1e9), rngGrupo: A.random });
  D.temp = temp; D.times = temp.times;
  const eu = temp.usuario;
  const problemas = [];
  const jogosPorComp = { bra: 0, cdb: 0, lib: 0, sul: 0 };
  const jogosDoTimePorData = new Map();
  const liga = { gols: 0, jogos: 0, casa: 0, emp: 0, fora: 0, zz: 0, seis: 0 };
  const mata = { confrontos: 0, penaltis: 0 };
  let n = 0, agendaErros = 0, expulsoMarca = 0, decisivos = 0, posturasUsadas = 0, janela = 0, garotos = 0;
  const doDraft = D.onze.map((s) => s.jogador);
  if (!(temp.times[eu] && temp.times[eu].usuario && temp.times[eu].onze.every((j, k) => j === doDraft[k]))) problemas.push("clube do usuario nao e o draftado");
  const t0 = process.hrtime.bigint();
  while (!Motor.terminou(temp)) {
    if (++n > 2000) { problemas.push("loop: >2000 etapas"); break; }
    if (quer("janela") && A.janelaAberta(temp) && !temp.ttc.janelaVista) janela = janelaBoa(temp);
    const prevista = Motor.agenda(temp, 1)[0];
    const esperaJogo = prevista && prevista.indice === temp.i;
    const e = temp.etapas[temp.i];
    if (esperaJogo && A.decisivaParaUsuario(temp, e)) {
      decisivos++;
      if (quer("postura")) {
        let pp = posturaBoa(temp, e);
        if (pp === "equilibrado") pp = posturaDoContexto(temp, prevista.jogo);
        temp.ttc.posturas.set(e, pp);
        if (pp !== "equilibrado") posturasUsadas++;
      }
    } else if (esperaJogo && quer("postura")) temp.ttc.posturaPadrao = posturaDoContexto(temp, prevista.jogo);
    const x = Motor.avancar(temp);
    if (Boolean(esperaJogo) !== Boolean(x.doUsuario)) { agendaErros++; if (agendaErros <= 3) problemas.push(`agenda!=jogo em ${x.etapa.rotulo}`); }
    jogosPorComp[x.etapa.comp] += x.jogos.length;
    const noDia = new Set();
    for (const j of x.jogos) {
      if (j.casa === j.fora) problemas.push(`time contra si: ${j.casa}`);
      if (!temp.times[j.casa] || !temp.times[j.fora]) problemas.push(`time indefinido: ${j.casa} x ${j.fora}`);
      if (!Number.isFinite(j.gc) || !Number.isFinite(j.gf)) problemas.push(`placar NaN ${x.etapa.rotulo}`);
      for (const t of [j.casa, j.fora]) {
        if (noDia.has(t)) problemas.push(`${t} 2x na mesma etapa`);
        noDia.add(t);
        const k = `${t}|${x.etapa.data}`;
        jogosDoTimePorData.set(k, (jogosDoTimePorData.get(k) || 0) + 1);
      }
      for (const v of j.eventos.filter((ev) => ev.tipo === "vermelho" && ev.autor)) {
        if (j.eventos.some((ev) => (ev.tipo === "gol" || ev.tipo === "penalti_perdido") && ev.lado === v.lado && ev.autor === v.autor && ev.min >= v.min && ev !== v)) expulsoMarca++;
      }
      // liga CPU: so jogos sem o usuario (realismo da Serie A)
      if (x.etapa.comp === "bra" && j.casa !== eu && j.fora !== eu) {
        liga.jogos++; liga.gols += j.gc + j.gf;
        if (j.gc > j.gf) liga.casa++; else if (j.gc < j.gf) liga.fora++; else liga.emp++;
        if (j.gc + j.gf === 0) liga.zz++;
        if (j.gc + j.gf >= 6) liga.seis++;
      }
      if (j.classificado && j.agregado !== undefined) { mata.confrontos++; if (j.penaltis) mata.penaltis++; }
      if (j.penaltis && j.penaltis[0] === j.penaltis[1]) problemas.push("penaltis empatados");
      if (j.agregado && !j.penaltis && j.agregado[0] === j.agregado[1]) problemas.push("agregado empatado sem penaltis");
    }
    if (x.doUsuario && temp.ttc && x.doUsuario.eventos) garotos += 0;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  let diasSeguidos = 0;
  const porTime = new Map();
  for (const k of jogosDoTimePorData.keys()) { const [t, d] = k.split("|"); if (!porTime.has(t)) porTime.set(t, []); porTime.get(t).push(Date.parse(d)); }
  for (const [k, v] of jogosDoTimePorData) if (v > 1) { problemas.push(`dois jogos no mesmo dia: ${k}`); break; }
  for (const ds of porTime.values()) { ds.sort((a, b) => a - b); for (let i = 1; i < ds.length; i++) if (ds[i] - ds[i - 1] <= 864e5) diasSeguidos++; }
  const tab = Motor.ordenar(temp.bra.tabela);
  for (const l of tab) if (l.j !== 38) { problemas.push(`${l.id} jogou ${l.j} no BR`); break; }
  const esperado = { bra: 380, cdb: 61, lib: 125, sul: 141 };
  for (const c of Object.keys(esperado)) if (jogosPorComp[c] !== esperado[c]) problemas.push(`${c}: ${jogosPorComp[c]} jogos`);
  const pos = tab.findIndex((l) => l.id === eu) + 1;
  // tabela so da CPU (sem o usuario): pontos por posicao
  const cpu = tab.filter((l) => l.id !== eu);
  const ocorr = temp.ttc.ocorrencias;
  return {
    pos, pts: tab[pos - 1].pts, atq: temp.times[eu].atq, def: temp.times[eu].def,
    tituloBra: temp.campeoes.bra === eu, tituloCdb: temp.campeoes.cdb === eu, tituloLib: temp.campeoes.lib === eu, tituloSul: temp.campeoes.sul === eu,
    campeoes: Object.fromEntries(Object.entries(temp.campeoes).map(([c, id]) => [c, id === eu ? "EU" : id])),
    eliminado: temp.eliminado, cpuPts: cpu.map((l) => l.pts), cpuTop: cpu[0].id,
    liga, mata, problemas, ms, agendaErros, expulsoMarca, diasSeguidos, decisivos, posturasUsadas, janela, esquemaFinal: D.esquema,
    lesoes: ocorr.filter((o) => o.tipo === "lesão").length, suspensoes: ocorr.filter((o) => o.tipo === "suspensão").length,
    entrosamento: A.entrosamento(D.onze.map((s) => s.jogador)).ligacoes,
  };
}

function tentativa(p, i) {
  A.semear(BASE + 1000003 * (p.par ?? i) + 7);
  D.sai = p.sai || "Chapecoense"; D.continental = p.continental; D.nome = "Tem Dado FC"; D.desafio = null; D.temp = null;
  let draft, res, erro = null;
  const t0 = process.hrtime.bigint();
  try {
    draft = draftar(p);
    const msDraft = Number(process.hrtime.bigint() - t0) / 1e6;
    res = temporada(p);
    res.msDraft = msDraft;
  } catch (e) { erro = String(e && e.stack || e).split("\n").slice(0, 4).join(" | "); }
  const escolhas = draft || [];
  return { i, ...p, erro, mediaOnze: escolhas.slice(0, 11).reduce((s, d) => s + d.ov, 0) / 11,
    naoMaior: escolhas.filter((d) => d.naoMaior && d.n > 1).length, escolhas: escolhas.length,
    improvisados: escolhas.slice(0, 11).filter((d) => d.enc < 1).length, ...(res || {}) };
}

if (require.main === module) {
  const [planoArq, ini, fim, saida] = process.argv.slice(2);
  const plano = JSON.parse(fs.readFileSync(planoArq, "utf8"));
  const out = fs.createWriteStream(saida);
  for (let k = Number(ini); k < Number(fim); k++) out.write(JSON.stringify(tentativa(plano[k], k)) + "\n");
  out.end();
}
module.exports = { tentativa, A, draftar, temporada, forcaCom, POL, melhorEsquema };
