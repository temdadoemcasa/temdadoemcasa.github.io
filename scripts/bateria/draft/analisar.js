// Metricas da bateria: node analisar.js [tudo.jsonl]  (padrao: $SAIDA/tudo.jsonl)
const fs = require("fs");
const L = fs.readFileSync(process.argv[2] || `${process.env.SAIDA || (process.env.TMPDIR || "/tmp") + "/bateria-draft"}/tudo.jsonl`, "utf8").trim().split("\n").map(JSON.parse);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "-");
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const erros = L.filter((x) => x.erro);
console.log("tentativas", L.length, "erros", erros.length, erros.slice(0, 3).map((e) => e.erro));
const probs = {}; for (const x of L) for (const p of x.problemas || []) { const k = p.replace(/[0-9]+/g, "#").slice(0, 90); probs[k] = (probs[k] || 0) + 1; }
console.log("problemas", probs);
console.log("clube do usuario = draftado:", L.filter((x) => x.usuarioOk).length, "/", L.length, "| gols de expulso depois do vermelho:", L.reduce((s, x) => s + (x.expulsoMarca || 0), 0), "| penaltis perdidos por expulso:", L.reduce((s, x) => s + (x.expulsoBate || 0), 0));
console.log("agendaErros total", L.reduce((s, x) => s + (x.agendaErros || 0), 0), "tentativas com erro de agenda", L.filter((x) => x.agendaErros).length);
const ex = L.filter((x) => x.agendaErros).slice(0, 5).map((x) => x.problemas.filter((p) => p.startsWith("agenda")));
console.log("ex agenda", JSON.stringify(ex, null, 0));
function resumo(nome, g) {
  const n = g.length; if (!n) return;
  const pos = g.map((x) => x.pos);
  const tit = (k) => g.filter((x) => x[k]).length;
  const cont = g.filter((x) => x.continental === "lib"), sul = g.filter((x) => x.continental === "sul");
  console.log(`${nome.padEnd(26)} n=${String(n).padStart(4)} ovr=${media(g.map((x) => x.mediaOnze)).toFixed(1)} atq=${media(g.map((x) => x.atq)).toFixed(1)} def=${media(g.map((x) => x.def)).toFixed(1)} forca#=${media(g.map((x) => x.posForca)).toFixed(1)} | pos med=${q(pos, .5)} p10=${q(pos, .1)} p90=${q(pos, .9)} pts=${media(g.map((x) => x.pts)).toFixed(1)} | BR ${pct(tit("tituloBra"), n)} G6 ${pct(g.filter((x) => x.pos <= 6).length, n)} Z4 ${pct(g.filter((x) => x.pos >= 17).length, n)} | CdB ${pct(tit("tituloCdb"), n)} LIB ${pct(cont.filter((x) => x.tituloLib).length, cont.length)} SUL(esc) ${pct(sul.filter((x) => x.tituloSul).length, sul.length)} SUL(lib3) ${pct(cont.filter((x) => x.tituloSul).length, cont.length)} | 0 titulos ${pct(g.filter((x) => !x.tituloBra && !x.tituloCdb && !x.tituloLib && !x.tituloSul).length, n)} triplice+ ${pct(g.filter((x) => [x.tituloBra, x.tituloCdb, x.tituloLib || x.tituloSul].filter(Boolean).length >= 3).length, n)}`);
}
const por = (f) => { const m = new Map(); for (const x of L) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
console.log("\n== por bloco/politica ==");
for (const [k, g] of por((x) => x.bloco)) resumo(k, g);
console.log("\n== melhor (B) por esquema ==");
for (const [k, g] of por((x) => x.bloco === "B_melhor" ? x.esquema : null)) if (k) resumo(k, g);
console.log("\n== pior (C) por esquema ==");
for (const [k, g] of por((x) => x.bloco === "C_pior" ? x.esquema : null)) if (k) resumo(k, g);
console.log("\n== aleatorio (A) por esquema ==");
for (const [k, g] of por((x) => x.bloco === "A_aleatorio" ? x.esquema : null)) if (k) resumo(k, g);
console.log("\n== quem sai (F), aleatorio+melhor ==");
for (const [k, g] of por((x) => x.bloco === "F_sai" ? x.sai : null)) if (k) resumo(k, g);
console.log("\n== continental (todos) ==");
for (const [k, g] of por((x) => x.continental)) resumo(k, g);
// distribuicao de posicao por politica
console.log("\n== distribuicao de posicao final ==");
for (const b of ["A_aleatorio", "B_melhor", "C_pior", "E_humano"]) {
  const g = L.filter((x) => x.bloco === b); const h = Array(21).fill(0); for (const x of g) h[x.pos]++;
  console.log(b.padEnd(12), h.slice(1).map((c) => (100 * c / g.length).toFixed(0)).join(" "));
}
// realismo da liga
const lg = L.map((x) => x.liga);
const S = (k) => lg.reduce((s, l) => s + l[k], 0);
const J = S("jogos");
console.log("\n== realismo Brasileirao (todas as 5000 temporadas, 380 jogos cada) ==");
console.log(`gols/jogo ${(S("gols") / J).toFixed(2)}  mandante ${pct(S("casa"), J)} empate ${pct(S("emp"), J)} visitante ${pct(S("fora"), J)} 0x0 ${pct(S("zz"), J)} 6+gols ${pct(S("seis"), J)} penaltis/jogo ${(S("pen") / J).toFixed(2)} vermelhos/jogo ${(S("vermelho") / J).toFixed(2)}`);
const campPts = L.map((x) => x.tabela[0][1]), g4 = L.map((x) => x.tabela[3][1]), p16 = L.map((x) => x.tabela[15][1]), p17 = L.map((x) => x.tabela[16][1]), ult = L.map((x) => x.tabela[19][1]);
const d = (xs) => `med ${media(xs).toFixed(1)} p10 ${q(xs, .1)} p90 ${q(xs, .9)} min ${Math.min(...xs)} max ${Math.max(...xs)}`;
console.log("campeao pts", d(campPts)); console.log("4o pts", d(g4)); console.log("16o pts", d(p16)); console.log("17o pts", d(p17)); console.log("lanterna pts", d(ult));
// quem ganha o BR/CdB/Lib/Sul (CPU)
for (const c of ["bra", "cdb", "lib", "sul"]) {
  const m = {}; for (const x of L) { const k = x.campeoes[c] === undefined ? "?" : (x.campeoes[c] === x.usuarioId ? "USUARIO" : x.campeoes[c]); m[k] = (m[k] || 0) + 1; }
  console.log(c, Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${pct(v, L.length)}`).join(", "));
}
const brasLib = L.filter((x) => { const c = x.campeoes.lib; return c && (c === x.usuarioId || ["Flamengo","Fluminense","Cruzeiro","Corinthians","Palmeiras","Mirassol"].includes(c)); }).length;
console.log("Libertadores com campeao brasileiro (inclui usuario):", pct(brasLib, L.length));
// mata-mata
const M = (k) => L.reduce((s, x) => s + x.mata[k], 0);
console.log(`mata-mata: gols/jogo ${(M("gols") / M("jogos")).toFixed(2)} confrontos decididos nos penaltis ${pct(M("penaltis"), M("confrontos"))}`);
// performance
const ms = L.map((x) => x.ms), msd = L.map((x) => x.msDraft);
console.log(`tempo temporada ms: med ${media(ms).toFixed(1)} p99 ${q(ms, .99).toFixed(1)} max ${Math.max(...ms).toFixed(1)}; draft ms med ${media(msd).toFixed(2)} max ${Math.max(...msd).toFixed(1)}`);
// forca vs resultado (variancia)
console.log("\n== forca (posForca = ranking atq+def entre os 20) x posicao final ==");
for (const [k, g] of [...por((x) => Math.min(20, Math.ceil(x.posForca / 2) * 2))].sort((a, b) => a[0] - b[0]))
  console.log(`forca ate #${String(k).padStart(2)} n=${String(g.length).padStart(4)} pos med ${q(g.map((x) => x.pos), .5)} p10 ${q(g.map((x) => x.pos), .1)} p90 ${q(g.map((x) => x.pos), .9)} BR ${pct(g.filter((x) => x.tituloBra).length, g.length)} algum titulo ${pct(g.filter((x) => x.tituloBra || x.tituloCdb || x.tituloLib || x.tituloSul).length, g.length)} Z4 ${pct(g.filter((x) => x.pos >= 17).length, g.length)}`);
// draft: niveis vistos e escolhidos
const nv = {}, esc = {}; let slots = 0, fora = 0; const idsMelhor = {}, cabeFalso = {};
for (const x of L) for (const s of x.draft || []) { slots++; for (const n of s.niveis) nv[n] = (nv[n] || 0) + 1; if (!s.cabe) cabeFalso[s.pos] = (cabeFalso[s.pos] || 0) + 1; }
console.log("\n== draft ==");
console.log("niveis nas opcoes dos leques:", Object.entries(nv).map(([k, v]) => `${k} ${pct(v, slots * 5)}`).join(" "));
console.log("escolha fora da funcao da vaga (cabeNaVaga=false) por vaga:", JSON.stringify(cabeFalso), "de", slots);
const B = L.filter((x) => x.bloco === "B_melhor");
const freq = {}; for (const x of B) for (const s of x.draft) freq[s.id] = (freq[s.id] || 0) + 1;
const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log("greedy: jogadores distintos usados", Object.keys(freq).length, "em", B.length * 11, "vagas; top12 (id: % dos drafts)", top.map(([k, v]) => `${k}:${pct(v, B.length)}`).join(" "));
// overlap medio entre 2 drafts greedy de mesmo esquema
let ov = 0, np = 0; for (let k = 0; k + 1 < B.length; k += 2) { if (B[k].esquema !== B[k + 1].esquema) continue; const a = new Set(B[k].draft.map((s) => s.id)); ov += B[k + 1].draft.filter((s) => a.has(s.id)).length; np++; }
console.log("greedy: jogadores em comum entre dois drafts do mesmo esquema (de 11):", (ov / np).toFixed(2));
const gapBest = B.map((x) => media(x.draft.map((s) => s.max - s.min)));
console.log("amplitude media do leque (max-min overall):", media(gapBest).toFixed(1));
const lequeSemTijolo = L.flatMap((x) => x.draft || []).filter((s) => !s.niveis.some((n) => n === "tijolo" || n === "grafeno")).length;
console.log("leques sem nenhum tijolo/concreto:", pct(lequeSemTijolo, slots));
const ovTodos = L.filter((x) => x.bloco === "B_melhor").map((x) => x.mediaOnze), ovPior = L.filter((x) => x.bloco === "C_pior").map((x) => x.mediaOnze), ovAl = L.filter((x) => x.bloco === "A_aleatorio").map((x) => x.mediaOnze);
console.log("media do onze: melhor", d(ovTodos.map((v) => +v.toFixed(1))), "| aleatorio", d(ovAl.map((v) => +v.toFixed(1))), "| pior", d(ovPior.map((v) => +v.toFixed(1))));
// eliminacao do usuario por fase
for (const c of ["cdb", "lib", "sul"]) {
  const m = {}; for (const x of L) { const e = x.eliminado[c] || (x.campeoes[c] && x.campeoes[c] === x.usuarioId ? "CAMPEAO" : null); if (e) m[e] = (m[e] || 0) + 1; }
  console.log(`usuario ${c}:`, JSON.stringify(m));
}
