// Checagens extras: forcas CPU, time dos sonhos/pesadelo, colisao de nome, expulso que marca, descanso entre jogos
const { tentativa, A } = require("./sim.js");
const { D, Motor, ESQUEMAS } = A;
const fs = require("fs");
const regras = D.regras;
// 1) forcas CPU (regua) e altitude
const cpu = Motor.timesDaSerieA(D.r);
console.log("CPU Serie A (atq+def na regua):", Object.values(cpu).sort((a, b) => (b.atq + b.def) - (a.atq + a.def)).map((t) => `${t.id} ${(t.atq).toFixed(1)}/${(t.def).toFixed(1)}`).join(", "));
console.log("ESCALA", Motor.ESCALA);
const est = Object.entries(regras.estrangeiros).filter(([k]) => !k.startsWith("_"));
console.log("altitude:", est.filter(([, v]) => v.altitude).map(([k, v]) => `${k} ${v.forca}`).join(", "));
console.log("top estrangeiros:", est.sort((a, b) => b[1].forca - a[1].forca).slice(0, 8).map(([k, v]) => `${k} ${v.forca}`).join(", "));
// 2) time dos sonhos / pesadelo: maior (menor) overall por funcao, sem repetir
function onzeExtremo(esquema, dir) {
  const usados = new Set(); const onze = [];
  for (const [pos] of ESQUEMAS[esquema]) {
    const f = A.VAGAS[pos][0];
    let pool = A.r.indice.comNota.filter((j) => !usados.has(j) && A.funcoesDe(j).includes(f));
    pool.sort((a, b) => dir * (b.overall - a.overall));
    onze.push(pool[0]); usados.add(pool[0]);
  }
  return onze;
}
for (const [nome, dir] of [["sonhos", 1], ["pesadelo", -1]]) {
  for (const esq of ["4-3-3", "4-2-3-1", "5-3-2"]) {
    const onze = onzeExtremo(esq, dir);
    const res = { pos: [], br: 0, tit: 0, z4: 0 };
    for (let k = 0; k < 200; k++) {
      A.semear(777 + k); D.sai = "Chapecoense"; D.continental = k % 2 ? "sul" : "lib"; D.nome = "Tem Dado FC"; D.esquema = esq;
      D.onze = ESQUEMAS[esq].map(([pos, x, y], i) => ({ pos, x, y, jogador: onze[i] }));
      const serieA = A.serieAComUsuario(); const eu = Object.values(serieA).find((t) => t.usuario);
      D.regrasTemp = A.regrasComUsuario(eu.id);
      const saiu = Motor.timesDaSerieA(D.r)[D.sai];
      D.times = { [D.sai]: saiu, ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
      const t = Motor.criarTemporada({ regras: D.regrasTemp, times: D.times, serieA: Object.keys(serieA), usuario: eu.id, semente: Math.floor(A.random() * 1e9) });
      while (!Motor.terminou(t)) Motor.avancar(t);
      const pos = Motor.ordenar(t.bra.tabela).findIndex((l) => l.id === eu.id) + 1;
      res.pos.push(pos); if (pos === 1) res.br++; if (pos >= 17) res.z4++;
      if (Object.values(t.campeoes).includes(eu.id)) res.tit++;
      if (k === 0) res.forca = `${eu.atq.toFixed(1)}/${eu.def.toFixed(1)} media ${(onze.reduce((s, j) => s + j.overall, 0) / 11).toFixed(1)}`;
      if (k < 200) { res.cop = res.cop || { cdb: 0, lib: 0, sul: 0, triplice: 0 }; for (const c of ["cdb", "lib", "sul"]) if (t.campeoes[c] === eu.id) res.cop[c]++; if (pos === 1 && t.campeoes.cdb === eu.id && (t.campeoes.lib === eu.id || t.campeoes.sul === eu.id)) res.cop.triplice++; }
    }
    res.pos.sort((a, b) => a - b);
    console.log(`time dos ${nome} ${esq}: forca ${res.forca} | pos mediana ${res.pos[100]} BR ${res.br / 2}% algum titulo ${res.tit / 2}% Z4 ${res.z4 / 2}% copas ${JSON.stringify(res.cop)} (n=200)`);
  }
}
// 3) colisao de nome com convidado da Copa do Brasil
for (const nome of ["Fortaleza", "Sport Recife", "Flamengo", "Boca Juniors"]) {
  A.semear(5); D.nome = nome; D.sai = "Chapecoense"; D.continental = "lib"; D.esquema = "4-3-3";
  D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y], i) => ({ pos, x, y, jogador: onzeExtremo("4-3-3", 1)[i] }));
  const id = A.idUsuario();
  const serieA = A.serieAComUsuario(); const eu = Object.values(serieA).find((t) => t.usuario);
  D.regrasTemp = A.regrasComUsuario(eu.id);
  const times = { ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
  const t = Motor.criarTemporada({ regras: D.regrasTemp, times, serieA: Object.keys(serieA), usuario: eu.id, semente: 42 });
  let contraSi = 0; let erro = null;
  try { while (!Motor.terminou(t)) { const x = Motor.avancar(t); for (const j of x.jogos) if (j.casa === j.fora) contraSi++; } } catch (e) { erro = String(e).slice(0, 100); }
  console.log(`nome "${nome}" -> id "${id}"; times[id].usuario=${Boolean(times[id].usuario)} forca ${times[id].atq.toFixed(1)}; jogos contra si ${contraSi}; erro ${erro}`);
}
// 4) expulso que depois marca gol; 5) descanso entre jogos do usuario
let jogos = 0, expMarca = 0, expJogos = 0; const gaps = {}; let mesmoFimDeSemana = 0, temporadas = 0;
for (let k = 0; k < 300; k++) {
  A.semear(9000 + k); D.nome = "Tem Dado FC"; D.sai = "Chapecoense"; D.continental = k % 2 ? "sul" : "lib"; D.esquema = "4-3-3";
  D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y], i) => ({ pos, x, y, jogador: onzeExtremo("4-3-3", 1)[i] }));
  const serieA = A.serieAComUsuario(); const eu = Object.values(serieA).find((t) => t.usuario);
  D.regrasTemp = A.regrasComUsuario(eu.id);
  const times = { Chapecoense: Motor.timesDaSerieA(D.r).Chapecoense, ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
  const t = Motor.criarTemporada({ regras: D.regrasTemp, times, serieA: Object.keys(serieA), usuario: eu.id, semente: Math.floor(A.random() * 1e9) });
  const datas = []; temporadas++;
  while (!Motor.terminou(t)) {
    const x = Motor.avancar(t);
    for (const j of x.jogos) {
      jogos++;
      const verm = j.eventos.filter((e) => e.tipo === "vermelho" && e.autor);
      if (verm.length) expJogos++;
      for (const v of verm) if (j.eventos.some((e) => e.tipo === "gol" && e.lado === v.lado && e.autor === v.autor && e.min > v.min)) expMarca++;
    }
    if (x.doUsuario) datas.push(x.etapa.data);
  }
  for (let i = 1; i < datas.length; i++) { const g = (Date.parse(datas[i]) - Date.parse(datas[i - 1])) / 864e5; gaps[g] = (gaps[g] || 0) + 1; if (g <= 1) mesmoFimDeSemana++; }
}
console.log(`expulsao com autor em ${expJogos} jogos; expulso marca DEPOIS de expulso em ${expMarca} (${(100 * expMarca / expJogos).toFixed(1)}% das expulsoes)`);
console.log("descanso (dias) entre jogos seguidos do usuario (time dos sonhos, 300 temporadas):", JSON.stringify(Object.fromEntries(Object.entries(gaps).filter(([g]) => +g <= 3))), "jogos em dias seguidos por temporada:", (mesmoFimDeSemana / temporadas).toFixed(2));
// 6) datas: quantos domingos livres x 38 rodadas; rodadas no mesmo dia
A.semear(1);
const t = Motor.criarTemporada({ regras, times: { ...Motor.timesDaSerieA(D.r), ...Motor.timesDeFora(regras) }, serieA: D.r.times.map((x) => x.nome), usuario: "Flamengo", semente: 1 });
const bra = t.etapas.filter((e) => e.comp === "bra").map((e) => e.data);
const rep = bra.filter((d, i) => bra.indexOf(d) !== i);
console.log("rodadas BR:", bra.length, "datas repetidas:", rep, "primeira", bra[0], "ultima", bra[bra.length - 1], "sabados:", bra.filter((d) => new Date(d).getUTCDay() === 6).length);
const dias = {}; for (const e of t.etapas) { const w = new Date(e.data).getUTCDay(); dias[e.comp] = dias[e.comp] || {}; dias[e.comp][w] = (dias[e.comp][w] || 0) + 1; }
console.log("dia da semana por competicao (0=dom):", JSON.stringify(dias));
