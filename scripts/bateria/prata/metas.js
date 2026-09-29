// Metas da fase 2 (docs/bateria-prata-da-casa.md): node metas.js <pasta> [pasta-pior]
// Le os .jsonl da bateria (e, se houver, os da politica "pior") e imprime cada meta.
"use strict";
const fs = require("fs"), path = require("path");
const [dir, dirPior] = process.argv.slice(2);
const ler = (d, filtro = () => true) => fs.readdirSync(d).filter((f) => f.endsWith(".jsonl") && filtro(f))
  .flatMap((f) => fs.readFileSync(path.join(d, f), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse));
const R = ler(dir, (f) => !f.startsWith("x-") && !f.startsWith("pior") && !f.startsWith("assina")).filter((r) => !r.excecao);
const ASS = ler(dir, (f) => f.startsWith("assina")).filter((r) => !r.excecao);
const P = dirPior ? ler(dirPior, (f) => f.startsWith("pior")).filter((r) => !r.excecao) : [];
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
const f2 = (x) => x.toFixed(2);
const score = (r) => r.premios + r.titulosClube * 0.5 + (r.auge - 70) * 0.5 + (r.europa ? 3 : 0) + r.bolaDeOuro * 10;
const pols = [...new Set(R.map((r) => r.pol))];
const out = [];
const linha = (meta, oque, valor, alvo, ok) => out.push(`| ${meta} | ${oque} | ${valor} | ${alvo} | ${ok === null ? "-" : ok ? "PASSA" : "FALHA"} |`);

// A
const bd = R.filter((r) => r.soInferior);
const premMedio = media(R.map((r) => r.premios)), premBD = media(bd.map((r) => r.premios));
linha("A", "prêmios: só B-D × média geral", `${f2(premBD)} × ${f2(premMedio)} (n=${bd.length})`, "B-D < média", premBD < premMedio);
const bdo = bd.filter((r) => r.bolaDeOuro).length;
linha("A", "Bola de Ouro em carreira só B-D", `${bdo} (${pct(bdo, bd.length)})`, "< 0,3%", bdo / Math.max(1, bd.length) < 0.003);
const conv = bd.filter((r) => r.selecao).length;
linha("A", "convocado (carreira só B-D)", pct(conv, bd.length), "< 20%", conv / Math.max(1, bd.length) < 0.2);
// B
const gulosa = R.filter((r) => r.pol === "gulosa");
const share = {};
for (const r of gulosa) for (const [k, op] of r.escolhas) { (share[k] ||= {}); share[k][op] = (share[k][op] || 0) + 1; }
const dom = Object.entries(share).map(([k, ops]) => { const tot = Object.values(ops).reduce((a, b) => a + b, 0); const [op, n] = Object.entries(ops).sort((a, b) => b[1] - a[1])[0]; return [k, op, n / tot, tot]; })
  .filter(([, , sh, tot]) => tot >= 30 && sh >= 0.8).sort((a, b) => b[2] - a[2]);
