// Motor de simulacao do Tem dado em casa. Sem DOM: roda no navegador (window.Motor)
// e no node (require), entao o mesmo codigo serve pro minigame e pro simulador
// de rebaixamento dos videos.
//
// Modelo de jogo: gols de cada lado ~ Poisson, com media que cresce quando o
// ataque de um e maior que a defesa do outro. Forca na escala dos overalls
// (~50 fraco, ~63 forte). Mandante tem vantagem; altitude, mais ainda.
"use strict";
(function (raiz) {
  const Motor = {};

  // --- aleatoriedade com semente (mesma semente = mesma temporada) ---------
  function rngDe(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(rng, media) {
    const limite = Math.exp(-media);
    let k = 0, p = 1;
    do { k += 1; p *= rng(); } while (p > limite);
    return k - 1;
  }
  function embaralhar(rng, lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function sortearPeso(rng, itens, peso) {
    const total = itens.reduce((s, x) => s + peso(x), 0);
    let r = rng() * total;
    for (const x of itens) { r -= peso(x); if (r <= 0) return x; }
    return itens[itens.length - 1];
  }
  Motor.rngDe = rngDe;
  Motor.embaralhar = embaralhar;
  Motor.sortearPeso = sortearPeso;

  // --- um jogo ---------------------------------------------------------------
  // Calibrado pelo Brasileirao recente: ~2,3 gols por jogo, 0x0 em ~8% dos
  // jogos e 6 gols ou mais so em ~2%. Mata-mata e mais travado.
  const K = 27;              // 27 pontos de diferenca ~ 2,7x mais gols esperados
  const MEDIA_CASA = 1.24;   // gols esperados do mandante entre times iguais
  const MEDIA_FORA = 0.96;
  const MEDIA_NEUTRO = 1.1;
  const FATOR_MATA = 0.86;   // jogo eliminatorio: ninguem quer tomar gol

  function medias(casa, fora, neutro) {
    let mc = (neutro ? MEDIA_NEUTRO : MEDIA_CASA) * Math.exp((casa.atq - fora.def) / K);
    let mf = (neutro ? MEDIA_NEUTRO : MEDIA_FORA) * Math.exp((fora.atq - casa.def) / K);
    if (!neutro && casa.altitude && !fora.altitude) { mc *= 1.25; mf *= 0.85; }
    return [mc, mf];
  }
  Motor.medias = medias;

  function sortearAutor(rng, time, pesoPos) {
    const lista = time.artilheiros || [];
    if (!lista.length) return null;
    return pesoPos ? sortearPeso(rng, lista, (a) => pesoPos[a.pos] ?? 1).nome : sortearPeso(rng, lista, (a) => a.peso).nome;
  }
  const PESO_CARTAO = { G: 0.15, D: 1.4, M: 1.2, F: 0.8 };
  const CHANCE_VERMELHO = 0.11;   // por time, por jogo
  const CHANCE_PEN_PERDIDO = 0.06; // por time, por jogo
  const FATIA_PENALTI = 0.12;      // parte dos gols que sai de penalti

  // Um jogo em trechos: cada expulsao abre um trecho novo em que quem ficou
  // com um a menos ataca 30% menos e o outro lado 20% mais.
  function jogar(rng, casa, fora, { neutro = false, mata = false } = {}) {
    let [mc, mf] = medias(casa, fora, neutro);
    if (mata) { mc *= FATOR_MATA; mf *= FATOR_MATA; }
    const eventos = [];
    for (const [lado, time] of [["casa", casa], ["fora", fora]]) {
      if (rng() < CHANCE_VERMELHO) {
        eventos.push({ tipo: "vermelho", lado, min: 10 + Math.floor(rng() * 80), autor: sortearAutor(rng, time, PESO_CARTAO) });
      }
      if (rng() < CHANCE_PEN_PERDIDO) {
        eventos.push({ tipo: "penalti_perdido", lado, min: 1 + Math.floor(rng() * 90), autor: sortearAutor(rng, time) });
      }
    }
    const cortes = [0, ...eventos.filter((e) => e.tipo === "vermelho").map((e) => e.min).sort((a, b) => a - b), 90];
    const placar = { casa: 0, fora: 0 };
    for (let k = 0; k < cortes.length - 1; k++) {
      const [a, b] = [cortes[k], cortes[k + 1]];
      if (b <= a) continue;
      const vermelhos = (l) => eventos.filter((e) => e.tipo === "vermelho" && e.lado === l && e.min <= a).length;
      const vc = vermelhos("casa"), vf = vermelhos("fora");
      const trecho = (b - a) / 90;
      const media = {
        casa: mc * trecho * Math.pow(0.7, vc) * Math.pow(1.2, vf),
        fora: mf * trecho * Math.pow(0.7, vf) * Math.pow(1.2, vc),
      };
      for (const lado of ["casa", "fora"]) {
        const n = poisson(rng, media[lado]);
        const time = lado === "casa" ? casa : fora;
        for (let g = 0; g < n; g++) {
          let min = a + 1 + Math.floor(rng() * (b - a));
          if (b === 90 && min >= 89 && rng() < 0.5) min = 90 + 1 + Math.floor(rng() * 5);
          const penalti = rng() < FATIA_PENALTI;
          eventos.push({ tipo: "gol", lado, min, autor: sortearAutor(rng, time), penalti });
          placar[lado] += 1;
        }
      }
    }
    eventos.sort((x, y) => x.min - y.min);
    return { gc: placar.casa, gf: placar.fora, eventos };
  }
  Motor.jogar = jogar;
  Motor.penaltis = (rng, a, b) => penaltis(rng, a, b);

  // Disputa de penaltis com a regra de verdade: 5 cobrancas alternadas (a
  // comeca), para quando um lado nao alcanca mais o outro, depois alternadas
  // ate um converter e o outro errar. Devolve [gols a, gols b] e, em
  // .cobrancas, a sequencia (lado "a"/"b" e se foi gol) pra animar uma a uma.
  function penaltis(rng, a, b) {
    const pa = 0.76 + (a.atq - b.def) / 400, pb = 0.76 + (b.atq - a.def) / 400;
    let ga = 0, gb = 0, ca = 0, cb = 0;
    const cobrancas = [];
    const chuta = (lado) => {
      const gol = rng() < (lado === "a" ? pa : pb);
      cobrancas.push({ lado, gol });
      if (lado === "a") { ca++; if (gol) ga++; } else { cb++; if (gol) gb++; }
    };
    for (let i = 0; i < 5; i++) {
      chuta("a");
      if (ga > gb + (5 - cb) || gb > ga + (5 - ca)) break;
      chuta("b");
      if (ga > gb + (5 - cb) || gb > ga + (5 - ca)) break;
    }
    while (ga === gb) { chuta("a"); chuta("b"); }
    const r = [ga, gb];
    r.cobrancas = cobrancas;
    return r;
  }

  // --- tabela de pontos corridos ------------------------------------------------
  function tabelaNova(ids) {
    const t = new Map();
    for (const id of ids) t.set(id, { id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 });
    return t;
  }
  function registrar(tabela, jogo) {
    const c = tabela.get(jogo.casa), f = tabela.get(jogo.fora);
    if (!c || !f) return;
    c.j++; f.j++;
    c.gp += jogo.gc; c.gc += jogo.gf; f.gp += jogo.gf; f.gc += jogo.gc;
    if (jogo.gc > jogo.gf) { c.v++; f.d++; c.pts += 3; }
    else if (jogo.gc < jogo.gf) { f.v++; c.d++; f.pts += 3; }
    else { c.e++; f.e++; c.pts++; f.pts++; }
  }
  // criterios do Brasileirao: pontos, vitorias, saldo, gols pro (depois, nome)
  function ordenar(tabela) {
    return [...tabela.values()].sort((a, b) =>
      b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || a.id.localeCompare(b.id, "pt-BR"));
  }
  Motor.ordenar = ordenar;

  // turno e returno pelo metodo do circulo; returno inverte o mando
  function rodadasTurnoReturno(rng, ids) {
    const times = embaralhar(rng, ids);
    if (times.length % 2) times.push(null);
    const n = times.length, turno = [];
    for (let r = 0; r < n - 1; r++) {
      const jogos = [];
      for (let i = 0; i < n / 2; i++) {
        const a = times[i], b = times[n - 1 - i];
        if (a && b) jogos.push(r % 2 ? { casa: b, fora: a } : { casa: a, fora: b });
      }
      turno.push(jogos);
      times.splice(1, 0, times.pop());
    }
    return [...turno, ...turno.map((js) => js.map((j) => ({ casa: j.fora, fora: j.casa })))];
  }

  // Rodadas no domingo, entre inicio e fim, pulando a pausa da Copa do Mundo.
  // Se o domingo ja tem jogo de copa, a rodada vai pro sabado.
  function datasSemanais(inicio, fim, pausa, n, ocupadas = new Set()) {
    const dia = 864e5;
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const [p0, p1] = pausa ? pausa.map((d) => Date.parse(d)) : [Infinity, -Infinity];
    let t = Date.parse(inicio);
    while (new Date(t).getUTCDay() !== 0) t += dia; // primeiro domingo
    const tFim = Date.parse(fim);
    const livres = [];
    for (; t <= tFim; t += 7 * dia) {
      if (t >= p0 && t <= p1) continue;
      livres.push(ocupadas.has(iso(t)) && !ocupadas.has(iso(t - dia)) ? t - dia : t);
    }
    // se sobrar domingo, espalha; se faltar, repete (rodada no meio de semana)
    const datas = [];
    for (let k = 0; k < n; k++) {
      const idx = Math.min(livres.length - 1, Math.round((k * (livres.length - 1)) / Math.max(1, n - 1)));
      datas.push(iso(livres[idx]));
    }
    return datas;
  }

  // --- a temporada ------------------------------------------------------------
  // times: { id: { id, nome, atq, def, altitude, artilheiros, ... } }
  // serieA: ids dos 20; usuario: id do clube que o jogador assumiu.
  Motor.criarTemporada = function ({ regras, times, serieA, usuario, semente }) {
    const rng = rngDe(semente ?? Date.now());
    const temp = {
      rng, times, usuario, semente, etapas: [], i: 0,
      bra: { tabela: tabelaNova(serieA), rodada: 0 },
      cdb: {}, lib: { grupos: {} }, sul: { grupos: {} },
      campeoes: {}, eliminado: {}, gols: new Map(), historico: [],
    };
    const E = (data, comp, rotulo, montar, depois, extra = {}) => temp.etapas.push({ data, comp, rotulo, montar, depois, ...extra });

    // Brasileirao: 38 rodadas
    const rb = regras.brasileirao;
    const rodadas = rodadasTurnoReturno(rng, serieA);
    const ocupadas = new Set();
    for (const chave of ["copa_do_brasil", "libertadores", "sulamericana"]) {
      const r = regras[chave];
      for (const f of r.fases) for (const d of [f.ida, f.volta, f.unica]) if (d) ocupadas.add(d);
      for (const d of r.rodadas_grupo || []) ocupadas.add(d);
    }
    const datasBra = datasSemanais(rb.inicio, rb.fim, rb.pausa_copa, rodadas.length, ocupadas);
    rodadas.forEach((jogos, r) => E(datasBra[r], "bra", `${rb.nome} · ${r + 1}ª rodada`, () => jogos,
      (js) => { js.forEach((j) => registrar(temp.bra.tabela, j)); temp.bra.rodada = r + 1;
        if (r === rodadas.length - 1) temp.campeoes.bra = ordenar(temp.bra.tabela)[0].id; }));

    // mata-mata ida e volta: "a" e o cabeca (decide em casa)
    const confrontosDuplos = (comp, fase, datas, obter, aoFim) => {
      let pares = [], ida = [];
      E(datas.ida, comp, `${regras[nomeRegra(comp)].nome} · ${fase} (ida)`,
        () => { pares = obter(); return pares.map(([a, b]) => ({ casa: b, fora: a })); },
        (js) => { ida = js; }, { mata: true, fase });
      E(datas.volta, comp, `${regras[nomeRegra(comp)].nome} · ${fase} (volta)`,
        () => pares.map(([a, b]) => ({ casa: a, fora: b })),
        (js) => {
          const vencedores = js.map((volta, k) => {
            const primeiro = ida[k];
            const [a, b] = pares[k];
            const golsA = volta.gc + primeiro.gf, golsB = volta.gf + primeiro.gc;
            volta.agregado = [golsA, golsB];
            let venc = golsA > golsB ? a : golsB > golsA ? b : null;
            if (!venc) {
              volta.penaltis = penaltis(rng, times[a], times[b]);
              venc = volta.penaltis[0] > volta.penaltis[1] ? a : b;
            }
            volta.classificado = venc;
            const perdeu = venc === a ? b : a;
            if (perdeu === usuario) temp.eliminado[comp] = fase;
            return venc;
          });
          aoFim(vencedores);
        }, { mata: true, fase });
    };
    const finalUnica = (comp, data, obter) => {
      let par;
      E(data, comp, `${regras[nomeRegra(comp)].nome} · Final`,
        () => { par = obter(); return [{ casa: par[0], fora: par[1], neutro: true }]; },
        ([j]) => {
          let venc = j.gc > j.gf ? par[0] : j.gf > j.gc ? par[1] : null;
          if (!venc) {
            j.penaltis = penaltis(rng, times[par[0]], times[par[1]]);
            venc = j.penaltis[0] > j.penaltis[1] ? par[0] : par[1];
          }
          j.classificado = venc;
          temp.campeoes[comp] = venc;
          const perdeu = venc === par[0] ? par[1] : par[0];
          if (perdeu === usuario) temp.eliminado[comp] = "Final";
        }, { mata: true, fase: "Final", final: true });
    };

    // Copa do Brasil: 5a fase com os 20 da Serie A + 12 que vieram das fases
    // iniciais; cada fase e sorteada de novo. Final em jogo unico.
    const rc = regras.copa_do_brasil;
    temp.cdb.vivos = [];
    rc.fases.forEach((f, idx) => {
      if (f.unica) {
        finalUnica("cdb", f.unica, () => temp.cdb.vivos);
        return;
      }
      confrontosDuplos("cdb", f.nome, f, () => {
        if (idx === 0) {
          // pote 1: Serie A; pote 2: quem veio de baixo. Quem vem de baixo
          // pega um da Serie A e faz o primeiro jogo em casa.
          const a = embaralhar(rng, serieA), baixo = embaralhar(rng, rc.convidados.map((c) => c.nome));
          const pares = baixo.map((b, k) => [a[k], b]);
          const resto = a.slice(baixo.length);
          for (let k = 0; k < resto.length; k += 2) pares.push([resto[k], resto[k + 1]]);
          return embaralhar(rng, pares);
        }
        const v = embaralhar(rng, temp.cdb.vivos), pares = [];
        for (let k = 0; k < v.length; k += 2) pares.push([v[k], v[k + 1]]);
        return pares;
      }, (vencedores) => { temp.cdb.vivos = vencedores; });
    });

    // Libertadores e Sul-Americana: grupos de 4, turno e returno
    const faseDeGrupos = (comp) => {
      const r = regras[nomeRegra(comp)], estado = temp[comp];
      for (const [letra, ids] of Object.entries(r.grupos)) {
        estado.grupos[letra] = { ids, tabela: tabelaNova(ids) };
      }
      const modelo = [[[0, 1], [2, 3]], [[1, 2], [3, 0]], [[0, 2], [1, 3]]];
      const seis = [...modelo, ...modelo.map((js) => js.map(([a, b]) => [b, a]))];
      r.rodadas_grupo.forEach((data, rod) => E(data, comp, `${r.nome} · Grupos, ${rod + 1}ª rodada`,
        () => Object.values(estado.grupos).flatMap((g) => seis[rod].map(([a, b]) => ({ casa: g.ids[a], fora: g.ids[b], grupo: g }))),
        (js) => {
          js.forEach((j) => registrar(j.grupo.tabela, j));
          if (rod === 5) {
            for (const g of Object.values(estado.grupos)) {
              g.final = ordenar(g.tabela);
              const pos = g.final.findIndex((l) => l.id === usuario);
              if (pos >= 0 && (comp === "lib" ? pos >= 2 : pos >= 2)) {
                // 3o da Libertadores cai pra Sul-Americana; resto sai
                if (!(comp === "lib" && pos === 2)) temp.eliminado[comp] = "Grupos";
                else temp.eliminado.lib = "Grupos (foi pra Sul-Americana)";
              }
            }
          }
        }));
    };
    // ranking entre grupos pra definir cabecas: pontos, saldo, gols
    const rankear = (linhas) => [...linhas].sort((a, b) =>
      b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || a.id.localeCompare(b.id, "pt-BR"));
    // chave fixa: 1x16, 8x9, 5x12, 4x13, 3x14, 6x11, 7x10, 2x15
    const CHAVE = [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]];
    const chaveFixa = (comp, fases, cabecas) => {
      let vivos = [];
      fases.forEach((f) => {
        if (f.unica) { finalUnica(comp, f.unica, () => vivos); return; }
        confrontosDuplos(comp, f.nome, f, () => {
          if (f.nome === "Oitavas") {
            const c = cabecas();
            return CHAVE.map(([x, y]) => [c[x - 1], c[y - 1]]);
          }
          const pares = [];
          for (let k = 0; k < vivos.length; k += 2) pares.push([vivos[k], vivos[k + 1]]);
          return pares;
        }, (v) => { vivos = v; });
      });
    };

    faseDeGrupos("lib");
    faseDeGrupos("sul");
    const grupos = (comp, pos) => Object.values(temp[comp].grupos).map((g) => g.final[pos]);
    // Sul-Americana: playoffs (2o da Sula x 3o da Libertadores), depois chave
    const rs = regras.sulamericana;
    const playoffs = rs.fases.find((f) => f.nome === "Playoffs");
    confrontosDuplos("sul", "Playoffs", playoffs, () => {
      const seg = rankear(grupos("sul", 1)).map((l) => l.id);
      const ter = rankear(grupos("lib", 2)).map((l) => l.id);
      // o melhor 2o da Sula pega o pior 3o da Libertadores
      return seg.map((id, k) => [id, ter[ter.length - 1 - k]]);
    }, (v) => { temp.sul.playoffs = v; });
    chaveFixa("sul", rs.fases.filter((f) => f.nome !== "Playoffs"), () => [
      ...rankear(grupos("sul", 0)).map((l) => l.id),
      ...temp.sul.playoffs,
    ]);
    chaveFixa("lib", regras.libertadores.fases, () => [
      ...rankear(grupos("lib", 0)).map((l) => l.id),
      ...rankear(grupos("lib", 1)).map((l) => l.id),
    ]);

    // ordem cronologica; no mesmo dia, Brasileirao por ultimo
    const peso = { lib: 0, sul: 1, cdb: 2, bra: 3 };
    temp.etapas = temp.etapas
      .map((e, k) => ({ ...e, k }))
      .sort((a, b) => a.data.localeCompare(b.data) || peso[a.comp] - peso[b.comp] || a.k - b.k);
    return temp;
  };

  function nomeRegra(comp) {
    return { bra: "brasileirao", cdb: "copa_do_brasil", lib: "libertadores", sul: "sulamericana" }[comp];
  }

  // Joga a proxima etapa inteira. Devolve os jogos (com placar e gols) e o
  // jogo do usuario, se houver, pra tela animar.
  Motor.avancar = function (temp) {
    const etapa = temp.etapas[temp.i];
    if (!etapa) return null;
    temp.i += 1;
    const pares = etapa.montar();
    const jogos = pares.map((p) => ({
      ...p,
      ...jogar(temp.rng, temp.times[p.casa], temp.times[p.fora], { neutro: Boolean(p.neutro), mata: Boolean(etapa.mata) }),
    }));
    if (etapa.depois) etapa.depois(jogos);
    for (const j of jogos) {
      for (const ev of j.eventos) {
        if (!ev.autor || ev.tipo !== "gol") continue;
        const time = ev.lado === "casa" ? j.casa : j.fora;
        const chave = `${ev.autor}|${time}`;
        temp.gols.set(chave, (temp.gols.get(chave) || 0) + 1);
      }
    }
    const doUsuario = jogos.find((j) => j.casa === temp.usuario || j.fora === temp.usuario) || null;
    temp.historico.push({ etapa, jogos, doUsuario });
    return { etapa, jogos, doUsuario };
  };

  Motor.terminou = (temp) => temp.i >= temp.etapas.length;

  // O usuario ainda tem jogo nessa etapa de mata-mata? (sem sortear nada)
  function participa(temp, e) {
    const eu = temp.usuario;
    if (temp.eliminado[e.comp] || temp.campeoes[e.comp]) return false;
    if (e.comp === "cdb") return true;
    const grupoDe = (c) => Object.values(temp[c].grupos).find((g) => g.ids.includes(eu));
    const pos = (g) => (g && g.final ? g.final.findIndex((l) => l.id === eu) : -1);
    const gl = grupoDe("lib"), gs = grupoDe("sul");
    if (e.comp === "lib") return Boolean(gl) && (!gl.final || pos(gl) <= 1);
    // Sul-Americana: 1o do grupo pula o playoff; 3o da Libertadores cai nele
    if (gs) {
      if (!gs.final) return true;
      return e.fase === "Playoffs" ? pos(gs) === 1 : pos(gs) <= 1;
    }
    if (gl) return gl.final ? pos(gl) === 2 : false;
    return false;
  }

  // Proximos jogos do usuario, na ordem do calendario. Jogo de pontos
  // corridos ja tem adversario; mata-mata ainda nao sorteado vem "a definir".
  Motor.agenda = function (temp, n = 5) {
    const lista = [];
    for (let k = temp.i; k < temp.etapas.length && lista.length < n; k++) {
      const e = temp.etapas[k];
      if (e.mata) {
        if (participa(temp, e)) lista.push({ etapa: e, jogo: null, indice: k });
        continue;
      }
      const j = e.montar().find((x) => x.casa === temp.usuario || x.fora === temp.usuario);
      if (j) lista.push({ etapa: e, jogo: j, indice: k });
    }
    return lista;
  };

  // jogo que vale parar pra ver: mata-mata ou reta final do Brasileirao
  Motor.decisiva = (e) => Boolean(e.mata) || (e.comp === "bra" && /(3[6-8])ª rodada/.test(e.rotulo));

  // quantas etapas faltam em que o usuario ainda joga
  Motor.proximaDoUsuario = function (temp) {
    for (let k = temp.i; k < temp.etapas.length; k++) {
      const e = temp.etapas[k];
      if (temp.eliminado[e.comp] && e.comp !== "bra") continue;
      return e;
    }
    return null;
  };

  Motor.artilharia = function (temp, filtro) {
    return [...temp.gols.entries()]
      .map(([chave, gols]) => { const [nome, time] = chave.split("|"); return { nome, time, gols }; })
      .filter((a) => !filtro || filtro(a))
      .sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome, "pt-BR"));
  };

  // --- forca dos times a partir dos overalls ----------------------------------
  const MEDIA = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const PESO_GOL = { F: 3, M: 1.4, D: 0.35, G: 0.02 };
  // finalizacao: FIN no modelo v2; CHU nos retratos antigos
  const finalizacao = (j) => {
    const e = j.eixos || {};
    return typeof e.FIN === "number" ? e.FIN : typeof e.CHU === "number" ? e.CHU : null;
  };
  const SEM_NOTA = 45; // quem joga sem nota entra como abaixo da media, nunca zero

  // Efeito do esquema no ataque e na defesa (pontos na escala de forca).
  // Mais gente na frente cria mais e toma mais; linha de 5 fecha e cria menos.
  // Por enquanto e chute calibrado a mao; depois vira metrica dos dados.
  Motor.TATICA = {
    "4-3-3": { atq: 1.5, def: -1, resumo: "ofensivo: cria mais, expõe a defesa" },
    "3-4-3": { atq: 2.5, def: -2, resumo: "muito ofensivo: sufoca, mas deixa espaço atrás" },
    "4-2-3-1": { atq: 0.5, def: 0.5, resumo: "equilibrado, com dois volantes protegendo" },
    "3-4-2-1": { atq: 1, def: -0.5, resumo: "ofensivo pelos alas" },
    "4-4-2": { atq: 0, def: 0.5, resumo: "clássico: duas linhas de quatro, compacto" },
    "3-5-2": { atq: 0.5, def: -0.5, resumo: "domina o meio, alas sobem e deixam buraco" },
    "4-1-4-1": { atq: -0.5, def: 1, resumo: "cauteloso: um volante fixo e meio povoado" },
    "5-3-2": { atq: -1.5, def: 2, resumo: "retranca: toma pouco gol, faz pouco também" },
  };

  // onze: [{ nome, posicao, overall|null, eixos }]
  Motor.forcaDoOnze = function (onze, reforco = null, formacao = null) {
    const ov = (j) => (typeof j.overall === "number" ? j.overall : SEM_NOTA);
    const ataque = onze.filter((j) => j.posicao === "F" || j.posicao === "M").map(ov);
    const defesa = onze.flatMap((j) => (j.posicao === "G" ? [ov(j), ov(j)] : j.posicao === "D" || j.posicao === "M" ? [ov(j)] : []));
    let atq = MEDIA(ataque) ?? MEDIA(onze.map(ov));
    let def = MEDIA(defesa) ?? MEDIA(onze.map(ov));
    // elenco (quem nao e titular) pesa um pouco: temporada longa cansa o onze
    if (reforco !== null) { atq = 0.6 * atq + 0.4 * reforco; def = 0.6 * def + 0.4 * reforco; }

    const artilheiros = onze
      .filter((j) => j.nome)
      .map((j) => ({ nome: j.nome, pos: j.posicao, peso: (PESO_GOL[j.posicao] || 0.5) * ((finalizacao(j) ?? 30) / 100 + 0.2) }));
    return { atq, def, artilheiros };
  };

  // A forca dos estrangeiros e estimada numa regua fixa (media ~55,5; os
  // da Serie A iam de ~49 a ~61). Os overalls mudam de escala entre versoes
  // do modelo (o v2 estica o topo), entao a Serie A e convertida pra essa
  // regua pela posicao relativa na liga: mesma distancia da media, em desvios.
  const REGUA = { media: 55.5, dp: 3.2 };
  Motor.ESCALA = null;
  Motor.naRegua = function (f) {
    const e = Motor.ESCALA;
    if (!e) return f;
    const conv = (v) => REGUA.media + ((v - e.media) / e.dp) * REGUA.dp;
    return { ...f, atq: conv(f.atq), def: conv(f.def) };
  };
  Motor.aplicarTatica = function (f, formacao) {
    const t = Motor.TATICA[formacao];
    return t ? { ...f, atq: f.atq + t.atq, def: f.def + t.def } : f;
  };

  // Times da Serie A a partir do retrato: o onze da escalacao base + media
  // dos 11 melhores do elenco como reforco.
  Motor.timesDaSerieA = function (retrato) {
    const times = {};
    for (const t of retrato.times) {
      const porId = new Map(t.jogadores.map((j) => [j.player_id, j]));
      const base = t.escalacao_base ? t.escalacao_base.posicoes : [];
      let onze = base.map((p) => porId.get(p.player_id)).filter(Boolean);
      const melhores = t.jogadores.filter((j) => j.overall !== null).sort((a, b) => b.overall - a.overall);
      if (onze.length < 11) onze = [...onze, ...melhores.filter((j) => !onze.includes(j))].slice(0, 11);
      const reforco = MEDIA(melhores.slice(0, 11).map((j) => j.overall)) ?? SEM_NOTA;
      const formacao = t.escalacao_base ? t.escalacao_base.formacao : null;
      times[t.nome] = { id: t.nome, nome: t.nome, serieA: true, time: t, onze, formacao, ...Motor.forcaDoOnze(onze, reforco) };
    }
    // escala da liga (ataque e defesa juntos) e conversao pra regua
    const vals = Object.values(times).flatMap((t) => [t.atq, t.def]);
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    const dp = Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / vals.length) || 1;
    Motor.ESCALA = { media, dp };
    for (const t of Object.values(times)) Object.assign(t, Motor.aplicarTatica(Motor.naRegua(t), t.formacao));
    return times;
  };

  // Elencos dos times sem carta (estrangeiros, Serie B/C/D), so nome e
  // posicao: dados/elencos-fora.json, do futdata. Serve para o gol do time
  // de fora ter um autor de verdade em vez de "jogador do Estudiantes".
  Motor.ELENCOS = {};
  Motor.artilheirosDoElenco = function (nome, total = null) {
    const elenco = Motor.ELENCOS[nome] || [];
    const lista = elenco.map((j) => ({ nome: j.nome, pos: j.posicao, peso: PESO_GOL[j.posicao] || 0.5 }));
    if (total !== null && lista.length) {
      const soma = lista.reduce((s, a) => s + a.peso, 0);
      for (const a of lista) a.peso = (a.peso / soma) * total;
    }
    return lista;
  };

  // Estrangeiros e convidados da Copa do Brasil: forca unica estimada
  Motor.timesDeFora = function (regras) {
    const times = {};
    for (const [nome, t] of Object.entries(regras.estrangeiros)) {
      if (nome.startsWith("_")) continue;
      times[nome] = { id: nome, nome, pais: t.pais, altitude: Boolean(t.altitude), atq: t.forca, def: t.forca, artilheiros: Motor.artilheirosDoElenco(nome), kit: t.uniforme };
    }
    for (const c of regras.copa_do_brasil.convidados) {
      times[c.nome] = { id: c.nome, nome: c.nome, pais: "BRA", atq: c.forca, def: c.forca, artilheiros: Motor.artilheirosDoElenco(c.nome), kit: c.uniforme };
    }
    return times;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Motor;
  else raiz.Motor = Motor;
})(typeof window !== "undefined" ? window : globalThis);
