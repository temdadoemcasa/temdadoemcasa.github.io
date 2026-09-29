// Ambiente minimo de navegador pra rodar o Prata da Casa em Node (sem jsdom).
// - DOM falso: todo elemento aceita qualquer propriedade/metodo (Proxy) e
//   registra os textos que o jogo mostraria (textContent, createTextNode,
//   title, aria-label) em TEXTOS, pra caca de placeholder quebrado.
// - Math.random deterministico (mulberry32) com estado salvavel.
// - fetch le do disco do repo (somente leitura).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO = process.env.REPO || path.resolve(__dirname, "../../..");

function criarPrng(semente) {
  const st = { a: semente >>> 0 };
  const f = () => {
    st.a = (st.a + 0x6d2b79f5) >>> 0;
    let t = st.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.estado = () => st.a;
  f.restaurar = (a) => { st.a = a; };
  f.semear = (s) => { st.a = s >>> 0; };
  return f;
}

const TEXTOS = { ligado: false, lista: [] };
const registrar = (origem, v) => { if (TEXTOS.ligado) TEXTOS.lista.push([origem, v]); };

function elementoFalso(tag = "div") {
  const alvo = {
    tagName: String(tag).toUpperCase(), children: [], childNodes: [], style: { setProperty() {} }, dataset: {},
    _texto: "", value: "", attrs: {}, hidden: false, disabled: false, className: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    append(...xs) { for (const x of xs) { if (typeof x === "string") registrar("append", x); this.children.push(x); } },
    prepend(...xs) { this.append(...xs); },
    replaceChildren(...xs) { this.children = []; this.append(...xs); },
    replaceWith() {}, remove() {}, after() {}, before() {},
    setAttribute(k, v) { this.attrs[k] = v; if (k === "aria-label") registrar("aria", String(v)); },
    getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return elementoFalso(); }, querySelectorAll() { return []; },
    closest() { return null; }, getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    scrollTo() {}, focus() {}, animate() { return { finished: Promise.resolve() }; },
    get firstChild() { return this.children[0] || null; },
    get childElementCount() { return this.children.length; },
    get textContent() { return this._texto; },
    set textContent(v) { this._texto = v; registrar("text", v); },
    get title() { return this._title || ""; }, set title(v) { this._title = v; registrar("title", v); },
    offsetWidth: 0, offsetHeight: 0, offsetTop: 0, scrollHeight: 0, clientHeight: 0, scrollTop: 0,
  };
  return new Proxy(alvo, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === "symbol") return undefined;
      return () => elementoFalso();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function criarContexto(prng) {
  const porId = new Map();
  const idsDaPagina = new Set([...fs.readFileSync(path.join(REPO, "prata-da-casa.html"), "utf8").matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const document = {
    getElementById(id) { if (!idsDaPagina.has(id)) return null; if (!porId.has(id)) porId.set(id, elementoFalso("div")); return porId.get(id); },
    createElement: (t) => elementoFalso(t),
    createElementNS: (_, t) => elementoFalso(t),
    createTextNode: (s) => { registrar("node", s); const e = elementoFalso("#text"); e._texto = s; return e; },
    querySelector: () => elementoFalso(), querySelectorAll: () => [],
    documentElement: elementoFalso("html"), body: elementoFalso("body"),
    addEventListener() {},
  };
  const mathDet = Object.create(Math);
  mathDet.random = prng;
  const ctx = {
    console, document, setTimeout, clearTimeout, structuredClone, Promise, Intl, performance,
    Math: mathDet,
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    localStorage: { getItem() { return null; }, setItem() {} },
    location: { hash: "", href: "" }, navigator: { clipboard: { writeText: async () => {} } },
    requestAnimationFrame: () => 0, scrollTo() {},
    fetch: async (url) => {
      const limpo = String(url).split("?")[0];
      const arq = path.join(REPO, limpo);
      if (!fs.existsSync(arq)) return { ok: false, status: 404, json: async () => ({}) };
      const txt = fs.readFileSync(arq, "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt };
    },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  return ctx;
}

async function carregarJogo(semente = 1) {
  const prng = criarPrng(semente);
  const ctx = criarContexto(prng);
  for (const f of ["app.js", "motor.js", "historia.js", "escudos.js", "carreira.js"]) {
    const codigo = fs.readFileSync(path.join(REPO, f), "utf8");
    vm.runInContext(codigo, ctx, { filename: f });
  }
  // espera o iniciarCarreiraPagina() terminar (dados carregados)
  for (let i = 0; i < 400; i++) {
    const pronto = vm.runInContext("typeof C !== 'undefined' && !!C.nivelDeForca && !!C.inferiores", ctx);
    if (pronto) break;
    await new Promise((ok) => setTimeout(ok, 25));
  }
  return { ctx, prng };
}

module.exports = { carregarJogo, criarPrng, TEXTOS, REPO };
