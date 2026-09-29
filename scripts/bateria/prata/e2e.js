// E2E da janela de transferencias: joga carreiras, desenha a janela de
// verdade (mostrarMercado / cartoes da peneira) no DOM falso a cada ano e
// lista os botoes de cada estado. Aponta botao repetido ou estado sem saida.
// uso: node e2e.js [carreiras por politica, padrao 60]
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const { carregarJogo, criarPrng } = require("./ambiente");
const N = Number(process.argv[2] || 60);
(async () => {
  const { ctx, prng } = await carregarJogo(1);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "dentro.js"), "utf8"), ctx, { filename: "dentro.js" });
  const doc = vm.runInContext("document", ctx);
  const estados = {}, problemas = [];
  const botoes = (no, out = []) => {
    if (!no || !no.children) return out;
    if (no.tagName === "BUTTON") {
      const proprio = !!no._texto;
      const rot = no._texto || (no.children[0] && no.children[0]._texto) || "";
      const dicas = no.children.slice(proprio ? 0 : 1).map((c) => c._texto).filter(Boolean);
      out.push({ rot, dicas });
    }
    for (const c of no.children) if (c && typeof c === "object") botoes(c, out);
    return out;
  };
  const e2e = (estado, desenhar, id = "mercado") => {
    try { desenhar(); } catch (e) { problemas.push(`${estado}: exceção ${e.message}`); return; }
    const bs = botoes(doc.getElementById(id));
    const rots = bs.map((b) => b.rot);
    const clube = rots.filter((r) => !["Aceita", "Pedir vaga de titular", "Assina"].includes(r));
    const rep = clube.filter((r, i) => clube.indexOf(r) !== i);
    if (rep.length) problemas.push(`${estado}: botão repetido ${rep.join(", ")}`);
    if (!rots.length) problemas.push(`${estado}: nenhum botão`);
    if (rots.some((r) => !r || /undefined|NaN|null/.test(r))) problemas.push(`${estado}: rótulo quebrado ${JSON.stringify(rots)}`);
    const chave = `${estado}`;
    const exemplo = bs.map((b) => b.rot + (b.dicas.length ? ` [${b.dicas.join(" / ")}]` : ""));
    const tipo = [...new Set(exemplo.map((x) => x.replace(/\d{4}/g, "AAAA").replace(/\b\d+ anos?\b/g, "N anos")))].join(" | ");
    ((estados[chave] ||= {})[tipo] ||= { n: 0, exemplo })[ "n"]++;
  };
  let sem = 1;
  for (const [pol, modo] of [["aleatoria", "completo"], ["gulosa", "completo"], ["assina", "completo"], ["aleatoria", "rapido"], ["gulosa", "rapido"]]) {
    for (let i = 0; i < N; i++, sem++) {
      try { ctx.rodarCarreira({ semente: 900000 + sem, pol, modo, rngPol: criarPrng(sem * 31 + 7), rngJog: prng, capturar: () => {}, e2e }); }
      catch (e) { problemas.push(`${pol}/${modo} #${sem}: exceção ${e.message}`); }
    }
  }
  console.log(`# E2E da janela (${sem - 1} carreiras)\n`);
  for (const [estado, tipos] of Object.entries(estados).sort()) {
    const tot = Object.values(tipos).reduce((a, t) => a + t.n, 0);
    console.log(`## ${estado} (${tot} janelas)`);
    for (const [, t] of Object.entries(tipos).sort((a, b) => b[1].n - a[1].n).slice(0, 4)) console.log(`- ×${t.n}: ${t.exemplo.join(" · ")}`);
  }
  console.log(`\nProblemas: ${problemas.length ? "\n- " + [...new Set(problemas)].slice(0, 30).join("\n- ") : "nenhum"}`);
})();
