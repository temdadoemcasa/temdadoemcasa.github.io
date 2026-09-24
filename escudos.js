// Escudos GENERICOS dos clubes: forma, fundo, cores e um simbolo simples,
// desenhados aqui -- nunca o escudo original (decisao do dono, 24/09: marca
// dos clubes fica fora do site). A ficha de cada clube vem de
// dados/escudos.json; quem nao tem ficha sai do uniforme (listras viram
// listras) com a forma variando pelo nome, pra nao ficar tudo igual.
"use strict";
(function (raiz) {
  const Escudos = { fichas: {} };
  const HEXA = /^#[0-9a-f]{6}$/i;
  const cor = (c, reserva) => (typeof c === "string" && HEXA.test(c) ? c : reserva);

  // viewBox 0 0 24 28 (o mesmo do escudo antigo)
  const FORMAS = {
    classico: "M12 1.5 22 4.5v9.5c0 6.3-4.3 10.5-10 12.5C6.3 24.5 2 20.3 2 14V4.5z",
    redondo: "M12 3.5a10.5 10.5 0 1 1 0 21a10.5 10.5 0 1 1 0-21z",
    frances: "M2 2h20v11c0 7-4.6 11.4-10 13.5C6.6 24.4 2 20 2 13z",
    espanhol: "M2.5 2h19v14a9.5 9.5 0 0 1-19 0z",
    pontudo: "M2 2h20v7.5L12 26.5 2 9.5z",
    oval: "M12 1.8c5.3 0 9.5 5.4 9.5 12.2S17.3 26.2 12 26.2 2.5 20.8 2.5 14 6.7 1.8 12 1.8z",
    ingles: "M2 3.2q5-2.4 10 0 5-2.4 10 0V14c0 6.3-4.3 10.5-10 12.5C6.3 24.5 2 20.3 2 14z",
  };
  // o pontudo so por ficha: sorteado em clube sem ficha ficava estranho
  const ORDEM_FORMAS = ["classico", "frances", "redondo", "espanhol", "ingles", "oval"];
  const LISTRADOS = new Set(["listras-v", "listras-h", "listras-d", "tricolor", "metades-v", "quartos", "losangos", "diagonal"]);

  function hash(s) {
    let h = 2166136261;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function lum(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contraste = (fundo) => (lum(fundo) > 0.42 ? "#111111" : "#ffffff");

  // --- fundos (dentro do clip da forma) -----------------------------------------
  function fundo(f, cores, n) {
    const [a, b = contraste(a), c] = cores;
    const lista = cores.length ? cores : [a, b];
    const alterna = (i) => lista[i % lista.length];
    switch (f) {
      case "listras-v": {
        const k = n || (lista.length === 3 ? 3 : 5), w = 24 / k;
        return Array.from({ length: k }, (_, i) => `<rect x="${(i * w).toFixed(2)}" y="0" width="${(w + 0.05).toFixed(2)}" height="28" fill="${alterna(i)}"/>`).join("");
      }
      case "listras-h": {
        const k = n || 5, h = 28 / k;
        return Array.from({ length: k }, (_, i) => `<rect x="0" y="${(i * h).toFixed(2)}" width="24" height="${(h + 0.05).toFixed(2)}" fill="${alterna(i)}"/>`).join("");
      }
      case "listras-d": {
        const k = n || 6, passo = 48 / k;
        let s = `<rect width="24" height="28" fill="${a}"/>`;
        for (let i = 1; i < k; i += 2) s += `<polygon points="${-14 + i * passo},0 ${-14 + (i + 1) * passo},0 ${-14 + (i + 1) * passo + 14},28 ${-14 + i * passo + 14},28" fill="${b}"/>`;
        return s;
      }
      case "diagonal":
        return `<rect width="24" height="28" fill="${a}"/><polygon points="-2,6 5,-1 26,21 19,28" fill="${b}"/>`;
      case "metades-v":
        return `<rect width="12" height="28" fill="${a}"/><rect x="12" width="12" height="28" fill="${b}"/>`;
      case "metades-h":
        return `<rect width="24" height="14" fill="${a}"/><rect y="14" width="24" height="14" fill="${b}"/>`;
      case "quartos":
        return `<rect width="12" height="14" fill="${a}"/><rect x="12" width="12" height="14" fill="${b}"/><rect y="14" width="12" height="14" fill="${b}"/><rect x="12" y="14" width="12" height="14" fill="${a}"/>`;
      case "faixa-h":
        return `<rect width="24" height="28" fill="${a}"/><rect y="10.5" width="24" height="7" fill="${b}"/>`;
      case "faixa-v":
        return `<rect width="24" height="28" fill="${a}"/><rect x="8.5" width="7" height="28" fill="${b}"/>`;
      case "cruz":
        return `<rect width="24" height="28" fill="${a}"/><rect x="9.5" width="5" height="28" fill="${b}"/><rect y="11.5" width="24" height="5" fill="${b}"/>`;
      case "losangos": {
        let s = `<rect width="24" height="28" fill="${b}"/>`;
        for (let y = -2; y < 30; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 26; x += 4) s += `<polygon points="${x},${y - 2} ${x + 2},${y} ${x},${y + 2} ${x - 2},${y}" fill="${a}"/>`;
        return s;
      }
      case "tricolor":
        return `<rect width="8" height="28" fill="${a}"/><rect x="8" width="8" height="28" fill="${b}"/><rect x="16" width="8" height="28" fill="${c || a}"/>`;
      default:
        return `<rect width="24" height="28" fill="${a}"/>`;
    }
  }

  // --- simbolos ---------------------------------------------------------------
  function estrela(cx, cy, r, fill) {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const ang = (-90 + i * 36) * Math.PI / 180, rr = i % 2 ? r * 0.42 : r;
      p.push(`${(cx + rr * Math.cos(ang)).toFixed(2)},${(cy + rr * Math.sin(ang)).toFixed(2)}`);
    }
    return `<polygon points="${p.join(" ")}" fill="${fill}"/>`;
  }
  function simbolo(nome, fill, { centro = false, qtd = 1 } = {}) {
    const cy = centro ? 13.5 : 6.2;
    switch (nome) {
      case "estrela": return estrela(12, cy, centro ? 5.4 : 2.1, fill);
      case "estrelas": {
        const k = Math.max(1, Math.min(5, qtd)), passo = 3.4, x0 = 12 - ((k - 1) * passo) / 2;
        return Array.from({ length: k }, (_, i) => estrela(x0 + i * passo, 6, 1.4, fill)).join("");
      }
      case "cruzeiro": // o Cruzeiro do Sul: cinco estrelas em cruz
        return [[12, 7.5, 1.9], [12, 19.5, 2.1], [7.2, 13.2, 1.7], [16.6, 12.4, 1.8], [14.2, 16.8, 1.1]].map(([x, y, r]) => estrela(x, y, r, fill)).join("");
      case "coroa":
        return `<path d="M7.5 7.6 8.2 3.6l2.2 2.2L12 3l1.6 2.8 2.2-2.2.7 4z" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="0.3"/>`;
      case "cruz-malta":
        return `<path d="M12 9.2l1.6 3.1 3.1-1.6-1.6 3.1 1.6 3.1-3.1-1.6L12 18.4l-1.6-3.1-3.1 1.6 1.6-3.1-1.6-3.1 3.1 1.6z" fill="${fill}"/>`;
      case "ancora":
        return `<g fill="none" stroke="${fill}" stroke-width="1.3" stroke-linecap="round"><circle cx="12" cy="8.3" r="1.3"/><path d="M12 9.6v10"/><path d="M8.8 12.2h6.4"/><path d="M7.4 16.6q.6 3.4 4.6 3.4t4.6-3.4"/></g>`;
      case "bola":
        return `<circle cx="12" cy="${centro ? 14 : 20.5}" r="${centro ? 4.2 : 2.4}" fill="#ffffff" stroke="#111111" stroke-width="0.5"/><polygon points="12,${(centro ? 14 : 20.5) - 1.3} 13.2,${(centro ? 14 : 20.5) - 0.4} 12.8,${(centro ? 14 : 20.5) + 1} 11.2,${(centro ? 14 : 20.5) + 1} 10.8,${(centro ? 14 : 20.5) - 0.4}" fill="#111111"/>`;
      default: return "";
    }
  }

  // --- ficha que falta: sai do uniforme -------------------------------------------
  function fichaDoUniforme(nome, kit) {
    const k = kit || {};
    const faixas = (k.faixas || []).map(([c]) => c).filter((c) => HEXA.test(c));
    const base = cor(k.base, faixas[0] || "#30363d");
    const segunda = cor(k.faixa, faixas.find((c) => c.toLowerCase() !== base.toLowerCase()) || cor(k.numero, contraste(base)));
    const forma = ORDEM_FORMAS[hash(nome) % ORDEM_FORMAS.length];
    const f = { forma, cores: [base, segunda] };
    if (k.padrao === "vertical" && faixas.length >= 2) { f.fundo = "listras-v"; f.cores = [...new Set(faixas)]; }
    else if (k.padrao === "horizontal" && faixas.length >= 2) { f.fundo = "listras-h"; f.cores = [...new Set(faixas)]; }
    else if (k.padrao === "faixa-peito") f.fundo = "faixa-h";
    else if (k.padrao === "diagonal") f.fundo = "diagonal";
    else { f.fundo = "liso"; f.aro = hash(nome) % 2 ? segunda : null; }
    return f;
  }

  let seq = 0;
  // svg de um escudo. `sigla` e so o fallback: a ficha pode trazer a dela.
  Escudos.svg = function (nome, { kit = null, sigla = "" } = {}) {
    const f = { ...(Escudos.fichas[nome] || fichaDoUniforme(nome, kit)) };
    const cores = (f.cores || []).map((c) => cor(c, null)).filter(Boolean);
    if (!cores.length) cores.push("#30363d");
    const forma = FORMAS[f.forma] ? f.forma : "classico";
    const id = `esc${++seq}`;
    const principal = cores[0];
    const segunda = cores[1] || contraste(principal);
    const borda = cor(f.borda, segunda);
    const aro = cor(f.aro, null);
    // sigla em cima de listra nao se le: ganha uma placa na cor principal
    const placa = !cor(f.chefe, null) && LISTRADOS.has(f.fundo);
    const corPlaca = placa ? (lum(principal) > 0.42 && cores.some((c) => lum(c) < 0.2) ? cores.find((c) => lum(c) < 0.2) : principal) : null;
    // metades-h: a sigla fica na metade de BAIXO
    const atras = cor(f.chefe, null) || (f.fundo === "metades-h" ? segunda : principal);
    const texto = placa ? contraste(corPlaca) : cor(f.texto, contraste(atras));
    const s = f.sigla !== undefined ? String(f.sigla) : sigla;
    let corpo = fundo(f.fundo || "liso", cores, f.n);
    // chefe: a faixa de cima (Santos, Sao Paulo...), onde a sigla mora
    if (cor(f.chefe, null)) corpo += `<rect width="24" height="9.2" fill="${f.chefe}"/><rect y="9.2" width="24" height="0.6" fill="${borda}" opacity="0.8"/>`;
    const centro = f.posicao === "centro" || (!s && f.simbolo && f.simbolo !== "estrelas" && f.simbolo !== "coroa");
    const corSimbolo = cor(f.corSimbolo, f.chefe ? texto : segunda);
    const sim = f.simbolo ? simbolo(f.simbolo, corSimbolo, { centro, qtd: f.estrelas || 1 }) : "";
    // sigla: no chefe, se houver; senao no meio. Contorno escuro garante leitura em cima de listra
    const tam = s.length > 3 ? 5.2 : s.length > 2 ? 6.6 : s.length > 1 ? 8 : 11;
    const ySigla = cor(f.chefe, null) ? 7.4 : centro && sim ? 22.5 : f.simbolo === "estrelas" || f.simbolo === "coroa" || (f.simbolo && !centro) ? 16.6 : 16.2;
    const fonte = cor(f.chefe, null) ? Math.min(tam, 6.4) : placa ? Math.min(tam, 6.2) : tam;
    const larguraPlaca = Math.min(19, Math.max(8, s.length * fonte * 0.52 + 3));
    const fundoSigla = placa && s ? `<rect x="${(12 - larguraPlaca / 2).toFixed(2)}" y="${(ySigla - fonte * 0.82 - 0.9).toFixed(2)}" width="${larguraPlaca.toFixed(2)}" height="${(fonte * 0.82 + 2.2).toFixed(2)}" rx="1.2" fill="${corPlaca}" stroke="${borda}" stroke-width="0.6"/>` : "";
    // contorno so para texto claro (sombra escura); texto escuro com halo branco borrava
    const halo = lum(texto) > 0.5 && !placa ? ` stroke="rgba(0,0,0,.45)" stroke-width="0.6" paint-order="stroke"` : "";
    const legenda = s ? `${fundoSigla}<text x="12" y="${ySigla}" text-anchor="middle" font-family="'Barlow Condensed', 'Arial Narrow', sans-serif" font-weight="800" font-size="${fonte}" fill="${texto}"${halo} letter-spacing="0.2">${s.replace(/[<&>"]/g, "")}</text>` : "";
    const anel = aro ? `<path d="${FORMAS[forma]}" fill="none" stroke="${aro}" stroke-width="3.6" clip-path="url(#${id})"/>` : "";
    return `<svg viewBox="0 0 24 28" aria-hidden="true"><defs><clipPath id="${id}"><path d="${FORMAS[forma]}"/></clipPath></defs>`
      + `<g clip-path="url(#${id})">${corpo}</g>${anel}${sim}${legenda}`
      + `<path d="${FORMAS[forma]}" fill="none" stroke="${borda}" stroke-width="1.3"/></svg>`;
  };

  Escudos.carregar = async function (url = "dados/escudos.json") {
    try {
      const r = await fetch(url);
      if (r.ok) { const d = await r.json(); delete d._leia; Escudos.fichas = d; }
    } catch (_) { /* sem ficha: tudo sai do uniforme */ }
  };

  raiz.Escudos = Escudos;
})(typeof window !== "undefined" ? window : globalThis);
