// Carrega app.js + motor.js + draft.js REAIS (sem copiar) num contexto vm do node,
// com DOM minimo stubado. Unica alteracao, em memoria: remove a chamada final
// `iniciarDraft().catch(...)` de draft.js (ela depende de fetch e DOM).
// Math.random do contexto e trocado por um PRNG com semente (mulberry32).
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
// REPO_DIR permite apontar pra uma copia (ex.: antes/depois das correcoes); padrao: o repo ao lado (../../..)
const REPO = process.env.REPO_DIR || path.resolve(__dirname, "../../..");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function carregar() {
  const nulo = () => null;
  const ctx = {
    console, structuredClone, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
    document: { getElementById: nulo, querySelector: nulo, querySelectorAll: () => [], addEventListener() {}, body: { classList: { toggle() {} } } },
    window: undefined, location: { hash: "" }, requestAnimationFrame: (f) => setTimeout(f, 0),
    performance: { now: () => Date.now() },
  };
  vm.createContext(ctx);
  const ler = (f) => fs.readFileSync(path.join(REPO, f), "utf8");
  vm.runInContext(ler("app.js"), ctx, { filename: "app.js" });
  // experimentos de balanceamento: PATCH_MOTOR='[["de","para"],...]' troca texto SO na copia em memoria
  let motor = ler("motor.js");
  for (const [de, para] of JSON.parse(process.env.PATCH_MOTOR || "[]")) {
    if (!motor.includes(de)) throw new Error("patch nao casou: " + de);
    motor = motor.replace(de, para);
  }
  vm.runInContext(motor, ctx, { filename: "motor.js" });
  let draft = ler("draft.js");
  const corte = draft.lastIndexOf("iniciarDraft().catch(");
  if (corte < 0) throw new Error("nao achei iniciarDraft() em draft.js");
  draft = draft.slice(0, corte);
  for (const [de, para] of JSON.parse(process.env.PATCH_DRAFT || "[]")) {
    if (!draft.includes(de)) throw new Error("patch nao casou: " + de);
    draft = draft.replace(de, para);
  }
  vm.runInContext(draft, ctx, { filename: "draft.js" });
  // expoe o que o harness usa (consts de script nao viram propriedade do global)
  // o que existir nesta versao do draft.js (a da fase 1 nao tem as funcoes da fase 2)
  const nomes = ["D", "ESQUEMAS", "VAGAS", "CHANCES_DO_LEQUE", "NIVEIS", "nivel", "indexar", "usarCortes", "inferirFuncoes",
    "sortearLeque", "proximaVaga", "definirQuemSai", "serieAComUsuario", "timeDoUsuario", "regrasComUsuario", "idUsuario", "estado",
    "FUNCAO", "FUNCOES_EXTRAS", "funcoesDe", "cabeNaVaga", "Motor", "TIME_DE", "FAMILIA",
    "BANCO_VAGAS", "DIFICULDADES", "ESQUEMAS_TTC", "POSTURAS", "ENCAIXE", "ENTROSAMENTO", "todasVagas", "lequeAtual", "lequeDaVaga",
    "encaixeNaVaga", "valorNaVaga", "entrosamento", "forcaDoElenco", "ajusteDeContexto", "timesCpu", "montarTemporada",
    "decisivaParaUsuario", "contextoDecisivo", "escalarNoEsquema", "trocarEsquema", "janelaAberta", "lequeDaJanela", "aplicarJanela",
    "simularTemporadaRapida", "hashTexto", "avaliacaoNaVaga", "garotoDaBase", "calib"];
  vm.runInContext(`globalThis.__ = {}; for (const n of ${JSON.stringify(nomes)}) { try { globalThis.__[n] = eval(n); } catch (_) {} }`, ctx);
  vm.runInContext(`
globalThis.__semear = (f) => { Math.random = f; };`, ctx);
  const api = ctx.__;
  const json = (f) => JSON.parse(ler(f));
  const r = api.indexar(json("dados/overalls-2026.json"));
  api.usarCortes(r);
  api.inferirFuncoes(r);
  api.Motor.ELENCOS = json("dados/elencos-fora.json").times || {};
  api.D.r = r;
  api.D.regras = json("dados/competicoes-2026.json");
  // experimentos: PATCH_CALIB='{"K":22}' mexe so na calibragem carregada
  if (api.D.regras.motor_ttc) Object.assign(api.D.regras.motor_ttc, JSON.parse(process.env.PATCH_CALIB || "{}"));
  api.estado.r = r;
  api.definirQuemSai();
  // o MESMO gerador serve ao contexto (draft.js) e ao harness (api.random): tudo reprodutivel
  api.semear = (seed) => { const f = mulberry32(seed); api.random = f; ctx.__semear(f); };
  api.ctx = ctx;
  api.r = r;
  return api;
}
module.exports = { carregar, mulberry32, REPO };
