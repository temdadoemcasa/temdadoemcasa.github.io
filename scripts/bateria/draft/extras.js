// Fase 2: time dos sonhos (teto), tempo das chances do resumo (50 temporadas) e desafio do dia
"use strict";
const { A } = require("./sim.js");
const { D, Motor, ESQUEMAS } = A;
function onzeExtremo(esquema, dir) {
  const usados = new Set();
  const pega = (pos) => {
    const fs = A.VAGAS[pos][3] || [A.VAGAS[pos][0]];
    const pool = A.r.indice.comNota.filter((j) => !usados.has(j) && A.funcoesDe(j).some((f) => fs.includes(f))).sort((a, b) => dir * (b.overall - a.overall));
    usados.add(pool[0]); return pool[0];
  };
  const onze = ESQUEMAS[esquema].map(([pos, x, y]) => ({ pos, x, y, jogador: pega(pos) }));
  const banco = A.BANCO_VAGAS.map((pos) => ({ pos, jogador: pega(pos) }));
  return { onze, banco };
}
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
for (const [nome, dir] of [["sonhos", 1], ["pesadelo", -1]]) {
  for (const esq of ["4-3-3", "3-4-2-1", "5-3-2"]) {
    D.dificuldade = "normal"; D.sai = "Chapecoense"; D.esquema = esq; D.desafio = null;
    const t = onzeExtremo(esq, dir); D.onze = t.onze; D.banco = t.banco;
    const r = { br: 0, tit: 0, z4: 0, pos: [] };
    for (let k = 0; k < 200; k++) {
      A.semear(5000 + k); D.continental = k % 2 ? "sul" : "lib";
      const x = A.simularTemporadaRapida(Math.floor(A.random() * 1e9), A.random);
      r.pos.push(x.pos); if (x.bra) r.br++; if (x.titulo) r.tit++; if (x.pos >= 17) r.z4++;
    }
    const f = A.forcaDoElenco();
    console.log(`time dos ${nome} ${esq}: força ${f.atq.toFixed(1)}/${f.def.toFixed(1)} média ${(D.onze.reduce((s, x) => s + x.jogador.overall, 0) / 11).toFixed(1)} | pos média ${media(r.pos).toFixed(1)} campeão BR ${r.br / 2}% algum título ${r.tit / 2}% Z4 ${r.z4 / 2}%`);
  }
}
// tempo das chances (50 temporadas rapidas, como no resumo)
{
  const t = onzeExtremo("4-3-3", 1); D.onze = t.onze; D.banco = t.banco; D.esquema = "4-3-3";
  const tempos = [];
  for (let rep = 0; rep < 5; rep++) {
    const t0 = process.hrtime.bigint();
    const rng = Motor.rngDe(77 + rep);
    for (let k = 0; k < 50; k++) A.simularTemporadaRapida(Math.floor(rng() * 1e9), rng);
    tempos.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  console.log(`chances do resumo (50 temporadas): ${tempos.map((x) => x.toFixed(0)).join(", ")} ms (meta <= 1000; no Chromium, medido no jogo: ~0,3 s)`);
}
// desafio do dia: dois jogadores diferentes, mesma data -> mesmos leques na mesma vaga
{
  const leques = [];
  for (const semente of [1, 2]) {
    A.semear(semente); D.desafio = { data: "2026-09-27", semente: "ttc-2026-09-27" }; D.dificuldade = "normal"; D.esquema = "4-3-3";
    D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y]) => ({ pos, x, y, jogador: null })); D.banco = A.BANCO_VAGAS.map((pos) => ({ pos, jogador: null }));
    D.leques = {}; D.vaga = 0; D.trocasUsadas = 0;
    leques.push(A.lequeAtual().map((j) => j.player_id).join(","));
  }
  console.log(`desafio do dia: 1º leque igual pra dois jogadores com Math.random diferentes? ${leques[0] === leques[1] ? "sim" : "NÃO"}`);
  D.desafio = null;
}
