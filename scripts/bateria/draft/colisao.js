// Nome do clube igual a convidado da Copa do Brasil: 400 temporadas com o nome "Fortaleza"
const { A } = require("./sim.js"); const { D, Motor, ESQUEMAS } = A;
let self = 0, virouCpu = 0; const N = 400;
for (let k = 0; k < N; k++) {
  A.semear(100 + k); D.nome = "Fortaleza"; D.sai = "Chapecoense"; D.continental = "lib"; D.esquema = "4-3-3";
  D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y], i) => ({ pos, x, y, jogador: A.r.indice.comNota[i] }));
  const serieA = A.serieAComUsuario(); const eu = Object.values(serieA).find((t) => t.usuario);
  D.regrasTemp = A.regrasComUsuario(eu.id);
  const times = { ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
  if (!times[eu.id].usuario) virouCpu++;
  const t = Motor.criarTemporada({ regras: D.regrasTemp, times, serieA: Object.keys(serieA), usuario: eu.id, semente: k });
  let s = false; while (!Motor.terminou(t)) { const x = Motor.avancar(t); for (const j of x.jogos) if (j.casa === j.fora) s = true; } if (s) self++;
}
console.log(`nome "Fortaleza": clube do usuario virou o da CPU em ${virouCpu}/${N}; temporadas com time contra si ${self}/${N}`);
