// DOM falso, o bastante pra rodar as telas do draft.js no node (sem jsdom):
// elementos com filhos, classes, atributos, eventos e querySelector por classe.
"use strict";
class ElFalso {
  constructor(tag = "div", id = null) {
    this.tagName = String(tag).toUpperCase(); this.id = id; this.children = []; this.parentElement = null;
    this._texto = ""; this.className = ""; this.dataset = {}; this.attrs = {}; this.ouvintes = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.hidden = false; this.disabled = false; this.value = ""; this.options = []; this.offsetWidth = 100;
    const el = this;
    this.classList = {
      _lista: () => el.className.split(/\s+/).filter(Boolean),
      add(...c) { el.className = [...new Set([...this._lista(), ...c])].join(" "); },
      remove(...c) { el.className = this._lista().filter((x) => !c.includes(x)).join(" "); },
      toggle(c, f) { const tem = this._lista().includes(c); const quer = f === undefined ? !tem : f; if (quer) this.add(c); else this.remove(c); return quer; },
      contains(c) { return this._lista().includes(c); },
    };
  }
  get textContent() { return this._texto + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this._texto = String(v); this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  _pega(n) { if (typeof n === "string") { const t = new ElFalso("#text"); t._texto = n; return t; } if (n.parentElement) n.remove(); n.parentElement = this; return n; }
  append(...ns) { for (const n of ns) this.children.push(this._pega(n)); }
  appendChild(n) { this.append(n); return n; }
  prepend(...ns) { this.children.unshift(...ns.map((n) => this._pega(n))); }
  replaceChildren(...ns) { for (const c of this.children) c.parentElement = null; this.children = []; this._texto = ""; this.append(...ns); }
  remove() { const p = this.parentElement; if (p) { p.children = p.children.filter((c) => c !== this); this.parentElement = null; } }
  after(...ns) { const p = this.parentElement; if (!p) return; const i = p.children.indexOf(this); p.children.splice(i + 1, 0, ...ns.map((n) => p._pega(n))); }
  before(...ns) { const p = this.parentElement; if (!p) return; const i = p.children.indexOf(this); p.children.splice(i, 0, ...ns.map((n) => p._pega(n))); }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  _casa(sel) {
    return sel.split(",").map((x) => x.trim()).some((x) => {
      if (x.startsWith("#")) return this.id === x.slice(1);
      const partes = x.split(".").filter(Boolean);
      const tag = x.startsWith(".") ? null : partes.shift();
      return (!tag || this.tagName === tag.toUpperCase()) && partes.every((c) => this.classList.contains(c));
    });
  }
  querySelectorAll(sel) {
    const alvo = sel.trim().split(/\s+/).pop(); // so o ultimo seletor (descendente) importa aqui
    const r = [];
    const anda = (e) => { for (const c of e.children) { if (c._casa(alvo)) r.push(c); anda(c); } };
    anda(this);
    return r;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let e = this; while (e) { if (e._casa && e._casa(sel)) return e; e = e.parentElement; } return null; }
  addEventListener(tipo, f) { (this.ouvintes[tipo] ||= []).push(f); }
  dispatchEvent(ev) { for (const f of this.ouvintes[ev.type] || []) f(ev); return true; }
  click() { if (this.disabled) return; this.dispatchEvent({ type: "click", target: this }); }
  getBoundingClientRect() { return { top: 100, left: 0, width: 100, height: 100 }; }
  scrollIntoView() {} focus() {} blur() {}
}
const FORA = new Set(["ficha", "lista-videos", "elenco"]);
function domFalso() {
  const porId = new Map(), porSel = new Map();
  const document = {
    body: new ElFalso("body"),
    documentElement: new ElFalso("html"),
    // pedacos das outras paginas (o app.js liga se existirem): aqui nao existem
    getElementById(id) { if (FORA.has(id)) return null; if (!porId.has(id)) porId.set(id, new ElFalso("div", id)); return porId.get(id); },
    querySelector(sel) { if (sel.startsWith("#") && !sel.includes(" ")) return document.getElementById(sel.slice(1)); if (!porSel.has(sel)) porSel.set(sel, new ElFalso("div")); return porSel.get(sel); },
    querySelectorAll() { return []; },
    createElement: (t) => new ElFalso(t),
    createElementNS: (_, t) => new ElFalso(t),
    createTextNode: (t) => { const e = new ElFalso("#text"); e._texto = String(t); return e; },
    addEventListener() {},
  };
  class Option extends ElFalso { constructor(texto, valor, _d, sel) { super("option"); this._texto = texto; this.value = valor; this.selected = Boolean(sel); } }
  return {
    document, Option, Event: class { constructor(type) { this.type = type; } },
    window: "self", scrollTo() {}, innerHeight: 800,
    matchMedia: (q) => ({ matches: /reduce/.test(q) }), // movimento reduzido: sem animacao
    navigator: { clipboard: { writeText: async () => {} } },
  };
}
module.exports = { domFalso, ElFalso };
