// Bateria de UX no celular (360x740, 375x667 e 390x844) pro Prata da Casa e o Tem Time em Casa.
// Em cada tela do fluxo confere:
//  - nada vaza pro lado (a pagina nao rola na horizontal)
//  - campo de texto com letra >= 16px (senao o iPhone da zoom ao tocar)
//  - area de toque dos botoes >= 24px (minimo da WCAG 2.2); abaixo de 40px vira aviso
//  - texto visivel com letra >= 10px (fora miniatura de carta e desenho)
//  - nenhum erro de JS
// Os prints ficam em testes/resultados/ux-*.png.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const TAMANHOS = [[360, 740], [375, 667], [390, 844]];
const avisos = new Map();

async function auditar(p, onde) {
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const visivel = (e) => { const s = getComputedStyle(e); const q = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && q.width > 0 && q.height > 0; };
    const nome = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')) + (e.textContent ? ` "${e.textContent.trim().slice(0, 24)}"` : '');
    // o que vaza: so conta quem esta fora de um pai que rola na horizontal (carrossel, tabela)
    const dentroDeRolagem = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
    const vaza = [...document.querySelectorAll('body *')].filter((e) => visivel(e) && !dentroDeRolagem(e) && e.getBoundingClientRect().right > vw + 1).map(nome).slice(0, 4);
    const rolaDeLado = document.scrollingElement.scrollWidth > vw + 1;
    const campos = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')].filter(visivel)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map(nome);
    const alvos = [...document.querySelectorAll('button, a[href], [role=button], input, select, summary')].filter(visivel).filter((e) => !e.disabled);
    const medir = (e) => { const q = e.getBoundingClientRect(); return Math.min(q.width, q.height); };
    const minusculos = alvos.filter((e) => medir(e) < 24 && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline')).map((e) => `${nome(e)} ${Math.round(medir(e))}px`);
    const pequenos = alvos.filter((e) => medir(e) >= 24 && medir(e) < 40 && e.tagName !== 'A').map((e) => nome(e).split(' ')[0]);
    // miniatura de carta e desenho (svg) ficam de fora: sao figuras, o texto delas e enfeite
    const letras = [...document.querySelectorAll('body *')].filter((e) => visivel(e) && !e.closest('.carta, svg') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 10).map((e) => `${nome(e)} ${getComputedStyle(e).fontSize}`);
    return { vaza, rolaDeLado, campos, minusculos, pequenos: [...new Set(pequenos)], letras: [...new Set(letras)].slice(0, 5) };
  });
  const problemas = [];
  if (r.rolaDeLado || r.vaza.length) problemas.push(`vaza pro lado: ${r.vaza.join(', ') || 'página rola na horizontal'}`);
  if (r.campos.length) problemas.push(`campo com letra < 16px (zoom no iPhone): ${r.campos.join(', ')}`);
  if (r.minusculos.length) problemas.push(`toque < 24px: ${r.minusculos.slice(0, 4).join(', ')}`);
  if (r.letras.length) problemas.push(`letra < 10px: ${r.letras.join(', ')}`);
  ok(!problemas.length, `${onde}${problemas.length ? ': ' + problemas.join(' | ') : ''}`);
  for (const x of r.pequenos) avisos.set(x, (avisos.get(x) || 0) + 1);
}

const b = await chromium.launch();
const erros = [];
for (const [w, h] of TAMANHOS) {
  const vp = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(`${vp} ${e.message}`));
  const foto = (n) => w === 360 ? p.screenshot({ path: `testes/resultados/ux-${n}.png` }) : null;

  // --- Prata da Casa
  await p.goto(BASE + '/prata-da-casa.html'); await p.waitForSelector('.pais'); await p.waitForTimeout(300);
  await auditar(p, `${vp} Prata: criar jogador`); await foto('prata-criar');
  await p.fill('#nome-camisa', 'Maximiliano'); await p.click('.pos-botao:text-is("CA")');
  await p.click('#confirmar-jogador'); await p.waitForTimeout(200);
  await auditar(p, `${vp} Prata: montar carta`); await foto('prata-carta');
  for (let i = 0; i < 40; i++) { const m = p.locator('.atributo-mais:not([disabled])').first(); if (!(await m.count())) break; await m.click(); }
  await p.click('#confirmar-carta'); await p.waitForTimeout(300);
  await auditar(p, `${vp} Prata: propostas`); await foto('prata-propostas');
  await p.locator('.proposta .botao').first().click(); await p.waitForTimeout(300);
  await p.click('#proxima');
  for (let k = 0; k < 12; k++) {
    await p.waitForFunction(() => !document.getElementById('proxima').hidden || document.querySelector('.evento-opcao:not([disabled])'), null, { timeout: 30000 });
    if (!(await p.evaluate(() => document.getElementById('proxima').hidden))) break;
    if (k === 0) { await auditar(p, `${vp} Prata: evento da temporada`); await foto('prata-evento'); }
    await p.locator('.evento-opcao:not([disabled])').first().click(); await p.waitForTimeout(200);
  }
  await auditar(p, `${vp} Prata: fim da temporada`); await foto('prata-temporada');
  await p.click('#tudo'); await p.waitForTimeout(150); await p.click('#tudo');
  await p.waitForSelector('#tela-fim:not([hidden])', { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(300);
  await auditar(p, `${vp} Prata: aposentadoria`); await foto('prata-fim');

  // --- Tem Time em Casa
  await p.goto(BASE + '/tem-time-em-casa.html'); await p.waitForTimeout(800);
  await auditar(p, `${vp} Tem Time: início`); await foto('temtime-inicio');
  await p.click('#comecar-draft'); await p.waitForTimeout(400);
  await auditar(p, `${vp} Tem Time: draft`); await foto('temtime-draft');
  for (let i = 0; i < 30 && !(await p.locator('#comecar-temporada').isVisible()); i++) { await p.locator('.opcao').first().click(); await p.waitForTimeout(400); }
  await auditar(p, `${vp} Tem Time: resumo do elenco`); await foto('temtime-resumo');
  await p.click('#comecar-temporada'); await p.waitForTimeout(500);
  await auditar(p, `${vp} Tem Time: temporada`); await foto('temtime-temporada');
  if (await p.locator('#aba-cal').isVisible()) { await p.click('#aba-cal'); await p.waitForTimeout(200); await auditar(p, `${vp} Tem Time: calendário`); await foto('temtime-cal'); }
  await ctx.close();
}
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
if (avisos.size) console.log('aviso: botões com toque entre 24 e 40px:', [...avisos.keys()].join(', '));
await b.close();
