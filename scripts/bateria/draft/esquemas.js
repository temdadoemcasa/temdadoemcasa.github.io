// Meta 3: com elencos montados pela maior nota, qual esquema rende mais pra cada elenco?
// Pra cada elenco (16), escala em cada esquema e calcula os pontos esperados no
// Brasileirao contra os 19 da CPU (Poisson com a calibragem, contexto casa/fora e
// rival forte/fraco, postura equilibrada). Uso: node esquemas.js [n=400]
"use strict";
const { A, draftar } = require("./sim.js");
const { D, Motor, ESQUEMAS } = A;
const N = Number(process.argv[2] || 400);
const calib = A.calib();
function probs(mc, mf) {
  const pois = (m) => { const p = [Math.exp(-m)]; for (let k = 1; k <= 10; k++) p.push(p[k - 1] * m / k); return p; };
  const a = pois(mc), b = pois(mf); let v = 0, e = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { if (i > j) v += a[i] * b[j]; else if (i === j) e += a[i] * b[j]; }
  return 3 * v + e;
}
function pontosEsperados(f, esquema, rivais) {
  let pts = 0;
  for (const r of rivais) {
    for (const casa of [true, false]) {
      const t = A.ajusteDeContexto(f, { casa, rival: r, esquema });
      const [mc, mf] = casa ? Motor.medias(t, r, false, calib) : Motor.medias(r, t, false, calib);
      pts += casa ? probs(mc, mf) : probs(mf, mc);
    }
  }
  return pts;
}
const cpu = A.timesCpu(); delete cpu.Chapecoense;
const rivais = Object.values(cpu);
const otimo = {}, difs = [], ganhoTroca = [];
for (let i = 0; i < N; i++) {
  A.semear(424242 + i);
  D.sai = "Chapecoense"; D.dificuldade = "normal";
  const esq = Object.keys(ESQUEMAS)[i % 8];
  draftar({ politica: "melhor", esquema: esq, dificuldade: "normal" });
  const jogadores = A.todasVagas().map((s) => s.jogador);
  const pts = {};
  for (const e of Object.keys(ESQUEMAS)) {
    const r = e === esq ? { onze: D.onze, banco: D.banco } : A.escalarNoEsquema(jogadores, e);
    pts[e] = pontosEsperados(A.forcaDoElenco(r.onze, r.banco, e), e, rivais);
  }
  const ord = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  otimo[ord[0][0]] = (otimo[ord[0][0]] || 0) + 1;
  difs.push(ord[0][1] - ord[ord.length - 1][1]);
  ganhoTroca.push(ord[0][1] - pts[esq]);
}
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const maxShare = Math.max(...Object.values(otimo)) / N * 100;
console.log("esquema ótimo por elenco (%):", Object.entries(otimo).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${(100 * n / N).toFixed(1)}`).join(", "));
console.log(`${maxShare <= 40 ? "PASS" : "FAIL"}  [3] nenhum esquema ótimo pra mais de 40% dos elencos: máximo ${maxShare.toFixed(1)}%`);
console.log(`${media(difs) >= 3 ? "PASS" : "FAIL"}  [3] melhor − pior esquema pro mesmo elenco: ${media(difs).toFixed(1)} pts em média (p10 ${[...difs].sort((a, b) => a - b)[Math.floor(N * 0.1)].toFixed(1)})`);
console.log(`informativo: trocar do esquema do draft pro melhor ganha ${media(ganhoTroca).toFixed(1)} pts em média; o do draft já é o melhor em ${(100 * ganhoTroca.filter((g) => g < 1e-9).length / N).toFixed(0)}%`);
