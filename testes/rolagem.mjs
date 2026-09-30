import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const S = process.argv[2];
const b = await chromium.launch();
const erros = [];
for (const modo of ['completo', 'rapido']) {
  const p = await b.newPage({ viewport: { width: 1238, height: 900 } });
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(BASE + '/prata-da-casa.html'); await p.waitForTimeout(1300);
  await p.fill('#nome-camisa', 'Breno');
  if (modo === 'completo') await p.click('.modo:has-text("Completo")');
  await p.click('#confirmar-jogador'); await p.waitForTimeout(200);
  for (let i=0;i<40;i++){ const m = p.locator('.atributo-mais:not([disabled])').first(); if (!(await m.count())) break; await m.click(); }
  await p.click('#confirmar-carta'); await p.waitForTimeout(300);
  await p.locator('.proposta .botao').first().click(); await p.waitForTimeout(300);
  for (let temp = 0; temp < 3; temp++) {
    await p.click('#proxima');
    let shot = 0;
    for (let k = 0; k < 8; k++) {
      // espera decisao ou fim
      const h = await p.waitForFunction(() => document.querySelector('.evento-opcoes') || document.querySelector('.temporada-numeros') || document.querySelector('#mercado:not([hidden])'), null, { timeout: 20000 });
      if (await p.$('.temporada-numeros') || await p.$('#mercado:not([hidden])')) break;
      if (temp === 0 && shot++ < 1) await p.screenshot({ path: `testes/resultados/${S}/rola-${modo}-dec.png` });
      // prefere a opcao com chance pra ver a roleta
      const comChance = p.locator('.evento-opcao:has(small:text-matches("de dar certo"))');
      if (await comChance.count()) {
        await comChance.first().click();
        await p.waitForTimeout(1500);
        if (temp === 0) await p.screenshot({ path: `testes/resultados/${S}/rola-${modo}-roleta.png` });
      } else await p.locator('.evento-opcao').first().click();
      await p.waitForTimeout(2600);
      if (temp === 0 && k === 0) await p.screenshot({ path: `testes/resultados/${S}/rola-${modo}-depois.png` });
      await p.waitForFunction(() => !document.querySelector('.roleta') || document.querySelector('.evento-opcoes') || document.querySelector('.temporada-numeros'), null, { timeout: 20000 }).catch(()=>{});
    }
    await p.waitForFunction(() => document.querySelector('.temporada-numeros') || document.querySelector('#mercado:not([hidden])'), null, { timeout: 20000 });
    if (await p.$('#mercado:not([hidden])')) {
      const fic = p.locator('#mercado .proposta-ficar .botao, #mercado .botao-primario');
      await fic.first().click(); await p.waitForTimeout(200);
    }
    if (temp === 0) await p.screenshot({ path: `testes/resultados/${S}/rola-${modo}-fim.png`, fullPage: true });
  }
  // simular o resto no meio de uma temporada rolando
  await p.click('#proxima'); await p.waitForTimeout(800);
  await p.click('#tudo'); await p.waitForTimeout(150); await p.click('#tudo'); await p.waitForTimeout(1500);
  const temps = await p.evaluate(() => C.J.historico.length);
  console.log(await p.evaluate(() => C.J.aposentado) ? 'OK  ' : 'FALHA', `${modo}: simular o resto chega na aposentadoria`);
  console.log(temps >= 3 ? 'OK  ' : 'FALHA', `${modo}: rolou ${temps} temporadas`);
  await p.close();
}
console.log(erros.length ? 'FALHA' : 'OK  ', 'sem erro de JS', erros.join(' | '));
await b.close();
