// Janela de transferencias: abre em toda temporada? quando? quantos usam? Uso: node janela.js [n=150]
"use strict";
const { A, draftar } = require("./sim.js");
const { D, Motor } = A;
const N = Number(process.argv[2] || 150);
const out = [];
for (const dif of ["facil", "normal", "dificil"]) {
  for (const pol of ["melhor", "aleatorio"]) {
    let abriu = 0, usou = 0, ganhouNota = 0; const datas = {}, ultimos = {};
    for (let k = 0; k < N; k++) {
      A.semear(31337 + k); D.sai = "Chapecoense"; D.continental = k % 2 ? "sul" : "lib"; D.desafio = null;
      draftar({ politica: pol, esquema: ["4-3-3", "3-5-2", "4-2-3-1", "3-4-2-1"][k % 4], dificuldade: dif });
      const temp = A.montarTemporada({ semente: Math.floor(A.random() * 1e9), rngGrupo: A.random });
      D.temp = temp; D.times = temp.times;
      while (!Motor.terminou(temp)) {
        if (A.janelaAberta(temp) && !temp.ttc.janelaVista) {
          temp.ttc.janelaVista = true; abriu++;
          const d = temp.etapas[temp.i].data, u = temp.etapas[temp.i - 1].data;
          datas[d] = (datas[d] || 0) + 1; ultimos[u] = (ultimos[u] || 0) + 1;
          // maior nota: troca o titular de menor nota pela maior carta, se for maior;
          // ao acaso: metade das vezes troca alguem ao acaso por uma carta ao acaso
          let k2, j;
          if (pol === "melhor") {
            k2 = D.onze.reduce((m, s, i) => (s.jogador.overall < D.onze[m].jogador.overall ? i : m), 0);
            const leque = A.lequeDaJanela(k2);
            j = leque.reduce((m, x) => (x.overall > m.overall ? x : m));
            if (j.overall <= A.todasVagas()[k2].jogador.overall) j = null;
          } else if (A.random() < 0.5) {
            k2 = Math.floor(A.random() * 16);
            const leque = A.lequeDaJanela(k2);
            j = leque[Math.floor(A.random() * leque.length)];
          }
          if (j) { const antes = A.todasVagas()[k2].jogador.overall; if (A.aplicarJanela(k2, j)) { usou++; ganhouNota += j.overall - antes; } }
          else temp.ttc.janelaUsada = true;
        }
        Motor.avancar(temp);
      }
    }
    out.push(`${dif.padEnd(8)} ${pol.padEnd(9)} janela abriu em ${abriu}/${N} temporadas · usou ${(100 * usou / N).toFixed(0)}% · nota do reforço ${usou ? (ganhouNota / usou >= 0 ? "+" : "") + (ganhouNota / usou).toFixed(1) : "-"} · abre antes do jogo de ${Object.entries(datas).map(([d, n]) => `${d} (${n})`).join(", ")} · último jogo antes: ${Object.entries(ultimos).map(([d, n]) => `${d} (${n})`).join(", ")}`);
  }
}
console.log(out.join("\n"));
