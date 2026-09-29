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
meta("1", "vitória do mandante %", f1(pct(S("casa"), J)), entre(pct(S("casa"), J), 43, 46), "43-46");
meta("1", "vitória do visitante %", f1(pct(S("fora"), J)), entre(pct(S("fora"), J), 28, 31), "28-31");
const FJ = S("forteJogos");
meta("1", "5 mais fortes × 5 mais fracos: o mais forte vence % (casa ou fora)", `${f1(pct(S("forteVence"), FJ))} (empate ${f1(pct(S("forteEmpata"), FJ))})`, pct(S("forteVence"), FJ) >= 60, "≥ 60");
meta("1", "0x0 %", f1(pct(S("zz"), J)), entre(pct(S("zz"), J), 7, 9), "7-9");
// pontos por posicao: tabela inteira (com o usuario) das politicas medias (aleatorio+humano+melhor), pra 20 times
const tabs = L.filter((x) => x.cpuPts && x.cpuPts.length === 19 && !x.erro).map((x) => { const t = [...x.cpuPts, x.pts].sort((a, b) => b - a); return t; });
const campeao = tabs.map((t) => t[0]), lanterna = tabs.map((t) => t[19]), p17 = tabs.map((t) => t[16]);
meta("1", "pontos do campeão (média; p10-p90)", `${f1(media(campeao))} (${q(campeao, 0.1)}-${q(campeao, 0.9)})`, entre(media(campeao), 74, 84), "74-84");
meta("1", "pontos do lanterna (média)", f1(media(lanterna)), entre(media(lanterna), 20, 30), "20-30");
meta("1", "pontos do 17º (média)", f1(media(p17)), entre(media(p17), 40, 46), "40-46");
const BR = new Set(["EU", "Athletico", "Atlético-MG", "Bahia", "Botafogo", "Chapecoense", "Corinthians", "Coritiba", "Cruzeiro", "Flamengo", "Fluminense", "Grêmio", "Internacional", "Mirassol", "Palmeiras", "RB Bragantino", "Remo", "Santos", "São Paulo", "Vasco", "Vitória"]);
const ALT = new Set(["Cusco", "Bolívar", "LDU", "Always Ready", "Independiente del Valle", "Macará", "Cienciano", "Deportivo Cuenca", "Independiente Petrolero"]);
const libBr = L.filter((x) => x.campeoes && BR.has(x.campeoes.lib)).length, libAlt = L.filter((x) => x.campeoes && ALT.has(x.campeoes.lib)).length;
meta("1", "Libertadores com campeão brasileiro % (todas)", f1(pct(libBr, L.length)), entre(pct(libBr, L.length), 75, 80), "75-80");
const soCpu = L.filter((x) => x.continental === "sul" && x.campeoes);
meta("1", "Libertadores com campeão brasileiro % (sem você nela)", f1(pct(soCpu.filter((x) => BR.has(x.campeoes.lib)).length, soCpu.length)), entre(pct(soCpu.filter((x) => BR.has(x.campeoes.lib)).length, soCpu.length), 75, 80), "75-80");
meta("1", "Libertadores com campeão de altitude %", f1(pct(libAlt, L.length)), pct(libAlt, L.length) <= 8, "≤ 8");
const naoBr = L.filter((x) => x.libPais && x.libPais !== "BRA");
const porPais = {}; for (const x of naoBr) porPais[x.libPais] = (porPais[x.libPais] || 0) + 1;
meta("1", "entre os não brasileiros, Libertadores com campeão argentino %", `${f1(pct(porPais.ARG || 0, naoBr.length))} (${Object.entries(porPais).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(", ")})`, pct(porPais.ARG || 0, naoBr.length) >= 50, "a maior parte (≥ 50)");
const conf = L.reduce((s, x) => s + (x.mata ? x.mata.confrontos : 0), 0), pen = L.reduce((s, x) => s + (x.mata ? x.mata.penaltis : 0), 0);
meta("1", "confrontos de ida e volta nos pênaltis %", f1(pct(pen, conf)), entre(pct(pen, conf), 15, 25), "15-25");

