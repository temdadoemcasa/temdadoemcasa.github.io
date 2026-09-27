// Metas da fase 2 (PASS/FAIL) a partir de tudo.jsonl. Uso: node metas.js [tudo.jsonl] [--json]
"use strict";
const fs = require("fs");
const arq = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : `${process.env.SAIDA || (process.env.TMPDIR || "/tmp") + "/bateria-draft"}/tudo.jsonl`;
const L = fs.readFileSync(arq, "utf8").trim().split("\n").map(JSON.parse);
const media = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const pct = (a, b) => (100 * a) / (b || 1);
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v));
const bloco = (b) => L.filter((x) => x.bloco === b && !x.erro);
const res = [];
const meta = (grupo, nome, valor, ok, alvo) => res.push({ grupo, nome, valor, ok: Boolean(ok), alvo });
const entre = (v, a, b) => v >= a && v <= b;

// 0. robustez
const erros = L.filter((x) => x.erro);
const probs = L.flatMap((x) => x.problemas || []);
meta("7", "exceções", erros.length, erros.length === 0, "0");
meta("7", "problemas de calendário/regulamento", probs.length, probs.length === 0, "0");
meta("7", "agenda ≠ jogo", L.reduce((s, x) => s + (x.agendaErros || 0), 0), L.every((x) => !x.agendaErros), "0");
meta("7", "gol/pênalti de expulso", L.reduce((s, x) => s + (x.expulsoMarca || 0), 0), L.every((x) => !x.expulsoMarca), "0");
const ms = L.filter((x) => x.ms).map((x) => x.ms);
meta("7", "tempo da temporada (mediana, ms)", f1(q(ms, 0.5)), q(ms, 0.5) <= 30, "≤ 30");
meta("7", "jogos em dias seguidos (por temporada, todos os clubes)", f1(media(L.map((x) => x.diasSeguidos || 0))), true, "informativo");

// 1. realismo (liga CPU, sem o usuario)
const S = (k) => L.reduce((s, x) => s + (x.liga ? x.liga[k] : 0), 0);
const J = S("jogos");
meta("1", "gols/jogo", (S("gols") / J).toFixed(2), entre(S("gols") / J, 2.35, 2.55), "2,35-2,55");
meta("1", "vitória do mandante %", f1(pct(S("casa"), J)), entre(pct(S("casa"), J), 46, 50), "46-50");
meta("1", "vitória do visitante %", f1(pct(S("fora"), J)), entre(pct(S("fora"), J), 24, 27), "24-27");
meta("1", "0x0 %", f1(pct(S("zz"), J)), entre(pct(S("zz"), J), 7, 9), "7-9");
// pontos por posicao: tabela inteira (com o usuario) das politicas medias (aleatorio+humano+melhor), pra 20 times
const tabs = L.filter((x) => x.cpuPts && x.cpuPts.length === 19 && !x.erro).map((x) => { const t = [...x.cpuPts, x.pts].sort((a, b) => b - a); return t; });
const campeao = tabs.map((t) => t[0]), lanterna = tabs.map((t) => t[19]), p17 = tabs.map((t) => t[16]);
meta("1", "pontos do campeão (média; p10-p90)", `${f1(media(campeao))} (${q(campeao, 0.1)}-${q(campeao, 0.9)})`, entre(media(campeao), 73, 82) && q(campeao, 0.1) >= 64 && q(campeao, 0.9) <= 90, "73-82 (p10-p90 ~66-88)");
meta("1", "pontos do lanterna (média)", f1(media(lanterna)), entre(media(lanterna), 20, 32), "20-32");
meta("1", "pontos do 17º (média)", f1(media(p17)), entre(media(p17), 40, 46), "40-46");
const BR = new Set(["EU", "Athletico", "Atlético-MG", "Bahia", "Botafogo", "Chapecoense", "Corinthians", "Coritiba", "Cruzeiro", "Flamengo", "Fluminense", "Grêmio", "Internacional", "Mirassol", "Palmeiras", "RB Bragantino", "Remo", "Santos", "São Paulo", "Vasco", "Vitória"]);
const ALT = new Set(["Cusco", "Bolívar", "LDU", "Always Ready", "Independiente del Valle", "Macará", "Cienciano", "Deportivo Cuenca", "Independiente Petrolero"]);
const libBr = L.filter((x) => x.campeoes && BR.has(x.campeoes.lib)).length, libAlt = L.filter((x) => x.campeoes && ALT.has(x.campeoes.lib)).length;
meta("1", "Libertadores com campeão brasileiro %", f1(pct(libBr, L.length)), entre(pct(libBr, L.length), 45, 65), "45-65");
meta("1", "Libertadores com campeão de altitude %", f1(pct(libAlt, L.length)), pct(libAlt, L.length) <= 12, "≤ 12");
const conf = L.reduce((s, x) => s + (x.mata ? x.mata.confrontos : 0), 0), pen = L.reduce((s, x) => s + (x.mata ? x.mata.penaltis : 0), 0);
meta("1", "confrontos de ida e volta nos pênaltis %", f1(pct(pen, conf)), entre(pct(pen, conf), 15, 25), "15-25");

