// Prata da Casa com o mercado do futdata (dados/mercado.json): valor ajustado no
// Transfermarkt, preço da transferência sorteado da distribuição real, escada
// das divisões encadeada na Série A e recorde de venda do clube. Sem o JSON, o
// jogo abre com a fórmula antiga.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
// sem o arquivo (404) e com o arquivo incompleto: nos dois o jogo abre com as formulas de antes
for (const caso of ['com', '404', 'incompleto']) {
  const semJson = caso !== 'com';
  const p = await b.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  if (caso === '404') await p.route('**/dados/mercado.json', (r) => r.fulfill({ status: 404, body: '' }));
  if (caso === 'incompleto') await p.route('**/dados/mercado.json', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ valor: { coef: [1, 2] }, escada: {}, preco: { BRA1: [1, 'x'] } }) }));
  await p.goto(BASE + '/prata-da-casa.html');
  await p.waitForFunction(() => typeof C !== 'undefined' && C.r && C.inferiores, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    reiniciarMundo();
    const a = { tipo: 'br', divisao: 'A', nome: 'Grêmio', continente: 'america', ligaId: 'bra' };
    const J = (ovr, idade, clube = a, contratoAte = 2030) => ({ ovr, idade, clube, contratoAte, ano: 2026 });
    const comValor = (j) => ({ ...j, valor: valorDeMercado(j) });
    const precos = Array.from({ length: 20 }, () => precoDaVenda(comValor(J(80, 24))));
    const ultimaB = C.div.B.map((n) => clubeInferior(n).nivel);
    const nivelA = Math.min(...Object.values(Motor.timesDaSerieA(C.r)).map((t) => {
      const o = t.onze.filter((j) => j.overall !== null).map((j) => j.overall); return o.reduce((s, x) => s + x, 0) / o.length;
    }));
    return {
      temMercado: !!C.mercado,
      v70: valorDeMercado(J(70, 24)), v80: valorDeMercado(J(80, 24)), v80velho: valorDeMercado(J(80, 33)),
      v16: valorDeMercado(J(75, 16)), v41: valorDeMercado(J(75, 41)),
      precos, livre: precoDaVenda(comValor(J(80, 24, a, 2025))),
      topoB: Math.max(...ultimaB), nivelA,
    };
  });
  const rot = caso === 'com' ? 'com mercado.json' : caso === '404' ? 'sem mercado.json' : 'mercado.json incompleto';
  ok(r.temMercado === !semJson, `${rot}: C.mercado ${r.temMercado}`);
  ok(r.v80 > r.v70 && r.v80velho < r.v80, `${rot}: valor sobe com o overall e cai depois dos 30 (${r.v70}, ${r.v80}, ${r.v80velho})`);
  ok(Number.isFinite(r.v16) && Number.isFinite(r.v41) && r.v16 > 0, `${rot}: idade 16 e 41 dão valor finito (${r.v16}, ${r.v41})`);
  ok(r.precos.every((x) => x > 0), `${rot}: com contrato o preço é > 0`);
  ok(r.livre === 0, `${rot}: livre sai de graça`);
  if (!semJson) {
    ok(new Set(r.precos).size > 3, `com mercado.json: o preço varia (${[...new Set(r.precos)].slice(0, 6).join(', ')})`);
    // a escada ancora no ultimo da A medio de 2024-2026 (68,5) menos 1; o pior time da A de hoje pode estar abaixo
    // dessa media, entao a regra do dono ("o campeao da B tem quase o time do ultimo da A") vira: no maximo 1 acima
    ok(r.topoB < r.nivelA + 1, `com mercado.json: o melhor da Série B (${r.topoB.toFixed(1)}) tem quase o time do pior da A (${r.nivelA.toFixed(1)})`);
    ok(r.topoB > r.nivelA - 4, `com mercado.json: e não fica muito abaixo (antes a B começava em ~62)`);
  }
  if (caso === 'com') {
    const x = await p.evaluate(() => {
      const rec = C.mercado.recordes['Grêmio'];
      const J = (clube) => ({ ovr: 80, idade: 24, clube, contratoAte: 2030, ano: 2026, valor: 10 });
      const rng = C.rng; C.rng = () => 0.999999;   // o topo do sorteio = o p90 do grupo
      const br = precoDaVenda(J({ tipo: 'br', nome: 'Grêmio', continente: 'america', ligaId: 'bra' }));
      const eu = precoDaVenda(J({ tipo: 'ext', nome: 'Arsenal', continente: 'europa', ligaId: 'eng' }));
      const pt = precoDaVenda(J({ tipo: 'ext', nome: 'Benfica', continente: 'europa', ligaId: 'por' }));
      const ar = precoDaVenda(J({ tipo: 'ext', nome: 'Boca', continente: 'america', ligaId: 'arg' }));
      C.rng = rng;
      const p90 = (g) => Math.round(10 * C.mercado.preco[g][4] * 10) / 10;
      return { rec, br, eu, pt, ar, p90: { BRA1: p90('BRA1'), europa: p90('europa'), outras: p90('outras') },
        acima: recordeBatido({ de: 'Grêmio', valor: rec.valor / 1e6 + 1 }), abaixo: recordeBatido({ de: 'Grêmio', valor: rec.valor / 1e6 - 1 }),
        semClube: recordeBatido({ de: 'Clube Que Não Existe', valor: 999 }) };
    });
    ok(x.br === x.p90.BRA1 && x.eu === x.p90.europa && x.ar === x.p90.outras,
      `preço sai do grupo da liga de quem VENDE (BRA1 ${x.br}/${x.p90.BRA1}, europa ${x.eu}/${x.p90.europa}, outras ${x.ar}/${x.p90.outras})`);
    ok(x.pt === x.p90.outras, `Portugal/Holanda vendem no grupo "outras" (spec: europa = só as 5 grandes) (${x.pt}/${x.p90.outras})`);
    ok(x.acima && x.acima.jogador === x.rec.jogador && !x.abaixo && !x.semClube,
      `recorde do Grêmio (${x.rec.jogador}, €${x.rec.valor / 1e6} mi): batido só acima dele, em milhões; clube sem recorde não acusa`);
  }
  if (caso === 'com') {
    // escada: a ordem da divisao acompanha o mundo (cache invalidado ao trocar de divisao) e clube sem forca
    // fica fora da escada (ausencia nunca e zero: nao vira o ultimo da divisao)
    const e = await p.evaluate(() => {
      reiniciarMundo();
      const esc = C.mercado.escada;
      const forca = (n) => C.inf.get(n).forca;
      const porForca = (div) => [...C.div[div]].filter((n) => Number.isFinite(forca(n))).sort((a, b) => forca(b) - forca(a));
      const degrauDe = (div, nome) => { const o = porForca(div), i = o.indexOf(nome);
        return esc[div][Math.round(i * (esc[div].length - 1) / Math.max(1, o.length - 1))]; };
      const topoC = porForca('C')[0];
      const antes = nivelNaEscada(topoC, 'C');
      const ultimoB = porForca('B').at(-1);
      nivelNaEscada(ultimoB, 'B');                   // aquece a ordem da B antes da troca
      trocarDivisao(topoC, 'C', 'B');
      const desceu = C.div.C.at(-1);                 // trocarDivisao poe quem desceu da B no fim da C
      const r = { antes, topoTopo: esc.C[0], naC: nivelNaEscada(topoC, 'C'), naB: nivelNaEscada(topoC, 'B'),
        naBesperado: degrauDe('B', topoC), desceuNaC: nivelNaEscada(desceu, 'C'), desceuEsperado: degrauDe('C', desceu),
        desceuNaB: nivelNaEscada(desceu, 'B') };
      reiniciarMundo();                              // o mundo volta ao inicio: o clube esta de novo no topo da C
      r.voltouC = nivelNaEscada(topoC, 'C'); r.voltouB = nivelNaEscada(topoC, 'B');
      C.inf.set('Clube Sem Força', { nome: 'Clube Sem Força', uf: '', forca: undefined, uniforme: null, time: null });
      C.div.B.push('Clube Sem Força');
      const ult = porForca('B').at(-1);
      r.semForca = nivelNaEscada('Clube Sem Força', 'B');
      r.ultimo = nivelNaEscada(ult, 'B'); r.ultimoEsperado = esc.B.at(-1);
      r.fallback = clubeInferior('Clube Sem Força').nivel;
      reiniciarMundo();
      return r;
    });
    ok(e.antes === e.topoTopo && e.naC === null && e.naB === e.naBesperado,
      `escada: o mais forte da C (${e.antes}) subiu e passa a ter o nível da posição dele na B (${e.naB}/${e.naBesperado}), não o da C (${e.naC})`);
    ok(e.voltouC === e.topoTopo && e.voltouB === null,
      `escada: depois de reiniciar o mundo, o clube volta ao topo da C (${e.voltouC}/${e.topoTopo}) e sai da B (${e.voltouB})`);
    ok(e.desceuNaC === e.desceuEsperado && e.desceuNaB === null,
      `escada: quem desceu da B pra C ganha o nível da posição na C (${e.desceuNaC}/${e.desceuEsperado})`);
    ok(e.semForca === null && e.ultimo === e.ultimoEsperado,
      `escada: clube sem força fica fora da escada (${e.semForca}) e o último com força segue no fim da B (${e.ultimo}/${e.ultimoEsperado})`);
    // preco: u em [0,10; 0,90] interpolado pelos niveis reais dos quantis (0,10 0,25 0,50 0,75 0,90)
    const q = await p.evaluate(() => {
      const rng = C.rng;
      const J = { ovr: 80, idade: 24, clube: { tipo: 'br', nome: 'Grêmio', continente: 'america', ligaId: 'bra' },
        contratoAte: 2030, ano: 2026, valor: 1000 };
      const com = (x) => { C.rng = () => x; return precoDaVenda(J) / 1000; };
      const r = { p: C.mercado.preco.BRA1, em: [0, 0.1875, 0.5, 0.8125].map(com) };
      let s = 12345; C.rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const amostra = Array.from({ length: 20000 }, () => precoDaVenda(J) / 1000);
      C.rng = rng;
      const entre = (a, b) => amostra.filter((x) => x >= a && x < b).length / amostra.length;
      r.fatias = [entre(r.p[0], r.p[1]), entre(r.p[1], r.p[2]), entre(r.p[2], r.p[3]), entre(r.p[3], r.p[4] + 1e-9)];
      return r;
    });
    const perto = (a, b) => Math.abs(a - b) < 0.0011;
    ok(perto(q.em[0], q.p[0]) && perto(q.em[1], q.p[1]) && perto(q.em[2], q.p[2]) && perto(q.em[3], q.p[3]),
      `preço: o sorteio cai no quantil certo (rng 0 → p10 ${q.em[0]}/${q.p[0]}, 0,1875 → p25 ${q.em[1]}/${q.p[1]}, 0,5 → p50 ${q.em[2]}/${q.p[2]}, 0,8125 → p75 ${q.em[3]}/${q.p[3]})`);
    // no real, 15/25/25/15% das vendas caem entre p10-p25-p50-p75-p90; dentro de p10..p90 (80%) isso e 18,75/31,25/31,25/18,75
    // (o sorteio uniforme pelos indices dava 25% em cada fatia)
    const alvo = [0.1875, 0.3125, 0.3125, 0.1875];
    ok(q.fatias.every((x, i) => Math.abs(x - alvo[i]) < 0.015),
      `preço: 18,75/31,25/31,25/18,75% entre p10-p25-p50-p75-p90 (15/25/25/15 do real, dentro de p10..p90) (${q.fatias.map((x) => (100 * x).toFixed(1)).join('/')})`);
  }
  ok(!erros.length, `${rot}: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}
await b.close();
