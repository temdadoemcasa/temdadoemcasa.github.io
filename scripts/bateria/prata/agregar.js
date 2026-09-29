// Junta os *.jsonl da bateria (x-*.jsonl = experimento extra) e escreve
// tabelas.md + resumo.json na mesma pasta (BATERIA_OUT; padrao: $TMPDIR/bateria-prata-da-casa)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const OUT = process.env.BATERIA_OUT || path.join(require("os").tmpdir(), "bateria-prata-da-casa");
const REPO = process.env.REPO || path.resolve(__dirname, "../../..");

const ler = (f) => fs.readFileSync(path.join(OUT, f), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const arquivos = fs.readdirSync(OUT).filter((f) => f.endsWith(".jsonl") && !f.startsWith("x-") && !f.startsWith("pior") && !f.startsWith("assina") && f !== "teste.jsonl");
const R = arquivos.flatMap(ler);
const extras = fs.readdirSync(OUT).filter((f) => f.startsWith("x-") && f.endsWith(".jsonl"));

// catalogo: ids de EVENTOS lidos do proprio carreira.js + titulos dos arcos
const src = fs.readFileSync(path.join(REPO, "carreira.js"), "utf8");
const bloco = src.slice(src.indexOf("const EVENTOS = ["), src.indexOf("const DICA_FOCO"));
const idsEventos = [...bloco.matchAll(/^\s{4}id: "([^"]+)"/gm)].map((m) => m[1]);
const ARCOS = {
  "A rotina": ["Primeira semana no alojamento", "O titular sentiu no aquecimento", "Os amigos do bairro", "A diretoria chamou você e a sua família"],
  "Dinheiro curto": ["O mês não fecha em casa", "A publicidade que ficou"],
  "O primeiro contrato": ["Primeiro salário de verdade", "Primeiro contrato profissional", "O carro e a fase ruim", "A saída do CT"],
  "Longe de casa": ["A saudade no primeiro mês", "A saudade cobrou"],
  "O treino do profissional": ["Faltou um no treino de cima"],
  "O técnico do sub-17": ["O técnico do sub-17 não gosta de você"],
  "O grupo de apostas": ["O grupo da infância", "Denúncia no tribunal esportivo", "Seu nome numa investigação"],
  "O polêmico": ["Gol no clássico, na casa deles", "O microfone", "Você virou personagem"],
  "O aliciador": ["Uma mensagem no direct", "Operação sobre apostas", "Ele voltou", "Testemunha da acusação", "O rosto da campanha", "O passado cobra"],
  "O rival": ["Provocação antes do mata-mata", "Depois do apito", "Você virou meme", "A zoeira veio igual", "Reencontro com <rival>", "O rival no seu vestiário"],
  "A renovação": ["O presidente quer renovar agora", "A braçadeira", "A torcida cobra"],
  "O mentor": ["O capitão te chamou", "O garoto da base"],
  "O joelho": ["A final e o joelho", "O joelho de novo"],
  "A crise": ["O vestiário contra o técnico", "O racha"],
  "O corpo": ["O corpo começou a cobrar", "Conversa sobre o futuro", "O banco te chama"],
  "O ídolo da divisão": ["O melhor da divisão", "A cidade é sua"],
  "Choque cultural": ["O primeiro inverno", "Um clube brasileiro quer te repatriar", "O passaporte"],
  "A seleção": ["A lista da Copa e a coxa", "A braçadeira da seleção"],
  "Os petrodólares": ["Proposta da Arábia"],
  "A despedida": ["O jogo de despedida"],
  "De volta pra casa": ["A arquibancada da infância"],
};
const catalogo = ["foco", ...idsEventos, ...Object.entries(ARCOS).flatMap(([a, ts]) => ts.map((t) => `${a}|${t}`))];

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const grupos = (xs, k) => xs.reduce((m, r) => ((m[k(r)] ||= []).push(r), m), {});
const tabela = (cab, linhas) => [`| ${cab.join(" | ")} |`, `|${cab.map(() => "---").join("|")}|`, ...linhas.map((l) => `| ${l.join(" | ")} |`)].join("\n");

const md = [];
const ok = R.filter((r) => !r.excecao);
const exc = R.filter((r) => r.excecao);
md.push(`# Tabelas da bateria (${R.length} carreiras, ${exc.length} com excecao)\n`);

// ---------- 1. resultados por politica ----------
const tier = (r) => (r.bolaDeOuro ? "1 Bola de Ouro" : r.europaElite ? "2 Elite europeia" : r.europa ? "3 Europa" : r.serieA || r.lugares.some((l) => l && l !== "inf") ? "4 Série A / exterior" : "5 Só Série B-D");
const pols = ["aleatoria", "gulosa", "cautelosa", "primeira", "impaciente"].filter((p) => R.some((r) => r.pol === p));
const linhasPol = [];
for (const p of pols) for (const m of ["completo", "rapido", "todos"]) {
  const xs = ok.filter((r) => r.pol === p && (m === "todos" || r.modo === m));
  if (!xs.length) continue;
  linhasPol.push([p, m, xs.length, f1(media(xs.map((r) => r.temporadas))), `${quant(xs.map((r) => r.idadeFim), 0.05)}-${quant(xs.map((r) => r.idadeFim), 0.5)}-${quant(xs.map((r) => r.idadeFim), 0.95)}`,
    f1(media(xs.map((r) => r.auge))), pct(xs.filter((r) => r.auge >= 85).length, xs.length), pct(xs.filter((r) => r.auge >= 90).length, xs.length),
    f1(media(xs.map((r) => r.titulosClube))), f1(media(xs.map((r) => r.premios))), pct(xs.filter((r) => r.bolaDeOuro).length, xs.length),
    pct(xs.filter((r) => r.selecao).length, xs.length), pct(xs.filter((r) => r.serieA).length, xs.length), pct(xs.filter((r) => r.europa).length, xs.length),
    pct(xs.filter((r) => r.soInferior).length, xs.length), f2(media(xs.map((r) => r.temporadasPerdidas))), f1(media(xs.map((r) => r.transferencias)))]);
}
md.push("## Resultado por política\n");
md.push(tabela(["política", "modo", "n", "temporadas", "idade fim p5-p50-p95", "OVR auge", "auge≥85", "auge≥90", "títulos clube", "prêmios", "Bola de Ouro", "seleção", "jogou Série A", "jogou Europa", "só Série B-D", "temp. perdidas", "transferências"], linhasPol));

// finais (faixas)
md.push("\n## Desfecho (faixa mais alta alcançada)\n");
const tiers = ["1 Bola de Ouro", "2 Elite europeia", "3 Europa", "4 Série A / exterior", "5 Só Série B-D"];
md.push(tabela(["política", ...tiers], pols.map((p) => { const xs = ok.filter((r) => r.pol === p); return [p, ...tiers.map((t) => pct(xs.filter((r) => tier(r) === t).length, xs.length))]; })));
const motivo = (r) => (r.aposentadoForcada ? "forçada (40/42)" : r.idadeFim <= 33 ? "cedo (≤33)" : "34-39");
md.push("\n## Aposentadoria\n");
md.push(tabela(["política", "forçada (40/42)", "34-39", "cedo (≤33)"], pols.map((p) => { const xs = ok.filter((r) => r.pol === p); return [p, ...["forçada (40/42)", "34-39", "cedo (≤33)"].map((t) => pct(xs.filter((r) => motivo(r) === t).length, xs.length))]; })));

// pareado: mesma semente (mesmo jogador) em cada politica
md.push("\n## Comparação pareada (mesma semente = mesmo jogador e mesmo sorteio inicial)\n");
const porChave = grupos(ok, (r) => `${r.modo}:${r.semente}`);
const score = (r) => r.premios * 1 + r.titulosClube * 0.5 + (r.auge - 70) * 0.5 + (r.europa ? 3 : 0) + r.bolaDeOuro * 10;
const vit = {}; const cont = {};
for (const g of Object.values(porChave)) {
  if (g.length < pols.length) continue;
  const best = Math.max(...g.map(score));
  for (const r of g) { cont[r.pol] = (cont[r.pol] || 0) + 1; if (score(r) === best) vit[r.pol] = (vit[r.pol] || 0) + 1; }
}
md.push(tabela(["política", "melhor carreira do grupo (score)", "score médio"], pols.map((p) => [p, pct(vit[p] || 0, cont[p] || 0), f1(media(ok.filter((r) => r.pol === p).map(score)))])));
md.push("\n(score = prêmios + 0,5×títulos de clube + 0,5×(auge−70) + 3 se jogou na Europa + 10×Bolas de Ouro; empates contam pra todos)\n");
// efeito do potencial vs politica
const faixasPot = [[76, 82], [83, 88], [89, 92], [93, 99]];
md.push("\n## Auge médio por potencial sorteado × política (o dado pesa mais que as escolhas?)\n");
md.push(tabela(["potencial", ...pols], faixasPot.map(([a, b]) => [`${a}-${b}`, ...pols.map((p) => { const xs = ok.filter((r) => r.pol === p && r.potencial >= a && r.potencial <= b); return `${f1(media(xs.map((r) => r.auge)))} (n=${xs.length})`; })])));

// ---------- 2. cobertura ----------
const vistoTot = {}, vistoCarreiras = {}, vistoPol = {};
for (const r of ok) {
  const s = new Set(r.vistos);
  for (const k of r.vistos) vistoTot[k] = (vistoTot[k] || 0) + 1;
  for (const k of s) { vistoCarreiras[k] = (vistoCarreiras[k] || 0) + 1; ((vistoPol[k] ||= {})[r.pol] = (vistoPol[k][r.pol] || 0) + 1); }
}
const interativas = ok.length;
md.push("\n## Cobertura de situações (em quantas carreiras cada uma apareceu)\n");
md.push(tabela(["situação", "carreiras", "% carreiras", "vezes"], catalogo.map((k) => [k, vistoCarreiras[k] || 0, pct(vistoCarreiras[k] || 0, interativas), vistoTot[k] || 0]).sort((a, b) => b[1] - a[1])));
const nunca = catalogo.filter((k) => !vistoCarreiras[k]);
const raras = catalogo.filter((k) => vistoCarreiras[k] && vistoCarreiras[k] / interativas < 0.02);
const foraCatalogo = Object.keys(vistoTot).filter((k) => !catalogo.includes(k));
md.push(`\n**Nunca apareceram em ${R.length} carreiras:** ${nunca.length ? nunca.join(", ") : "nenhuma"}\n`);
md.push(`**Raras (<2% das carreiras):** ${raras.map((k) => `${k} (${pct(vistoCarreiras[k], interativas)})`).join(", ") || "nenhuma"}\n`);
if (foraCatalogo.length) md.push(`**Vistas mas fora do catálogo:** ${foraCatalogo.join(", ")}\n`);

// opcoes
const opCont = {}, opOk = {}, opPol = {};
for (const r of ok) for (const [k, op, res] of r.escolhas) {
  const kk = `${k}#${op}`;
  opCont[kk] = (opCont[kk] || 0) + 1;
  if (res !== null) { (opOk[kk] ||= [0, 0]); opOk[kk][res ? 0 : 1]++; }
  ((opPol[k] ||= {})[r.pol] ||= {})[op] = ((opPol[k][r.pol] || {})[op] || 0) + 1;
}
// opcoes definidas (lidas do codigo, na ordem): pega das escolhas vistas + as nunca escolhidas via aleatoria
const opcoesPorEvento = {};
for (const kk of Object.keys(opCont)) { const [k, op] = kk.split("#"); (opcoesPorEvento[k] ||= new Set()).add(op); }
md.push("\n## Escolhas: quanto cada opção foi escolhida e a taxa real de sucesso\n");
const linhasOp = [];
for (const k of Object.keys(opcoesPorEvento).sort()) {
  if (k === "foco") continue;
  for (const op of [...opcoesPorEvento[k]].sort()) {
    const kk = `${k}#${op}`; const o = opOk[kk];
    const g = opPol[k].gulosa ? Object.values(opPol[k].gulosa).reduce((a, b) => a + b, 0) : 0;
    const c = opPol[k].cautelosa ? Object.values(opPol[k].cautelosa).reduce((a, b) => a + b, 0) : 0;
    linhasOp.push([k, op, opCont[kk], o ? pct(o[0], o[0] + o[1]) : "certa", g ? pct((opPol[k].gulosa[op] || 0), g) : "-", c ? pct((opPol[k].cautelosa[op] || 0), c) : "-"]);
  }
}
md.push(tabela(["situação", "opção", "escolhida (todas)", "deu certo", "gulosa escolhe", "cautelosa escolhe"], linhasOp));
// foco
const focos = {};
for (const r of ok) for (const [k, op] of r.escolhas) if (k === "foco") focos[op.split(":")[1]] = (focos[op.split(":")[1]] || 0) + 1;
md.push(`\n**Foco da pré-temporada (atributo escolhido, todas as políticas):** ${Object.entries(focos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}\n`);
// dominancia: a gulosa escolhe sempre a mesma opcao?
const dominadas = [];
for (const k of Object.keys(opPol)) {
  if (k === "foco" || !opPol[k].gulosa) continue;
  const g = opPol[k].gulosa; const tot = Object.values(g).reduce((a, b) => a + b, 0);
  const [op, n] = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
  if (tot >= 30 && n / tot >= 0.95) dominadas.push([k, op, pct(n, tot), tot]);
}
md.push("\n## Opção dominante (gulosa escolhe a mesma em ≥95% das vezes, n≥30)\n");
md.push(tabela(["situação", "opção", "share", "n"], dominadas.sort((a, b) => a[0].localeCompare(b[0]))));

// ---------- 3. repeticoes e loops ----------
md.push("\n## Repetições dentro da mesma carreira\n");
const rep = {};
let carreirasComRep = 0;
for (const r of ok) {
  const c = {}; for (const k of r.vistos) if (k !== "foco") c[k] = (c[k] || 0) + 1;
  const dup = Object.entries(c).filter(([, n]) => n > 1);
  if (dup.length) carreirasComRep++;
  for (const [k, n] of dup) rep[k] = Math.max(rep[k] || 0, n);
}
md.push(`Carreiras com a MESMA situação (fora o foco) mais de uma vez: ${carreirasComRep} (${pct(carreirasComRep, ok.length)}). Máximo por situação: ${Object.entries(rep).map(([k, n]) => `${k}×${n}`).join(", ") || "-"}\n`);
const focoAnos = ok.map((r) => r.vistos.filter((k) => k === "foco").length);
md.push(`Foco da pré-temporada por carreira: média ${f1(media(focoAnos))}, máx ${Math.max(...focoAnos)}\n`);
const pares = [["dor", "O joelho|A final e o joelho"], ["aquecimento", "O joelho|A final e o joelho"], ["bracadeira", "A renovação|A braçadeira"], ["padrinho", "O mentor|O garoto da base"],
  ["empresario-base", "empresario"], ["tecnico-demitido", "A crise|O vestiário contra o técnico"], ["penalti", "penalti-gol"], ["classico", "O rival|Provocação antes do mata-mata"], ["classico", "O polêmico|Gol no clássico, na casa deles"],
  ["idolo", "O mentor|O capitão te chamou"], ["reuniao", "A crise|O vestiário contra o técnico"], ["entrevista", "O polêmico|O microfone"], ["festa", "A rotina|Os amigos do bairro"], ["escola-noite", "escola"], ["veterano", "O corpo|O corpo começou a cobrar"], ["ultimo-ano", "O corpo|Conversa sobre o futuro"]];
md.push(tabela(["par temático", "carreiras com os dois", "% das que viram o 1º"], pares.map(([a, b]) => {
  const ambos = ok.filter((r) => r.vistos.includes(a) && r.vistos.includes(b)).length; const soA = ok.filter((r) => r.vistos.includes(a)).length;
  return [`${a} + ${b}`, ambos, pct(ambos, soA)];
})));
const evAno = grupos(ok.filter((r) => r.pol !== "impaciente"), (r) => r.modo);
md.push("\n## Decisões por temporada (tela)\n");
md.push(tabela(["modo", "média", "distribuição"], Object.entries(evAno).map(([m, xs]) => { const all = xs.flatMap((r) => r.eventosPorAno); const d = {}; for (const x of all) d[x] = (d[x] || 0) + 1; return [m, f2(media(all)), Object.entries(d).map(([k, v]) => `${k}: ${pct(v, all.length)}`).join(", ")]; })));

// ---------- 4. consequencias descartadas ----------
md.push("\n## Consequências vencidas × mostradas (modo interativo)\n");
const dev = {}, mos = {};
for (const r of ok) { for (const [k, v] of Object.entries(r.conseqDevidas)) dev[k] = (dev[k] || 0) + v; for (const [k, v] of Object.entries(r.conseqMostradas)) mos[k] = (mos[k] || 0) + v; }
md.push(tabela(["consequência", "venceu", "mostrada", "sumiu"], Object.keys(dev).sort().map((k) => [k, dev[k], mos[k] || 0, `${dev[k] - (mos[k] || 0)} (${pct(dev[k] - (mos[k] || 0), dev[k])})`])));

// ---------- 5. arcos ----------
md.push("\n## Arcos por carreira\n");
const nArcos = ok.map((r) => r.arcos.length);
const dist = {}; for (const x of nArcos) dist[x] = (dist[x] || 0) + 1;
md.push(`Média ${f1(media(nArcos))}; distribuição: ${Object.entries(dist).map(([k, v]) => `${k}: ${pct(v, ok.length)}`).join(", ")}\n`);
const arcoFreq = {}; for (const r of ok) for (const a of r.arcos) arcoFreq[a] = (arcoFreq[a] || 0) + 1;
md.push(tabela(["arco", "% carreiras"], Object.entries(arcoFreq).sort((a, b) => b[1] - a[1]).map(([a, n]) => [a, pct(n, ok.length)])));
const marcaFreq = {}; for (const r of ok) for (const m of r.marcas) marcaFreq[m] = (marcaFreq[m] || 0) + 1;
md.push(`\nMarcas no fim da carreira: ${Object.entries(marcaFreq).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, ok.length)}`).join(", ")}\n`);
const auto = {}; for (const r of ok) for (const t of r.trilhaAuto) auto[t] = (auto[t] || 0) + 1;
md.push(`\nResolvidas no automático ("Simular o resto", política impaciente): ${Object.entries(auto).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join("; ") || "-"}\n`);
const topa = ok.filter((r) => r.voltouFormador !== null);
md.push(`\n"Topa voltar" (clube formador): ${topa.length} carreiras; voltou de fato: ${topa.filter((r) => r.voltouFormador).length} (${pct(topa.filter((r) => r.voltouFormador).length, topa.length)}). Por política: ${pols.map((p) => { const xs = topa.filter((r) => r.pol === p); return `${p} ${xs.filter((r) => r.voltouFormador).length}/${xs.length}`; }).join(", ")}\n`);

// ---------- 6. mercado ----------
md.push("\n## Mercado (modo completo)\n");
md.push(tabela(["política", "escolhas na janela"], pols.map((p) => { const t = {}; for (const r of ok.filter((x) => x.pol === p && x.modo === "completo")) for (const [k, v] of Object.entries(r.mercado)) t[k] = (t[k] || 0) + v; return [p, Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")]; })));
const baseDiv = {}; for (const r of ok) { baseDiv[r.base.opcoes] = (baseDiv[r.base.opcoes] || 0) + 1; }
md.push(`\nPropostas da peneira (divisões oferecidas): ${Object.entries(baseDiv).map(([k, v]) => `${k} ${pct(v, ok.length)}`).join(", ")}\n`);
md.push(`Empréstimos: ${pct(ok.filter((r) => r.emprestimos > 0).length, ok.length)} das carreiras\n`);

// ---------- 7. erros, textos, travas ----------
md.push("\n## Exceções, erros e travas\n");
md.push(`Exceções: ${exc.length}\n`);
const excC = {}; for (const r of exc) { const k = r.excecao.split("\n").slice(0, 3).join(" | "); excC[k] = (excC[k] || 0) + 1; }
for (const [k, v] of Object.entries(excC)) md.push(`- ×${v}: \`${k}\`\n`);
const errC = {}; for (const r of ok) for (const e of r.erros) errC[e] = (errC[e] || 0) + 1;
md.push(`Erros ao avaliar opções (gulosa): ${Object.keys(errC).length ? Object.entries(errC).map(([k, v]) => `${k} ×${v}`).join("; ") : "nenhum"}\n`);
const trav = {}; for (const r of ok) for (const e of r.softlock) trav[e] = (trav[e] || 0) + 1;
md.push(`Travas/loops: ${Object.keys(trav).length ? Object.entries(trav).map(([k, v]) => `${k} ×${v}`).join("; ") : "nenhum"}\n`);
md.push(`Números inválidos (NaN/Infinity) no histórico: ${ok.reduce((a, r) => a + r.nulos, 0)}\n`);
const ms = ok.map((r) => r.ms);
md.push(`Tempo por carreira: média ${f1(media(ms))} ms, máx ${Math.max(...ms)} ms\n`);
const txt = {}; for (const r of ok) for (const t of r.textosRuins) { const k = t.replace(/\d+/g, "#").slice(0, 220); txt[k] = (txt[k] || 0) + 1; }
md.push(`\n### Textos suspeitos mostrados ao jogador (${Object.keys(txt).length} padrões)\n`);
for (const [k, v] of Object.entries(txt).sort((a, b) => b[1] - a[1]).slice(0, 60)) md.push(`- ×${v}: ${k}\n`);

