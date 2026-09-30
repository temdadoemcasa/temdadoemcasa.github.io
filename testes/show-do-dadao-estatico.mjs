import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const seguir = async (pg) => { await pg.waitForTimeout(60); if (await pg.locator('.festa-quiz-pop').count()) { await pg.click('.festa-quiz-pop'); await pg.waitForTimeout(320); } else { await pg.click('#proxima'); await pg.waitForTimeout(60); } };
const b = await chromium.launch();
const falhas = [];
for (const [w, h] of [[390, 844], [360, 740], [375, 667], [1280, 800]]) {
  const vp = `${w}x${h}`;
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, reducedMotion: 'reduce' });
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.goto(BASE + '/show-do-dadao.html'); await p.evaluate(() => localStorage.clear());
  await p.click('button[type=submit]'); await p.waitForTimeout(100);
  const foto = () => p.evaluate(() => {
    const r = (s) => { const q = document.querySelector(s).getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom)]; };
    return { y: scrollY, alts: r('#alternativas'), palco: r('#palco-acao'), enunciado: r('#enunciado') };
  });
  // o palco (ultimo bloco) pode crescer pra baixo; o que nao pode mexer e o que esta acima dele
  const semPalco = ({ palco, ...resto }) => resto;
  const igual = (a, b2, onde) => { const A = JSON.stringify(semPalco(a)), B = JSON.stringify(semPalco(b2)); if (A !== B) falhas.push(`${vp} ${onde}: ${A} -> ${B}`); };
  const certa = () => p.evaluate(() => Q.opcoes.findIndex(o => o.certa));
  // pergunta 1: escolher, pensar mais, escolher de novo, confirmar
  let f0 = await foto();
  let c = await certa();
  await p.locator('.alternativa').nth((c + 1) % 4).click(); igual(f0, await foto(), 'escolher');
  await p.keyboard.press('Escape'); igual(f0, await foto(), 'pensar mais');
  await p.click('#ajuda-arquibancada'); igual(f0, await foto(), 'arquibancada');
  await p.click('#ajuda-boys'); igual(f0, await foto(), 'golden boys');
  await p.click('#ajuda-enciclopedia'); igual(f0, await foto(), 'enciclopedia');
  await p.click('#parar'); igual(f0, await foto(), 'parar'); await p.click('#parar-nao'); igual(f0, await foto(), 'continuar');
  await p.locator('.alternativa').nth(c).click(); await p.click('#confirmar'); await p.waitForTimeout(80); igual(f0, await foto(), 'confirmar/resultado');
  if (w === 390) await p.screenshot({ path: `testes/resultados/est-certa.png` });
  await seguir(p); await p.waitForTimeout(50);
  const f1 = await foto(); if (f1.y !== f0.y) falhas.push(`${vp} rolou ao ir pra proxima (${f0.y}->${f1.y})`);
  await p.click('#ajuda-cartas'); igual(f1, await foto(), 'abrir cartas');
  if (w === 390) await p.screenshot({ path: `testes/resultados/est-cartas.png` });
  await p.locator('.carta-baralho').nth(2).click(); await p.waitForTimeout(50); igual(f1, await foto(), 'escolher carta');
  if (w === 390) await p.screenshot({ path: `testes/resultados/est-ajudas.png` });
  // tudo cabe na tela? (celular: palco inteiro acima da barra de abas)
  const cabe = await p.evaluate(() => { const barra = document.querySelector('.abas-mobile'); const baixo = innerHeight - (barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight : 0); return document.querySelector('#palco-acao').getBoundingClientRect().bottom <= baixo; });
  if (!cabe) falhas.push(`${vp}: palco de ação passa da tela (precisa rolar)`);
  c = await certa(); const errada = await p.evaluate(() => Q.opcoes.findIndex((o, i) => !o.certa && !Q.eliminadas.has(i))); await p.locator('.alternativa').nth(errada < 0 ? c : errada).click(); await p.click('#confirmar'); await p.waitForTimeout(50);
  igual(f1, await foto(), 'errar');
  if (w === 390) await p.screenshot({ path: `testes/resultados/est-errou.png` });
  if (erros.length) falhas.push(vp + ' JS ' + erros.join('|'));
  await p.close();
}
falhas.forEach((f) => console.log('FALHA', f));
console.log(falhas.length ? 'FALHA' : 'OK  ', 'tela estática nos 4 tamanhos (nada acima do palco se mexe, sem rolar)');
await b.close();
