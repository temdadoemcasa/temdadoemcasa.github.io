// uso: node rodar.js <politica> <modo:completo|rapido> <semente_inicial> <quantidade> <saida.jsonl>
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { carregarJogo, criarPrng, TEXTOS } = require("./ambiente");

const [pol, modo, s0, n, saida] = process.argv.slice(2);
const semBugProjecao = process.argv.includes("--sem-bug-projecao"); // so pra reproduzir a auditoria antiga
const RUIM = /undefined|NaN|\bnull\b|\[object|Infinity|\$\{|  +\S|^\s*$| [,.;:!?](\s|$)/;

(async () => {
  const { ctx, prng } = await carregarJogo(1);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "dentro.js"), "utf8"), ctx, { filename: "dentro.js" });
  const out = fs.createWriteStream(saida);
  const t0 = Date.now();
  for (let i = 0; i < Number(n); i++) {
    const semente = Number(s0) + i;
    const rngPol = criarPrng(semente * 7919 + 17);
    const ruins = [];
    const capturar = (origem, v) => { if (typeof v !== "string" || RUIM.test(v)) ruins.push(`${origem} => ${JSON.stringify(v)}`); };
    TEXTOS.lista = []; TEXTOS.ligado = true;
    let r;
    const ti = Date.now();
    try {
      r = ctx.rodarCarreira({ semente, pol, modo, rngPol, rngJog: prng, semBugProjecao, capturar });
    } catch (e) {
      r = { semente, pol, modo, excecao: `${e.message}\n${(e.stack || "").split("\n").slice(0, 6).join("\n")}` };
    }
    TEXTOS.ligado = false;
    for (const [origem, v] of TEXTOS.lista) {
      if (typeof v !== "string") { if (v !== undefined && v !== null && typeof v !== "number") ruins.push(`dom:${origem} tipo ${typeof v}`); else if (v === undefined || v === null || Number.isNaN(v)) ruins.push(`dom:${origem} => ${v}`); continue; }
      if (v === "") continue; // textContent = "" e usado pra limpar
      if (RUIM.test(v)) ruins.push(`dom:${origem} => ${JSON.stringify(v)}`);
    }
    r.textosRuins = [...(r.textosRuins || []), ...ruins];
    r.ms = Date.now() - ti;
    out.write(JSON.stringify(r) + "\n");
  }
  out.end();
  console.error(`${pol}/${modo}: ${n} carreiras em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
})();
