import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const rodarTemporada = async (escolher = () => 0) => {
  await p.click('#proxima');
  let n = 0;
  for (;;) {
    await p.waitForFunction(() => !document.getElementById('proxima').hidden || document.querySelector('.evento-opcao:not([disabled])'), null, { timeout: 30000 });
    if (!(await p.evaluate(() => document.getElementById('proxima').hidden))) break;
    const ops = p.locator('.evento-opcao:not([disabled])');
    await ops.nth(escolher(await ops.count())).click(); n++;
  }
  return n;
};
const jogar = async () => { const n = await rodarTemporada(); if (await p.locator('#mercado:not([hidden])').count()) { await p.locator('#mercado .proposta-ficar .botao, #mercado .botao-primario').first().click(); } return n; };
const erros=[]; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
const ok = (cond, msg) => console.log(cond ? 'OK  ' : 'FALHA', msg);
await p.goto(BASE + '/prata-da-casa.html'); await p.waitForTimeout(1500);
ok(await p.locator('.pais').count() > 20, 'paises listados');
await p.fill('#nome-camisa', 'Souza'); await p.fill('#numero-camisa', '9');
await p.click('.pos-botao:text-is("CA")');
await p.screenshot({ path: `testes/resultados/car-criar.png`, fullPage: true });
await p.click('#confirmar-jogador'); await p.waitForTimeout(200);
ok(await p.locator('#tela-carta').isVisible(), 'tela da carta');
for (let i=0;i<40;i++){ const m = p.locator('.atributo-mais:not([disabled])').first(); if (!(await m.count())) break; await m.click(); }
ok(await p.locator('#confirmar-carta').isEnabled(), 'carta fechada com 30 pontos');
await p.screenshot({ path: `testes/resultados/car-carta.png`, fullPage: true });
await p.click('#confirmar-carta'); await p.waitForTimeout(300);
const ligas = await p.locator('.proposta-liga').allTextContents();
ok(ligas.length === 3 && ligas.every(l => /Série [BCD]/.test(l)), 'propostas iniciais da B/C/D: ' + ligas.join(' | '));
await p.screenshot({ path: `testes/resultados/car-base.png`, fullPage: true });
await p.locator('.proposta .botao').first().click(); await p.waitForTimeout(300);
for (let i=0;i<4;i++) await jogar();
await p.screenshot({ path: `testes/resultados/car-carreira.png`, fullPage: true });
ok(await p.locator('#tabela-carreira tr').count() >= 5, 'tabela com temporadas');
await p.click('#tudo'); await p.waitForTimeout(150); await p.click('#tudo'); await p.waitForTimeout(1500);
ok(await p.locator('#tela-fim').isVisible(), 'aposentadoria');
await p.screenshot({ path: `testes/resultados/car-fim.png`, fullPage: true });

// distribuicoes: 150 carreiras rapidas, varias posicoes
const est = await p.evaluate(() => {
  const res = [];
  const poss = ['CA','PE','MEI','MC','VOL','ZAG','LD','GOL'];
  for (let k = 0; k < 160; k++) {
    C.pos = poss[k % poss.length]; iniciarCarta();
    const f = funcaoDe(C.pos); const ordem = Object.entries(PESOS[f]).sort((a,b)=>b[1]-a[1]).map(([x])=>x);
    for (const a of ordem.slice(0,2)) { C.attrs[a] += 15; C.pontos -= 15; }
    C.nome = 'Teste'; criarJogador();
    const ofs = propostasIniciais(); assinar(ofs[k%3], 'x');
    const J = C.J; const clubes = [J.clube.liga];
    while (!J.aposentado) { jogarTemporada(); clubes.push(J.clube.liga); }
    const h = J.historico;
    res.push({ pos: C.pos, fam: POSICOES[C.pos].fam, ovr0: h[0].ovr, auge: Math.max(...h.map(x=>x.ovr)), anos: h.length,
      jogos: h.reduce((a,x)=>a+x.jogos,0), gols: h.reduce((a,x)=>a+x.gols,0), assist: h.reduce((a,x)=>a+x.assist,0),
      titulos: J.titulos.length, premios: J.premios.map(x=>x.nome), bola: Math.min(...h.map(x=>x.bolaDeOuro||99)),
      idadeA: (h.find(x=>x.liga==='Brasileirão')||{}).idade ?? null, idadeEuropa: (h.find(x=>/Premier|LaLiga|Bundes|Ligue|Serie A \(|Portugal|Eredi/.test(x.liga))||{}).idade ?? null,
      ligas: [...new Set(h.map(x=>x.liga))], notas: h.map(x=>x.nota), motm: h.reduce((a,x)=>a+x.craqueDoJogo,0),
      primeiro: h.slice(0,4).map(x=>`${x.idade}:${x.liga}:${x.jogos}j:${x.ovr}`).join(' ') });
  }
  return res;
});
const m = (xs) => (xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(1);
const q = (xs, t) => { const s=[...xs].sort((a,b)=>a-b); return s[Math.floor(t*(s.length-1))]; };
console.log('ovr inicial', m(est.map(e=>e.ovr0)), 'auge medio', m(est.map(e=>e.auge)), 'p10/p90 auge', q(est.map(e=>e.auge),.1), q(est.map(e=>e.auge),.9), 'anos', m(est.map(e=>e.anos)));
console.log('chegou na Serie A', est.filter(e=>e.idadeA!==null).length, '/', est.length, 'idade media', m(est.filter(e=>e.idadeA!==null).map(e=>e.idadeA)));
console.log('chegou na Europa', est.filter(e=>e.idadeEuropa!==null).length, 'idade media', m(est.filter(e=>e.idadeEuropa!==null).map(e=>e.idadeEuropa)));
for (const fam of ['F','M','D','G']) { const g = est.filter(e=>e.fam===fam); console.log(fam, 'jogos', m(g.map(e=>e.jogos)), 'gols', m(g.map(e=>e.gols)), 'assist', m(g.map(e=>e.assist)), 'titulos', m(g.map(e=>e.titulos)), 'premios', m(g.map(e=>e.premios.length)), 'motm', m(g.map(e=>e.motm))); }
const cont = {}; for (const e of est) for (const n of e.premios) { const k = n.replace(/ (do|da) .*/, ''); cont[k]=(cont[k]||0)+1; }
console.log('premios', cont);
console.log('bola top30', est.filter(e=>e.bola<=30).length, 'bola de ouro', est.filter(e=>e.bola===1).length);
const notas = est.flatMap(e=>e.notas); console.log('nota media', m(notas), 'p10/p90', q(notas,.1).toFixed(2), q(notas,.9).toFixed(2));
for (const e of est.slice(0,8)) console.log(e.pos, e.primeiro, '| auge', e.auge, e.ligas.join('>'));
ok(erros.length === 0, 'sem erro de JS ' + erros.slice(0,3).join(' / '));
await b.close();
