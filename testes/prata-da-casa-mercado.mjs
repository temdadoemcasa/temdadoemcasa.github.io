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
  ok(!erros.length, `${rot}: sem erro de página ${erros.join(' | ')}`);
  await p.close();
}
await b.close();