linha("B", "situações com gulosa ≥80% na mesma opção (n≥30)", `${dom.length}`, "≤ 5", dom.length <= 5);
const porModo = {};
for (const m of ["completo", "rapido"]) {
  const s = {}; for (const p of pols) s[p] = media(R.filter((r) => r.pol === p && r.modo === m).map(score));
  porModo[m] = s;
}
const todos = {}; for (const p of pols) todos[p] = media(R.filter((r) => r.pol === p).map(score));
const melhorPol = Object.entries(todos).sort((a, b) => b[1] - a[1])[0];
const ganho = melhorPol[1] / todos.aleatoria - 1;
linha("B", `score: melhor política (${melhorPol[0]}) × aleatória`, `${f2(melhorPol[1])} × ${f2(todos.aleatoria)} (${(ganho * 100).toFixed(1)}%)`, "≥ +15%", ganho >= 0.15);
const faixas = [[76, 82], [83, 88], [89, 92], [93, 99]];
const efeitoOvr = faixas.map(([a, b]) => {
  const m = {}; for (const p of pols) m[p] = media(R.filter((r) => r.pol === p && r.potencialSorteado >= a && r.potencialSorteado <= b).map((r) => r.auge));
  if (P.length) m.pior = media(P.filter((r) => r.potencialSorteado >= a && r.potencialSorteado <= b).map((r) => r.auge));
  const vs = Object.values(m); return [`${a}-${b}`, Math.max(...vs) - Math.min(...vs), m];
});
const efMedio = media(efeitoOvr.map((e) => e[1]));
linha("B", `OVR auge: melhor − pior jogada na mesma faixa de potencial${P.length ? " (com a política pior)" : ""}`, efeitoOvr.map((e) => `${e[0]}: ${e[1].toFixed(1)}`).join("; "), "~2 a 4", efMedio >= 2);
const potDelta = pols.map((p) => `${p} ${f2(media(R.filter((r) => r.pol === p).map((r) => r.potencialFinal - r.potencialSorteado)))}`).join(", ");
linha("B", "potencial final − sorteado (trabalho acumulado)", potDelta + (P.length ? `, pior ${f2(media(P.map((r) => r.potencialFinal - r.potencialSorteado)))}` : ""), "melhor > pior", null);
// C
const spread = (s) => Math.max(...Object.values(s)) - Math.min(...Object.values(s));
linha("C", "espalhamento do score entre políticas: rápido × completo", `${f2(spread(porModo.rapido))} × ${f2(spread(porModo.completo))}`, "rápido ≥ metade", spread(porModo.rapido) >= spread(porModo.completo) / 2);
linha("C", "anos com decisão de salto no rápido", `${f2(media(R.filter((r) => r.modo === "rapido").map((r) => r.saltos || 0)))} por carreira`, "-", null);
// D
const aposta = R.filter((r) => (r.temasApostas || []).length).length;
linha("D", "carreiras com algum arco de aposta", pct(aposta, R.length), "≤ 40%", aposta / R.length <= 0.4);
const renov = R.filter((r) => r.arcos.includes("A renovação")).length;
linha("D", "arco A renovação", pct(renov, R.length), "≥ 20%", renov / R.length >= 0.2);
const comp = R.filter((r) => r.modo === "completo");
const est = comp.filter((r) => r.estreiaAno1).length;
linha("D", "estreia no 1º ano (modo completo)", pct(est, comp.length), "sempre no 1º ano", est / comp.length > 0.9);
const pares = [["dor", "O joelho|A final e o joelho"], ["aquecimento", "O joelho|A final e o joelho"], ["veterano", "O corpo|O corpo começou a cobrar"], ["classico", "O polêmico|Gol no clássico, na casa deles"],
  ["classico", "O rival|Provocação antes do mata-mata"], ["padrinho", "O mentor|O garoto da base"], ["empresario-base", "empresario"], ["entrevista", "O polêmico|O microfone"],
  ["idolo", "O mentor|O capitão te chamou"], ["reuniao", "A crise|O vestiário contra o técnico"], ["tecnico-demitido", "A crise|O vestiário contra o técnico"], ["idioma", "Choque cultural|O primeiro inverno"]];
