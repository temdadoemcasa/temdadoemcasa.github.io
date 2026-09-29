// Libertadores no mundo do Prata da Casa: calibragem padrao do motor (sem motor_ttc), Serie A
// pelo retrato (Motor.timesDaSerieA) com o sorteio de +-1,1 que o Prata faz a partir do 2o ano,
// estrangeiros pela forca do JSON. So CPU (o jogador do Prata nao muda o campeao continental).
// Uso: node libertadores-prata.js [temporadas=600] [ajusteEstrangeiros=0] [ajusteARG=0]
"use strict";
const { carregar } = require("./carregar.js");
const A = carregar();
const { D, Motor } = A;
const N = Number(process.argv[2] || 600), AJ = Number(process.argv[3] || 0), AJARG = Number(process.argv[4] || 0);
const ALT = new Set(Object.entries(D.regras.estrangeiros).filter(([k, v]) => !k.startsWith("_") && v.altitude).map(([k]) => k));
const cont = { BRA: 0 }, alt = { n: 0 };
const rngRuido = Motor.rngDe(4242);
const normal = () => { let u = 0; for (let i = 0; i < 6; i++) u += rngRuido(); return (u - 3) / Math.sqrt(0.5); };
for (let k = 0; k < N; k++) {
  const regras = structuredClone(D.regras);
  for (const [nome, t] of Object.entries(regras.estrangeiros)) if (!nome.startsWith("_")) t.forca += AJ + (t.pais === "ARG" ? AJARG : 0);
  const reais = Motor.timesDaSerieA(D.r);
  if (k % 2) for (const t of Object.values(reais)) { const d = normal() * 1.1; t.atq += d; t.def += d; }
  const times = { ...Motor.timesDeFora(regras), ...reais };
  const ids = Object.keys(reais);
  const temp = Motor.criarTemporada({ regras, times, serieA: ids, usuario: ids[0], semente: 1000 + k });
  while (!Motor.terminou(temp)) Motor.avancar(temp);
  const c = temp.campeoes.lib, pais = times[c].pais || "BRA";
  cont[pais] = (cont[pais] || 0) + 1; if (ALT.has(c)) alt.n++;
}
const pct = (v) => `${(100 * v / N).toFixed(1)}%`;
console.log(`Prata (calibragem padrão), ajuste estrangeiros ${AJ}, ARG ${AJARG}: Libertadores com campeão brasileiro ${pct(cont.BRA)} · altitude ${pct(alt.n)} · por país: ${Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${pct(n)}`).join(", ")}`);
