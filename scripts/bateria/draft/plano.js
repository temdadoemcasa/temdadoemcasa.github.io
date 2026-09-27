// Gera o plano da bateria (fase 2): 5.000 tentativas em ordem fixa (reprodutivel)
// Uso: node plano.js <saida.json>
const fs = require("fs");
const ESQ = ["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "3-5-2", "3-4-3", "5-3-2", "3-4-2-1"];
const p = [];
const cont = (k) => (k % 2 ? "sul" : "lib");
const bloco = (nome, n, extra) => { for (let k = 0; k < n; k++) p.push({ bloco: nome, esquema: ESQ[k % ESQ.length], continental: cont(k), dificuldade: "normal", decisao: "padrao", ...extra(k) }); };
bloco("A_aleatorio", 800, () => ({ politica: "aleatorio" }));
bloco("B_melhor", 1000, () => ({ politica: "melhor" }));
bloco("C_pior", 400, () => ({ politica: "pior" }));
bloco("S_inteligente", 900, () => ({ politica: "inteligente" }));
bloco("H_humano", 200, () => ({ politica: "humano" }));
// decisoes na temporada: pares com o mesmo draft (mesma semente de draft via "par")
bloco("T_padrao", 400, () => ({ politica: "humano", decisao: "padrao" }));
bloco("T_bom", 400, () => ({ politica: "humano", decisao: "bom" }));
for (const dif of ["facil", "dificil"]) for (const pol of ["aleatorio", "melhor"]) bloco(`F_${dif}_${pol}`, 225, () => ({ politica: pol, dificuldade: dif }));
// T_bom k usa a mesma semente de T_padrao k (mesmo draft, mesmo sorteio): comparacao pareada
const padrao = p.map((x, i) => [x, i]).filter(([x]) => x.bloco === "T_padrao").map(([, i]) => i);
let kb = 0;
for (const x of p) if (x.bloco === "T_bom") x.par = padrao[kb++];
fs.writeFileSync(process.argv[2] || "plano.json", JSON.stringify(p));
console.log(p.length);
