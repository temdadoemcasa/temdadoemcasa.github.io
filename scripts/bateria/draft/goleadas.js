// Goleadas: o placar fica crivel contra time muito mais fraco? Uso: node goleadas.js [n=300] [politica=melhor]
// Conta, em todas as partidas da temporada (CPU e usuario): % com 6+ gols e com 5+ de diferenca.
// Nos jogos do usuario contra time bem mais fraco (diferenca de forca >= 10): gols por jogo e
// o maior agregado de mata-mata. Referencia real: grande x time de Serie D / pequeno sul-americano
// faz ~2,5 a 3 gols por jogo; agregado de 8+ e raro.
// PATCH_CALIB='{"satura":14}' experimenta a saturacao sem editar o JSON.
"use strict";
const { A, draftar } = require("./sim.js");
const { D, Motor } = A;
const N = Number(process.argv[2] || 300);
let jogos = 0, seisMais = 0, cincoDif = 0;
let jogosFracos = 0, golsFracos = 0, sofridosFracos = 0;
const agregados = []; // maior agregado (saldo) do usuario em mata-mata por temporada
const forca = (t) => (t.atq + t.def) / 2;
for (let k = 0; k < N; k++) {
  A.semear(5000 + k); D.sai = "Chapecoense"; D.continental = k % 2 ? "sul" : "lib"; D.desafio = null;
  draftar({ politica: process.argv[3] || "melhor", esquema: ["4-3-3", "3-5-2", "4-2-3-1", "3-4-2-1"][k % 4], dificuldade: "normal" });
  const temp = A.montarTemporada({ semente: Math.floor(A.random() * 1e9), rngGrupo: A.random });
  D.temp = temp; D.times = temp.times;
  while (!Motor.terminou(temp)) Motor.avancar(temp);
  const u = temp.usuario, fu = forca(temp.times[u]);
  const confrontos = new Map(); // mata-mata do usuario: adversario|comp -> saldo
  for (const h of temp.historico) {
    for (const j of h.jogos || []) {
      jogos++;
      const g = j.gc + j.gf;
      if (g >= 6) seisMais++;
      if (Math.abs(j.gc - j.gf) >= 5) cincoDif++;
      if (j.casa !== u && j.fora !== u) continue;
      const adv = j.casa === u ? j.fora : j.casa;
      const meus = j.casa === u ? j.gc : j.gf, deles = j.casa === u ? j.gf : j.gc;
      if (fu - forca(temp.times[adv]) >= 10) { jogosFracos++; golsFracos += meus; sofridosFracos += deles; }
      if (h.etapa.comp !== "bra") {
        const c = `${adv}|${h.etapa.comp}`;
        confrontos.set(c, (confrontos.get(c) || 0) + meus - deles);
      }
    }
  }
  agregados.push(Math.max(0, ...confrontos.values()));
}
const pct = (a, b) => (100 * a / b).toFixed(2);
const s = [...agregados].sort((a, b) => a - b), q = (p) => s[Math.floor(p * s.length)];
console.log(`partidas: ${jogos} · 6+ gols ${pct(seisMais, jogos)}% · diferença 5+ ${pct(cincoDif, jogos)}%`);
console.log(`usuário x time 10+ pontos mais fraco: ${jogosFracos} jogos · ${(golsFracos / jogosFracos).toFixed(2)} gols feitos e ${(sofridosFracos / jogosFracos).toFixed(2)} sofridos por jogo`);
console.log(`maior saldo do usuário num mata-mata (por temporada): mediana ${q(0.5)}, p90 ${q(0.9)}, máx ${s[s.length - 1]} · saldo 8+ em ${pct(agregados.filter((x) => x >= 8).length, N)}% das temporadas`);
