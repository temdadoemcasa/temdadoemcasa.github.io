// Emocao do pacote num tudo.jsonl: drafts com 2+ concretos, leques com tijolo+. Uso: node emocao.js <tudo.jsonl>
"use strict";
const L = require("fs").readFileSync(process.argv[2], "utf8").trim().split("\n").map(JSON.parse).filter((x) => x.emocao);
const pct = (a, b) => (100 * a / b).toFixed(1);
const lq = L.reduce((s, x) => s + x.emocao.leques, 0), lqT = L.reduce((s, x) => s + x.emocao.lequesTijolo, 0);
console.log(`drafts com 2+ concretos ${pct(L.filter((x) => x.emocao.concretos >= 2).length, L.length)}% · com 1+ ${pct(L.filter((x) => x.emocao.concretos >= 1).length, L.length)}% · leques com tijolo+ ${pct(lqT, lq)}% · concretos vistos por draft ${(L.reduce((s, x) => s + x.emocao.concretos, 0) / L.length).toFixed(1)}`);