const dup = pares.map(([a, b]) => [a, b, R.filter((r) => r.vistos.includes(a) && r.vistos.includes(b)).length]);
linha("D", "pares temáticos na mesma carreira", dup.map(([a, b, n]) => `${a}+${b.split("|")[1]}: ${n}`).join("; "), "0 (exceto veterano 28-30 × corpo 31+)", dup.filter(([a]) => a !== "veterano").every(([, , n]) => n === 0));
// E
const fin = {}; for (const r of R) fin[r.final] = (fin[r.final] || 0) + 1;
linha("E", "nome do final", Object.entries(fin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, R.length)}`).join(", "), "variado", Object.keys(fin).length >= 6);
linha("E", "virou técnico / jogo de despedida", `${pct(R.filter((r) => r.virouTecnico).length, R.length)} / ${pct(R.filter((r) => r.despediu).length, R.length)}`, "> 0", R.some((r) => r.virouTecnico) && R.some((r) => r.despediu));
linha("E", "consequência pulada avisada (trocou de clube)", `${R.reduce((a, r) => a + (r.puladas || 0), 0)} avisos`, "> 0", null);
// F
const exc = ler(dir, (f) => !f.startsWith("x-") && !f.startsWith("pior")).filter((r) => r.excecao).length;
linha("F", "exceções", `${exc}`, "0", exc === 0);
const txt = R.reduce((a, r) => a + r.textosRuins.length, 0);
linha("F", "textos suspeitos", `${txt}`, "0", txt === 0);
const repet = R.filter((r) => { const c = {}; return r.vistos.some((k) => k !== "foco" && (c[k] = (c[k] || 0) + 1) > 1); }).length;
linha("F", "carreiras com situação repetida", `${repet}`, "0", repet === 0);
const trav = R.reduce((a, r) => a + r.softlock.length, 0);
linha("F", "travas / estado alterado pela dica de lados", `${trav}`, "0", trav === 0);
const idades = R.map((r) => r.idadeFim).sort((a, b) => a - b);
linha("F", "idade de aposentadoria p5-p50-p95", `${idades[Math.floor(idades.length * 0.05)]}-${idades[Math.floor(idades.length / 2)]}-${idades[Math.floor(idades.length * 0.95)]}`, "mediana 36-38 (limite 40)", idades[Math.floor(idades.length / 2)] >= 36 && idades[Math.floor(idades.length / 2)] <= 38);

// H: contratos (fase 3)
const cinco = R.filter((r) => ["aleatoria", "gulosa", "cautelosa", "primeira", "impaciente"].includes(r.pol));
const qn = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const cl = cinco.map((r) => r.clubes);
linha("H", "clubes por carreira, 5 políticas: p50 / p95", `${qn(cl, 0.5)} / ${qn(cl, 0.95)}`, "p50 4-6, p95 ≤ 9", qn(cl, 0.5) >= 4 && qn(cl, 0.5) <= 6 && qn(cl, 0.95) <= 9);
if (ASS.length) {
  const ca = ASS.map((r) => r.clubes);
  linha("H", "política que aceita toda proposta: clubes p50 / p95 / máx", `${qn(ca, 0.5)} / ${qn(ca, 0.95)} / ${Math.max(...ca)}`, "≤ 10", qn(ca, 0.95) <= 10);
  const semMotivo = ASS.reduce((a, r) => a + (r.eliteSeguidosSemMotivo || 0), 0), comMotivo = ASS.reduce((a, r) => a + (r.eliteSeguidos || 0), 0);
  linha("H", "aceita tudo: dois clubes da elite europeia em anos seguidos (sem motivo / total)", `${semMotivo} / ${comMotivo} em ${ASS.length} carreiras`, "0 sem motivo", semMotivo === 0);
  linha("H", "aceita tudo: final Andarilho", pct(ASS.filter((r) => r.final === "Andarilho").length, ASS.length), "modesto", null);
}
linha("H", "final Andarilho (todas as políticas)", pct(R.filter((r) => r.final === "Andarilho").length, R.length), "modesto", R.filter((r) => r.final === "Andarilho").length / R.length <= 0.12);
const mot = {}; for (const r of [...R, ...ASS]) for (const m of r.motivos || []) { const k = m.split("@")[0]; mot[k] = (mot[k] || 0) + 1; }
linha("H", "motivo das transferências", Object.entries(mot).map(([k, v]) => `${k} ${v}`).join(", "), "-", null);

console.log(`# Metas (${R.length} carreiras${P.length ? ` + ${P.length} da política pior` : ""})\n`);
console.log(["| meta | o que | valor | alvo | resultado |", "|---|---|---|---|---|", ...out].join("\n"));
console.log(`\nDominantes (gulosa ≥80%): ${dom.map(([k, op, sh, n]) => `${k} → ${op} ${(sh * 100).toFixed(0)}% (n=${n})`).join("; ")}`);
console.log(`\nScore médio por política: completo ${JSON.stringify(Object.fromEntries(Object.entries(porModo.completo).map(([k, v]) => [k, +v.toFixed(2)])))}; rápido ${JSON.stringify(Object.fromEntries(Object.entries(porModo.rapido).map(([k, v]) => [k, +v.toFixed(2)])))}`);
console.log(`\nAuge por faixa: ${efeitoOvr.map(([f, , m]) => `${f}: ${Object.entries(m).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(" / ")}`).join(" | ")}`);
// valores medios da gulosa nas dominantes (pra calibrar)
const val = {};
for (const r of gulosa) for (const [k, vs] of r.valores || []) { (val[k] ||= []).push(vs); }
if (process.env.VALORES) for (const [k] of dom) {
  const vs = val[k] || []; if (!vs.length) continue;
  const n = vs[0].length; const med = Array.from({ length: n }, (_, i) => media(vs.map((v) => v[i])));
  const gap = media(vs.map((v) => { const s = [...v].sort((a, b) => b - a); return s[0] - s[1]; }));
  console.log(`  ${k}: valor médio por opção ${med.map((x) => x.toFixed(2)).join(" | ")} · folga média ${gap.toFixed(2)}`);
}
