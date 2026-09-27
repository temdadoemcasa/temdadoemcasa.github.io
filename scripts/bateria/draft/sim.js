// Bateria: draft (funcoes reais de draft.js) + temporada completa (motor.js real).
// Uso: node sim.js <plano.json> <inicio> <fim> <saida.jsonl>
// Cada tentativa i usa semente 1000003*i+7. O mesmo gerador alimenta o Math.random
// do draft.js (leque, sorteio do grupo), as politicas de escolha e a semente do
// motor (como em comecarTemporada): mesma semente, mesma tentativa.
"use strict";
const fs = require("fs");
const { carregar } = require("./carregar.js");
const A = carregar();
const { D, ESQUEMAS, Motor } = A;

// ---- politicas de escolha no leque ----
const POL = {
  aleatorio: (leque) => leque[Math.floor(A.random() * leque.length)],
  melhor: (leque) => leque.reduce((m, j) => (j.overall > m.overall ? j : m)),
  pior: (leque) => leque.reduce((m, j) => (j.overall < m.overall ? j : m)),
  humano: (leque) => (A.random() < 0.7 ? POL.melhor(leque) : POL.aleatorio(leque)),
};

// espelha comecar-draft (draft.js:1149-1158) + abrirLeque (draft.js:189-194) + escolher (draft.js:211-217)
// + trocar-leque (draft.js:1159). O ⇄ (moverDeVaga) nao e modelado.
function draftar(esquema, politica, usaTroca) {
  D.esquema = esquema;
  D.onze = ESQUEMAS[esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: null }));
  D.vaga = 0; D.trocas = 1; D.leques = {};
  const log = [];
  let guard = 0;
  while (D.vaga >= 0) {
    if (++guard > 100) throw new Error("draft em loop");
    const slot = D.onze[D.vaga];
    const na = D.onze.map((s) => s.jogador).filter(Boolean);
    if (!D.leques[D.vaga]) D.leques[D.vaga] = A.sortearLeque(slot.pos);
    D.leques[D.vaga] = D.leques[D.vaga].filter((j) => !na.includes(j));
    if (!D.leques[D.vaga].length) D.leques[D.vaga] = A.sortearLeque(slot.pos);
    let leque = D.leques[D.vaga];
    if (usaTroca && D.trocas > 0 && Math.max(...leque.map((j) => j.overall)) < A.NIVEIS.find((n) => n.id === "tijolo").min) {
      D.trocas -= 1; delete D.leques[D.vaga];
      D.leques[D.vaga] = A.sortearLeque(slot.pos); leque = D.leques[D.vaga];
    }
    if (leque.length !== 5) log.push(`leque com ${leque.length} opcoes na vaga ${slot.pos}`);
    const esc = POL[politica](leque);
    const cabe = A.cabeNaVaga(esc, slot.pos);
    D.onze[D.vaga].jogador = esc;
    delete D.leques[D.vaga];
    D.vaga = A.proximaVaga();
    log.push({ pos: slot.pos, ov: esc.overall, max: Math.max(...leque.map((j) => j.overall)), min: Math.min(...leque.map((j) => j.overall)),
      niveis: leque.map((j) => A.nivel(j.overall).id), id: esc.player_id, cabe });
  }
  return log;
}