// ---------- 8. experimento: bug da projecao ----------
if (extras.length) {
  md.push("\n## Experimento extra: projeção sem decair a reputação (mesmas sementes)\n");
  const linhas = [];
  for (const f of extras) {
    const xs = ler(f).filter((r) => !r.excecao); const pol = xs[0].pol;
    const base = ok.filter((r) => r.pol === pol && r.modo === "completo");
    const m = (ys, fn) => f2(media(ys.map(fn)));
    const repAbs = (r) => Object.values(r.rep).reduce((a, b) => a + Math.abs(b), 0);
    linhas.push([pol, "com bug (jogo atual)", base.length, m(base, repAbs), m(base, (r) => r.auge), m(base, (r) => r.premios), m(base, (r) => r.titulosClube), pct(base.filter((r) => r.europa).length, base.length)]);
    linhas.push([pol, "sem bug", xs.length, m(xs, repAbs), m(xs, (r) => r.auge), m(xs, (r) => r.premios), m(xs, (r) => r.titulosClube), pct(xs.filter((r) => r.europa).length, xs.length)]);
  }
  md.push(tabela(["política", "variante", "n", "Σ|reputação| no fim", "auge", "prêmios", "títulos", "jogou Europa"], linhas));
}

fs.writeFileSync(path.join(OUT, "tabelas.md"), md.join("\n"));
fs.writeFileSync(path.join(OUT, "resumo.json"), JSON.stringify({ n: R.length, excecoes: exc.length, nunca, raras, dominadas, carreirasComRep }, null, 1));
console.log(`ok: ${R.length} carreiras -> ${path.join(OUT, "tabelas.md")}`);
