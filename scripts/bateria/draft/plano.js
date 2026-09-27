// Gera plano.json: 5.000 tentativas (ordem fixa -> reprodutivel)
const fs = require("fs");
const ESQ = ["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "3-5-2", "3-4-3", "5-3-2"];
const SERIE_A = ["Athletico","Atlético-MG","Bahia","Botafogo","Chapecoense","Corinthians","Coritiba","Cruzeiro","Flamengo","Fluminense","Grêmio","Internacional","Mirassol","Palmeiras","RB Bragantino","Remo","Santos","São Paulo","Vasco","Vitória"];
const p = [];
const cont = (k) => (k % 2 ? "sul" : "lib");
for (let k = 0; k < 1000; k++) p.push({ bloco: "A_aleatorio", politica: "aleatorio", esquema: ESQ[k % 7], continental: cont(k) });
for (const e of ESQ) for (let k = 0; k < 250; k++) p.push({ bloco: "B_melhor", politica: "melhor", esquema: e, continental: cont(k) });
for (const e of ESQ) for (let k = 0; k < 100; k++) p.push({ bloco: "C_pior", politica: "pior", esquema: e, continental: cont(k) });
for (let k = 0; k < 300; k++) p.push({ bloco: "D_melhor_troca", politica: "melhor", troca: true, esquema: ESQ[k % 7], continental: cont(k) });
for (let k = 0; k < 250; k++) p.push({ bloco: "E_humano", politica: "humano", esquema: ESQ[k % 7], continental: cont(k) });
for (const s of SERIE_A) for (let k = 0; k < 50; k++) p.push({ bloco: "F_sai", politica: k < 25 ? "aleatorio" : "melhor", esquema: ESQ[k % 7], continental: cont(k), sai: s });
fs.writeFileSync(process.argv[2] || "plano.json", JSON.stringify(p));
console.log(p.length);