// espelha comecarTemporada (draft.js:333-344), sem DOM, e roda ate o fim com checagens
function temporada() {
  const serieA = A.serieAComUsuario();
  const eu = Object.values(serieA).find((t) => t.usuario);
  D.regrasTemp = A.regrasComUsuario(eu.id);
  const saiu = Motor.timesDaSerieA(D.r)[D.sai];
  D.times = { ...(saiu ? { [D.sai]: saiu } : {}), ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
  const ids = Object.keys(serieA);
  const temp = Motor.criarTemporada({ regras: D.regrasTemp, times: D.times, serieA: ids, usuario: eu.id, semente: Math.floor(A.random() * 1e9) });
  const problemas = [];
  const jogosPorComp = { bra: 0, cdb: 0, lib: 0, sul: 0 };
  const jogosDoTimePorData = new Map();
  const liga = { gols: 0, jogos: 0, casa: 0, emp: 0, fora: 0, zz: 0, seis: 0, pen: 0, vermelho: 0 };
  const mata = { jogos: 0, gols: 0, penaltis: 0, confrontos: 0 };
  const faseUsuario = {};
  let n = 0, agendaErros = 0, expulsoMarca = 0, expulsoBate = 0;
  // o clube do usuario em D.times e mesmo o que foi draftado?
  const doDraft = D.onze.map((s) => s.jogador);
  const usuarioOk = Boolean(temp.times[eu.id] && temp.times[eu.id].usuario && temp.times[eu.id].onze
    && temp.times[eu.id].onze.length === 11 && temp.times[eu.id].onze.every((j, k) => j === doDraft[k]));
  if (!usuarioOk) problemas.push("clube do usuario nao e o draftado");
  const t0 = process.hrtime.bigint();
  while (!Motor.terminou(temp)) {
    if (++n > 2000) { problemas.push("loop: >2000 etapas"); break; }
    const prevista = Motor.agenda(temp, 1)[0];
    const esperaJogo = prevista && prevista.indice === temp.i;
    const x = Motor.avancar(temp);
    if (Boolean(esperaJogo) !== Boolean(x.doUsuario)) {
      agendaErros++;
      if (agendaErros <= 3) problemas.push(`agenda!=jogo em ${x.etapa.rotulo}: agenda=${Boolean(esperaJogo)} jogou=${Boolean(x.doUsuario)} elim=${JSON.stringify(temp.eliminado)}`);
    }
    jogosPorComp[x.etapa.comp] += x.jogos.length;
    const noDia = new Set();
    for (const j of x.jogos) {
      if (j.casa === j.fora) problemas.push(`time contra si: ${j.casa} ${x.etapa.rotulo}`);
      if (!temp.times[j.casa] || !temp.times[j.fora]) problemas.push(`time indefinido: ${j.casa} x ${j.fora} ${x.etapa.rotulo}`);
      if (!Number.isFinite(j.gc) || !Number.isFinite(j.gf)) problemas.push(`placar NaN ${x.etapa.rotulo}`);
      for (const t of [j.casa, j.fora]) {
        if (noDia.has(t)) problemas.push(`${t} 2x na mesma etapa ${x.etapa.rotulo}`);
        noDia.add(t);
        const k = `${t}|${x.etapa.data}`;
        jogosDoTimePorData.set(k, (jogosDoTimePorData.get(k) || 0) + 1);
      }
      for (const ev of j.eventos) if (ev.tipo === "gol" && !ev.autor) problemas.push(`gol sem autor ${j.casa}x${j.fora}`);
      for (const v of j.eventos.filter((e) => e.tipo === "vermelho" && e.autor)) {
        for (const e of j.eventos) {
          if (e.lado !== v.lado || e.autor !== v.autor || e.min <= v.min) continue;
          if (e.tipo === "gol") expulsoMarca++;
          if (e.tipo === "penalti_perdido") expulsoBate++;
        }
      }
      if (x.etapa.comp === "bra") {
        liga.jogos++; liga.gols += j.gc + j.gf;
        if (j.gc > j.gf) liga.casa++; else if (j.gc < j.gf) liga.fora++; else liga.emp++;
        if (j.gc + j.gf === 0) liga.zz++;
        if (j.gc + j.gf >= 6) liga.seis++;
        liga.pen += j.eventos.filter((e) => e.tipo === "gol" && e.penalti).length;
        liga.vermelho += j.eventos.filter((e) => e.tipo === "vermelho").length;
      }
      if (x.etapa.mata) { mata.jogos++; mata.gols += j.gc + j.gf; if (j.penaltis) mata.penaltis++; if (j.classificado) mata.confrontos++; }
      if (j.penaltis) {
        const [a, b] = j.penaltis;
        if (a === b) problemas.push("penaltis empatados");
        if (j.penaltis.cobrancas.length < 6 && Math.max(a, b) < 3) problemas.push(`penaltis curtos ${a}x${b}`);
      }
      if (j.agregado && !j.penaltis && j.agregado[0] === j.agregado[1]) problemas.push("agregado empatado sem penaltis");
    }
    if (x.doUsuario && x.etapa.mata) faseUsuario[x.etapa.comp] = x.etapa.fase;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  for (const [k, v] of jogosDoTimePorData) if (v > 1) { problemas.push(`dois jogos no mesmo dia: ${k}`); break; }
  const tab = Motor.ordenar(temp.bra.tabela);
  for (const l of tab) if (l.j !== 38) { problemas.push(`${l.id} jogou ${l.j} no BR`); break; }
  const esperado = { bra: 380, cdb: 61, lib: 125, sul: 141 };
  for (const c of Object.keys(esperado)) if (jogosPorComp[c] !== esperado[c]) problemas.push(`${c}: ${jogosPorComp[c]} jogos (esperado ${esperado[c]})`);
  const pos = tab.findIndex((l) => l.id === eu.id) + 1;
  const linha = tab[pos - 1];
  // posicao do usuario em forca na liga (como mostrarResumo, draft.js:273)
  const ranking = Object.values(serieA).sort((a, b) => (b.atq + b.def) - (a.atq + a.def));
  const posForca = ranking.findIndex((t) => t.usuario) + 1;
  // dados da temporada inteira de clubes CPU
  const forcaCpu = Object.fromEntries(ids.map((id) => [id, serieA[id].atq + serieA[id].def]));
  return {
    pos, pts: linha.pts, v: linha.v, gp: linha.gp, gc: linha.gc,
    atq: eu.atq, def: eu.def, posForca,
    campeoes: temp.campeoes, eliminado: temp.eliminado, faseUsuario,
    tituloBra: temp.campeoes.bra === eu.id, tituloCdb: temp.campeoes.cdb === eu.id,
    tituloLib: temp.campeoes.lib === eu.id, tituloSul: temp.campeoes.sul === eu.id,
    tabela: tab.map((l) => [l.id === eu.id ? "__EU__" : l.id, l.pts, l.gp, l.gc]),
    liga, mata, problemas, ms, usuarioId: eu.id, usuarioOk, expulsoMarca, expulsoBate, etapas: temp.etapas.length, agendaErros,
    grupoSai: D.grupo, forcaCpuTop: Object.entries(forcaCpu).sort((a, b) => b[1] - a[1])[0][0],
  };
}

function tentativa(p, i) {
  A.semear(1000003 * i + 7);
  D.sai = p.sai || "Chapecoense";
  D.continental = p.continental;
  D.nome = p.nome || "Tem Dado FC";
  const t0 = process.hrtime.bigint();
  let draft, res, erro = null;
  try {
    draft = draftar(p.esquema, p.politica, p.troca);
    const msDraft = Number(process.hrtime.bigint() - t0) / 1e6;
    res = temporada();
    res.msDraft = msDraft;
  } catch (e) { erro = String(e && e.stack || e).split("\n").slice(0, 3).join(" | "); }
  return { i, ...p, draft: draft && draft.filter((d) => typeof d === "object"), avisosDraft: draft && draft.filter((d) => typeof d === "string"),
    mediaOnze: draft ? draft.filter((d) => typeof d === "object").reduce((s, d) => s + d.ov, 0) / 11 : null, erro, ...(res || {}) };
}

if (require.main === module) {
  const [planoArq, ini, fim, saida] = process.argv.slice(2);
  const plano = JSON.parse(fs.readFileSync(planoArq, "utf8"));
  const out = fs.createWriteStream(saida);
  for (let k = Number(ini); k < Number(fim); k++) out.write(JSON.stringify(tentativa(plano[k], k)) + "\n");
  out.end();
}
module.exports = { tentativa, A };