// 2. draft como decisao
const B = bloco("B_melhor"), SI = bloco("S_inteligente");
const ganho = media(SI.map((x) => x.pts)) - media(B.map((x) => x.pts));
meta("2", "inteligente − maior nota (pts no BR)", `${f1(ganho)} (${f1(media(SI.map((x) => x.pts)))} × ${f1(media(B.map((x) => x.pts)))})`, entre(ganho, 3, 6), "+3 a +6");
const naoMaior = SI.reduce((s, x) => s + x.naoMaior, 0), escolhas = SI.reduce((s, x) => s + x.escolhas, 0);
meta("2", "escolhas do inteligente que NÃO são a maior nota %", f1(pct(naoMaior, escolhas)), pct(naoMaior, escolhas) >= 25, "≥ 25");
meta("2", "entrosamento médio (ligações): inteligente × maior nota", `${f1(media(SI.map((x) => x.entrosamento)))} × ${f1(media(B.map((x) => x.entrosamento)))}`, true, "informativo");
meta("2", "lesões / suspensões por temporada (seu clube)", `${f1(media(L.map((x) => x.lesoes || 0)))} / ${f1(media(L.map((x) => x.suspensoes || 0)))}`, true, "informativo");

// 4. decisoes na temporada (pareado: mesmo draft e sorteio)
const TP = bloco("T_padrao"), TB = bloco("T_bom");
const tit = (g) => pct(g.filter((x) => x.tituloBra || x.tituloCdb || x.tituloLib || x.tituloSul).length, g.length);
const dPts = media(TB.map((x) => x.pts)) - media(TP.map((x) => x.pts));
meta("4", "decisões boas − sempre Equilibrado (pts)", `${f1(dPts)} (${f1(media(TB.map((x) => x.pts)))} × ${f1(media(TP.map((x) => x.pts)))})`, dPts >= 3, "≥ +3");
meta("4", "decisões boas − sempre Equilibrado (algum título, pp)", `${f1(tit(TB) - tit(TP))} (${f1(tit(TB))}% × ${f1(tit(TP))}%)`, entre(tit(TB) - tit(TP), 3, 5), "+3 a +5");
meta("4", "jogos decisivos por temporada / posturas ≠ Equilibrado (bom)", `${f1(media(TB.map((x) => x.decisivos)))} / ${f1(media(TB.map((x) => x.posturasUsadas)))}`, true, "informativo");
meta("4", "janela usada pelo bom %", f1(pct(TB.filter((x) => x.janela).length, TB.length)), true, "informativo");

// 5. dificuldade
const med = (g) => q(g.map((x) => x.pos), 0.5), camp = (g) => pct(g.filter((x) => x.tituloBra).length, g.length);
const dif = { facil: [bloco("F_facil_aleatorio"), bloco("F_facil_melhor")], normal: [bloco("A_aleatorio"), B], dificil: [bloco("F_dificil_aleatorio"), bloco("F_dificil_melhor")] };
const alvoMed = { facil: [8, 10], normal: [11, 13], dificil: [14, 16] }, alvoCamp = { facil: [20, 30], normal: [11, 19], dificil: [4, 10] };
for (const [d, [al, gu]] of Object.entries(dif)) {
  meta("5", `${d}: mediana ao acaso`, med(al), entre(med(al), ...alvoMed[d]), `~${(alvoMed[d][0] + alvoMed[d][1]) / 2}º`);
  meta("5", `${d}: campeão com a maior nota %`, f1(camp(gu)), entre(camp(gu), ...alvoCamp[d]), `~${d === "facil" ? 25 : d === "normal" ? 15 : 7}%`);
}

// 7. pior escolha
const C = bloco("C_pior");
meta("7", "pior escolha: Z4 %", f1(pct(C.filter((x) => x.pos >= 17).length, C.length)), entre(pct(C.filter((x) => x.pos >= 17).length, C.length), 75, 92), "75-92");
meta("7", "pior escolha: top 12 %", f1(pct(C.filter((x) => x.pos <= 12).length, C.length)), pct(C.filter((x) => x.pos <= 12).length, C.length) >= 3, "≥ 3");

// resumo por bloco
const linhas = [];
for (const b of [...new Set(L.map((x) => x.bloco))]) {
  const g = bloco(b);
  linhas.push(`${b.padEnd(22)} n=${String(g.length).padStart(4)} onze ${f1(media(g.map((x) => x.mediaOnze)))} pos med ${med(g)} (p10 ${q(g.map((x) => x.pos), 0.1)}, p90 ${q(g.map((x) => x.pos), 0.9)}) pts ${f1(media(g.map((x) => x.pts)))} | BR ${f1(camp(g))}% G6 ${f1(pct(g.filter((x) => x.pos <= 6).length, g.length))}% Z4 ${f1(pct(g.filter((x) => x.pos >= 17).length, g.length))}% | CdB ${f1(pct(g.filter((x) => x.tituloCdb).length, g.length))}% LIB ${f1(pct(g.filter((x) => x.tituloLib).length, g.filter((x) => x.continental === "lib").length))}% SUL ${f1(pct(g.filter((x) => x.tituloSul).length, g.filter((x) => x.continental === "sul").length))}% | algum título ${f1(tit(g))}%`);
}
// por esquema (maior nota)
const esq = {};
for (const x of B) (esq[x.esquema] ||= []).push(x);
const porEsq = Object.entries(esq).map(([e, g]) => `${e.padEnd(8)} pts ${f1(media(g.map((x) => x.pts)))} G6 ${f1(pct(g.filter((x) => x.pos <= 6).length, g.length))}% BR ${f1(camp(g))}%`);

if (process.argv.includes("--json")) { console.log(JSON.stringify({ res, linhas, porEsq })); process.exit(0); }
for (const r of res) console.log(`${r.ok ? "PASS" : "FAIL"}  [${r.grupo}] ${r.nome}: ${r.valor}  (meta ${r.alvo})`);
console.log("\n" + linhas.join("\n"));
console.log("\nmaior nota por esquema:\n" + porEsq.join("\n"));
if (probs.length) console.log("\nproblemas:", [...new Set(probs)].slice(0, 10));
if (erros.length) console.log("\nerros:", erros.slice(0, 3).map((x) => x.erro));
