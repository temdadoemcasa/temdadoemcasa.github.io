// Quantas paradas "Ate o proximo jogo decisivo" uma temporada tem, e quando. Uso: node decisivos.js [n=300] [politica=humano]
// Conta os jogos do usuario em que decisivaParaUsuario e verdade (cada um e uma parada),
// com o draft "humano" e a temporada no padrao.
"use strict";
const { A, draftar } = require("./sim.js");
const { D, Motor } = A;
const N = Number(process.argv[2] || 300);
const porTemp = [], porMes = {}, porComp = {}, liga = [];
let semLiga = 0;
for (let k = 0; k < N; k++) {
  A.semear(2024 + k); D.sai = "Chapecoense"; D.continental = k % 2 ? "sul" : "lib"; D.desafio = null;
  draftar({ politica: process.argv[3] || "humano", esquema: ["4-3-3", "3-5-2", "4-2-3-1", "3-4-2-1"][k % 4], dificuldade: "normal" });
  const temp = A.montarTemporada({ semente: Math.floor(A.random() * 1e9), rngGrupo: A.random });
  D.temp = temp; D.times = temp.times;
  let n = 0, nl = 0;
  while (!Motor.terminou(temp)) {
    const prox = Motor.agenda(temp, 1)[0];
    const e = temp.etapas[temp.i];
    if (prox && prox.indice === temp.i && A.decisivaParaUsuario(temp, e)) {
      n++; if (e.comp === "bra") nl++;
      const mes = e.data.slice(5, 7); porMes[mes] = (porMes[mes] || 0) + 1;
      porComp[e.comp] = (porComp[e.comp] || 0) + 1;
    }
    Motor.avancar(temp);
  }
  porTemp.push(n); liga.push(nl); if (!nl) semLiga++;
}
const s = [...porTemp].sort((a, b) => a - b), q = (p) => s[Math.floor(p * s.length)];
const m = (xs) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
console.log(`paradas por temporada: média ${m(porTemp)} (p10 ${q(0.1)}, mediana ${q(0.5)}, p90 ${q(0.9)}) · no Brasileirão ${m(liga)} (${(100 * semLiga / N).toFixed(0)}% das temporadas sem nenhuma na liga)`);
console.log("por competição (média por temporada):", Object.entries(porComp).map(([c, v]) => `${c} ${(v / N).toFixed(1)}`).join(", "));
console.log("por mês (média por temporada):", Object.keys(porMes).sort().map((mm) => `${mm} ${(porMes[mm] / N).toFixed(1)}`).join(", "));
