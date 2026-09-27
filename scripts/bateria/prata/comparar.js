// compara duas baterias (mesmas sementes): node comparar.js <pasta-antes> <pasta-depois>
"use strict";
const fs = require("fs"), path = require("path");
const [A, B] = process.argv.slice(2);
const ler = (d) => fs.readdirSync(d).filter((f) => f.endsWith(".jsonl") && !f.startsWith("x-")).flatMap((f) => fs.readFileSync(path.join(d, f), "utf8").trim().split("\n").map(JSON.parse));
const m = (xs, fn) => xs.reduce((a, r) => a + fn(r), 0) / xs.length;
const pct = (xs, fn) => `${((100 * xs.filter(fn).length) / xs.length).toFixed(1)}%`;
const repAbs = (r) => Object.values(r.rep).reduce((a, b) => a + Math.abs(b), 0);
const cat = (xs) => new Set(xs.flatMap((r) => r.vistos)).size;
const linhas = [];
for (const [rot, filtro] of [["todas", () => true], ["completo", (r) => r.modo === "completo"], ["gulosa completo", (r) => r.pol === "gulosa" && r.modo === "completo"], ["cautelosa completo", (r) => r.pol === "cautelosa" && r.modo === "completo"], ["impaciente", (r) => r.pol === "impaciente"]]) {
  const a = ler(A).filter(filtro), b = ler(B).filter(filtro);
  for (const [k, fn] of [
    ["n", (xs) => xs.length], ["exceções", (xs) => xs.filter((r) => r.excecao).length], ["textos suspeitos", (xs) => xs.reduce((s, r) => s + (r.textosRuins || []).length, 0)],
    ["situações distintas vistas (de 96)", cat], ["Σ|reputação| no fim", (xs) => m(xs, repAbs).toFixed(2)], ["reputação ≠ 0 no fim (algum medidor)", (xs) => pct(xs, (r) => Object.values(r.rep).some((v) => v !== 0))],
    ["OVR auge", (xs) => m(xs, (r) => r.auge).toFixed(2)], ["prêmios", (xs) => m(xs, (r) => r.premios).toFixed(2)], ["títulos clube", (xs) => m(xs, (r) => r.titulosClube).toFixed(2)],
    ["jogou Europa", (xs) => pct(xs, (r) => r.europa)], ["Bola de Ouro", (xs) => pct(xs, (r) => r.bolaDeOuro)], ["só Série B-D", (xs) => pct(xs, (r) => r.soInferior)],
    ["prêmios (só B-D)", (xs) => { const s = xs.filter((r) => r.soInferior); return s.length ? m(s, (r) => r.premios).toFixed(2) : "-"; }],
    ["prêmios (resto)", (xs) => { const s = xs.filter((r) => !r.soInferior); return s.length ? m(s, (r) => r.premios).toFixed(2) : "-"; }],
    ["temporadas", (xs) => m(xs, (r) => r.temporadas).toFixed(2)],
    ["Topa voltar → voltou", (xs) => { const t = xs.filter((r) => r.voltouFormador !== null); return `${t.filter((r) => r.voltouFormador).length}/${t.length}`; }],
    ["data-fifa vista (carreiras)", (xs) => xs.filter((r) => r.vistos.includes("data-fifa")).length],
  ]) linhas.push(`| ${rot} | ${k} | ${fn(a)} | ${fn(b)} |`);
}
const auto = (d) => { const c = {}; for (const r of ler(d)) for (const t of r.trilhaAuto) { const k = t.replace(/ \(no automático\)$/, ""); c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ×${v}`).join("; "); };
console.log(["| recorte | métrica | antes | depois |", "|---|---|---|---|", ...linhas].join("\n"));
console.log(`\nAutomático, antes: ${auto(A)}\n\nAutomático, depois: ${auto(B)}`);
