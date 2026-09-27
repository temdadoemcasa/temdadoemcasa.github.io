// Uma estrela mexe nas chances? Pega elencos montados ("humano" e "maior nota"), troca UM
// titular (madeira) por um concreto da mesma funcao e compara as chances do resumo
// (mesmas sementes). Uso: node estrela.js [elencos=40] [temporadas=50]
"use strict";
const { A, draftar } = require("./sim.js");
const { D, Motor } = A;
const NE = Number(process.argv[2] || 40), NT = Number(process.argv[3] || 50);
const concretos = A.r.indice.comNota.filter((j) => A.nivel(j.overall).id === "grafeno");
function chances(seed) {
  const rng = Motor.rngDe(seed); const c = { g6: 0, z4: 0, bra: 0, tit: 0, pos: 0 };
  for (let k = 0; k < NT; k++) { const r = A.simularTemporadaRapida(Math.floor(rng() * 1e9), rng); if (r.pos <= 6) c.g6++; if (r.pos >= 17) c.z4++; if (r.bra) c.bra++; if (r.titulo) c.tit++; c.pos += r.pos; }
  return c;
}
for (const pol of ["humano", "melhor"]) {
  const d = { g6: 0, bra: 0, tit: 0, pos: 0, forca: 0 }; let n = 0;
  for (let e = 0; e < NE; e++) {
    A.semear(8080 + e); D.sai = "Chapecoense"; D.continental = "lib"; D.desafio = null;
    draftar({ politica: pol, esquema: ["4-3-3", "4-2-3-1", "3-4-2-1", "3-5-2"][e % 4], dificuldade: "normal" });
    // o titular madeira que tem um concreto da mesma funcao fora do elenco
    const noElenco = new Set(A.todasVagas().map((s) => s.jogador));
    let alvo = -1, estrela = null;
    D.onze.forEach((s, k) => {
      if (alvo >= 0 || A.nivel(s.jogador.overall).id !== "madeira") return;
      const c = concretos.find((j) => !noElenco.has(j) && A.encaixeNaVaga(j, s.pos) === 1);
      if (c) { alvo = k; estrela = c; }
    });
    if (alvo < 0) continue;
    const f0 = A.forcaDoElenco(); const antes = chances(99 + e);
    const saiu = D.onze[alvo].jogador; D.onze[alvo].jogador = estrela;
    const f1 = A.forcaDoElenco(); const depois = chances(99 + e);
    D.onze[alvo].jogador = saiu;
    d.g6 += depois.g6 - antes.g6; d.bra += depois.bra - antes.bra; d.tit += depois.tit - antes.tit; d.pos += (depois.pos - antes.pos) / NT; d.forca += (f1.atq + f1.def) - (f0.atq + f0.def); n++;
  }
  const pp = (v) => `${v >= 0 ? "+" : ""}${(100 * v / (n * NT)).toFixed(1)} pp`;
  console.log(`${pol.padEnd(7)} (${n} elencos, ${NT} temporadas cada, madeira → concreto num titular): força ${d.forca / n >= 0 ? "+" : ""}${(d.forca / n).toFixed(2)} · G6 ${pp(d.g6)} · campeão BR ${pp(d.bra)} · algum título ${pp(d.tit)} · posição média ${(d.pos / n).toFixed(2)}`);
}
