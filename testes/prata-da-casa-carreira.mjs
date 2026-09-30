import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const rodarTemporada = async (escolher = () => 0) => {
  await p.click('#proxima');
  let n = 0;
  for (;;) {
    await p.waitForFunction(() => !document.getElementById('proxima').hidden || document.querySelector('.evento-opcao:not([disabled])'), null, { timeout: 30000 });
    if (!(await p.evaluate(() => document.getElementById('proxima').hidden))) break;
    const ops = p.locator('.evento-opcao:not([disabled])');
    // rolagem suave as vezes deixa o Playwright achando que o botao 'mexe': forca depois de 5 s
    const alvo = ops.nth(escolher(await ops.count()));
    await alvo.click({ timeout: 5000 }).catch(() => alvo.click({ force: true }));
    n++;
  }
  return n;
};

const erros=[]; p.on('pageerror', e => erros.push(e.message));
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
await p.goto(BASE + '/prata-da-casa.html'); await p.waitForTimeout(1500);
await p.fill('#nome-camisa', 'Teste'); await p.click('[data-modo="completo"]'); await p.click('.pos-botao:text-is("MEI")');
await p.click('#confirmar-jogador'); for (let i=0;i<40;i++){ const m = p.locator('.atributo-mais:not([disabled])').first(); if (!(await m.count())) break; await m.click(); }
await p.click('#confirmar-carta');
await p.screenshot({ path: `testes/resultados/cmp-base.png` });
await p.locator('.proposta .botao-primario').first().click();
let eventos = 0, mercados = 0, trocas = 0, pedidos = 0;
for (let ano = 0; ano < 30; ano++) {
  if (await p.evaluate(() => C.J.aposentado)) break;
  eventos += await rodarTemporada((n) => Math.floor(Math.random() * n));
  if (await p.evaluate(() => C.J.aposentado)) break;
  mercados++;
  if (await p.locator('#mercado .proposta-nome').count() > 1 && mercados % 2) {
    if (trocas === 0) await p.screenshot({ path: `testes/resultados/cmp-mercado.png`, fullPage: true });
    const pedir = p.locator('#mercado .proposta .botao:has-text("Pedir vaga")').first();
    if (await pedir.count() && Math.random() < 0.5) { await pedir.click(); pedidos++; }
    if (!(await p.locator('#proxima').isEnabled())) {
      const assinar = p.locator('#mercado .proposta .botao-primario:not([disabled])').first();
      if (await assinar.count()) { await assinar.click(); trocas++; } else await p.locator('#mercado .proposta-ficar .botao:not(.renova-opcao)').first().click();
    }
  } else {
    const botao = p.locator('#mercado .proposta-ficar .botao, #mercado > .botao-primario').first();
    await botao.click();
  }
  ok(await p.locator('#proxima').isEnabled(), `ano ${ano}: mercado fechou`);
}
await p.screenshot({ path: `testes/resultados/cmp-meio.png`, fullPage: true });
console.log({ eventos, mercados, trocas, pedidos });
const n = await p.evaluate(() => C.J.historico.length); ok(n > 5, 'temporadas jogadas: ' + n);
await p.click('#proxima'); await p.waitForTimeout(300);
ok(await p.locator('#tela-fim').isVisible() || !(await p.evaluate(()=>C.J.aposentado)), 'fim ou segue');
ok(erros.length === 0, 'sem erro ' + erros.join(' | '));
await b.close();