// 2. draft como decisao
const B = bloco("B_melhor"), SI = bloco("S_inteligente");
const ganho = media(SI.map((x) => x.pts)) - media(B.map((x) => x.pts));
meta("2", "inteligente − maior nota (pts no BR)", `${f1(ganho)} (${f1(media(SI.map((x) => x.pts)))} × ${f1(media(B.map((x) => x.pts)))})`, ganho >= 2, "≥ +2");
const distForca = (g) => { const h = {}; for (const x of g) { const k = x.posForca <= 5 ? String(x.posForca) : x.posForca <= 8 ? "6-8" : "9+"; h[k] = (h[k] || 0) + 1; } return ["1", "2", "3", "4", "5", "6-8", "9+"].map((k) => `${k}º ${f1(pct(h[k] || 0, g.length))}%`).join(" · "); };
meta("3b", "inteligente: ranking de força entre os 20 (média; distribuição)", `${f1(media(SI.map((x) => x.posForca)))} (${distForca(SI)})`, entre(media(SI.map((x) => x.posForca)), 2.5, 4.5), "~3-4");
meta("3b", "inteligente: campeão brasileiro % / G6 %", `${f1(pct(SI.filter((x) => x.tituloBra).length, SI.length))} / ${f1(pct(SI.filter((x) => x.pos <= 6).length, SI.length))}`, entre(pct(SI.filter((x) => x.tituloBra).length, SI.length), 28, 35) && pct(SI.filter((x) => x.pos <= 6).length, SI.length) >= 85, "28-35 / ≥ 85");
meta("3b", "maior nota: campeão brasileiro % / ranking de força médio", `${f1(pct(B.filter((x) => x.tituloBra).length, B.length))} / ${f1(media(B.map((x) => x.posForca)))}`, entre(pct(B.filter((x) => x.tituloBra).length, B.length), 22, 28), "22-28");
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
const dif = { facil: [bloco("F_facil_aleatorio"), bloco("F_facil_melhor"), bloco("F_facil_inteligente")], normal: [bloco("A_aleatorio"), B, SI], dificil: [bloco("F_dificil_aleatorio"), bloco("F_dificil_melhor"), bloco("F_dificil_inteligente")] };
const alvoSmart = { facil: [40, 50], normal: [28, 35], dificil: [14, 22] };
for (const [d, [al, gu, sm]] of Object.entries(dif)) {
  const z4 = pct(al.filter((x) => x.pos >= 17).length, al.length);
  if (d === "normal") meta("5", "normal: mediana ao acaso / Z4 ao acaso %", `${med(al)} / ${f1(z4)}`, entre(med(al), 9, 10) && z4 <= 12, "9-10 / ≤ 12");
  else meta("5", `${d}: mediana ao acaso / Z4 %`, `${med(al)} / ${f1(z4)}`, true, "informativo");
  meta("5", `${d}: campeão com a maior nota % / inteligente %`, `${f1(camp(gu))} / ${f1(camp(sm))}`, entre(camp(sm), ...alvoSmart[d]), `inteligente ~${d === "facil" ? 45 : d === "normal" ? "28-35" : 18}`);
}

// 7. pior escolha
const C = bloco("C_pior");
meta("7", "pior escolha: Z4 %", f1(pct(C.filter((x) => x.pos >= 17).length, C.length)), pct(C.filter((x) => x.pos >= 17).length, C.length) >= 60, "≥ 60");
meta("7", "pior escolha: top 12 %", f1(pct(C.filter((x) => x.pos <= 12).length, C.length)), pct(C.filter((x) => x.pos <= 12).length, C.length) >= 3, "≥ 3");

// E. emocao do pacote (Normal: tudo menos o bloco F de dificuldade)
const NORMAL = L.filter((x) => !x.erro && x.emocao && (x.dificuldade || "normal") === "normal");
const dois = NORMAL.filter((x) => x.emocao.concretos >= 2).length;
const lq = NORMAL.reduce((s, x) => s + x.emocao.leques, 0), lqT = NORMAL.reduce((s, x) => s + x.emocao.lequesTijolo, 0);
meta("E", "drafts que mostram 2+ concretos %", f1(pct(dois, NORMAL.length)), pct(dois, NORMAL.length) >= 90, "≥ 90");
meta("E", "leques com tijolo ou concreto %", f1(pct(lqT, lq)), pct(lqT, lq) >= 70, "≥ 70");
meta("E", "concretos vistos por draft (média) / escolhidos pela maior nota", `${f1(media(NORMAL.map((x) => x.emocao.concretos)))} / ${f1(media(B.map((x) => x.emocao.concretosEscolhidos)))}`, true, "informativo");
meta("E", "drafts que mostram 1+ concreto %", f1(pct(NORMAL.filter((x) => x.emocao.concretos >= 1).length, NORMAL.length)), true, "informativo");

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
