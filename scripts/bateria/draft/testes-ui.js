// Testa, na copia REPO_DIR, as correcoes de UI de draft.js com stubs de DOM
process.env.REPO_DIR = process.env.REPO_DIR || require("path").resolve(__dirname, "../../..");
const { carregar } = require("./carregar.js");
const vm = require("vm");
const A = carregar(); const { D, ESQUEMAS, Motor } = A; const ctx = A.ctx;
let ok = 0, falhas = 0; const conf = (c, msg) => { if (c) ok++; else { falhas++; console.log("FALHOU:", msg); } };
// 1) id interno: nome de convidado nao colide
A.semear(3); D.nome = "Fortaleza"; D.sai = "Chapecoense"; D.continental = "lib"; D.esquema = "4-3-3";
D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y], i) => ({ pos, x, y, jogador: A.r.indice.comNota[i] }));
const serieA = A.serieAComUsuario(); const eu = Object.values(serieA).find((t) => t.usuario);
D.regrasTemp = A.regrasComUsuario(eu.id);
const times = { ...serieA, ...Motor.timesDeFora(D.regrasTemp) };
conf(times[eu.id].usuario === true && times[eu.id].nome === "Fortaleza" && times.Fortaleza && !times.Fortaleza.usuario, "id do usuario colide com o convidado Fortaleza");
// 2) escolher: trava de toque duplo e draft completo (stub de abrirLeque/mostrarResumo)
vm.runInContext(`abrirLeque = () => { D.leques[D.vaga] = sortearLeque(D.onze[D.vaga].pos); }; mostrarResumo = () => { globalThis.__resumo = (globalThis.__resumo || 0) + 1; };
  globalThis.__agora = 0; performance.now = () => globalThis.__agora;`, ctx);
const esc = (j) => vm.runInContext("escolher", ctx)(j);
D.onze = ESQUEMAS["4-3-3"].map(([pos, x, y]) => ({ pos, x, y, jogador: null })); D.vaga = 0; D.leques = {};
vm.runInContext("abrirLeque()", ctx);
ctx.__agora = 1000; esc(D.leques[0][0]); conf(D.vaga === 1, "1a escolha nao andou");
vm.runInContext("abrirLeque()", ctx);
ctx.__agora = 1100; esc(D.leques[1][0]); conf(D.vaga === 1 && !D.onze[1].jogador, "toque duplo em 100 ms escolheu a vaga seguinte");
ctx.__agora = 1400; esc(D.leques[1][0]); conf(D.vaga === 2, "escolha depois da trava nao andou");
const fora = A.r.indice.comNota.find((j) => !D.leques[2] || !D.leques[2].includes(j));
vm.runInContext("abrirLeque()", ctx); ctx.__agora = 2000; esc(fora); conf(D.vaga === 2, "aceitou carta que nao e do leque");
for (let k = 0; k < 20 && D.vaga >= 0; k++) { vm.runInContext("abrirLeque()", ctx); ctx.__agora += 400; esc(D.leques[D.vaga][0]); }
conf(D.vaga < 0 && ctx.__resumo === 1, "draft nao completou");
ctx.__agora += 400; esc(A.r.indice.comNota[50]); conf(ctx.__resumo === 1, "clique com draft completo fez algo");
// 3) situacao do BR antes da 1a rodada; 4) cobradores de estrangeiro e expulso fora da fila
D.times = times;
D.temp = Motor.criarTemporada({ regras: D.regrasTemp, times, serieA: Object.keys(serieA), usuario: eu.id, semente: 7 });
const situacao = vm.runInContext("situacao", ctx);
conf(situacao("bra") === "—", "BR antes da 1a rodada: " + situacao("bra"));
while (D.temp.bra.rodada === 0) Motor.avancar(D.temp);
conf(/º · \d+ pts · 1\/38/.test(situacao("bra")), "BR depois da 1a rodada: " + situacao("bra"));
const cobradores = vm.runInContext("cobradores", ctx);
const est = cobradores("Boca Juniors"); conf(!est[0].startsWith("cobrador") && est.length >= 5, "Boca sem nomes: " + est.slice(0, 3));
const semElenco = { ...times.Fortaleza }; D.times.__X = { id: "__X", nome: "X", artilheiros: [] }; conf(cobradores("__X")[0] === "cobrador 1", "fallback generico");
const lista = cobradores("Flamengo"); const sem = cobradores("Flamengo", new Set([lista[0]])); conf(!sem.includes(lista[0]), "expulso continua na fila");
console.log("exemplo Boca:", est.slice(0, 5).join(", "));
console.log(`testes de UI: ${ok} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
