// Bateria de UX no celular (360x740, 375x667 e 390x844) pro Quem Tá em Casa?: carta, 6 dicas e campo na mesma tela.
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

const b = await chromium.launch(); const erros = [];
for (const [w, h] of TAMANHOS) {
  const vp = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => erros.push(e.message));
  const foto = (n) => p.screenshot({ path: `testes/resultados/ux-quem-${w}-${n}.png` });
  await p.goto(BASE + '/quem-ta-em-casa.html'); await p.waitForSelector('#form-inicio:not([hidden])'); await p.waitForTimeout(300);
  await auditar(p, `${vp} Quem Tá: início`); await foto('inicio');
  await p.click('#livre'); await p.waitForTimeout(300);
  await auditar(p, `${vp} Quem Tá: carta misteriosa`); await foto('jogo');
  for (let i = 0; i < 3; i++) { const id = await p.evaluate(() => J.opcoes.find((o) => o.id !== J.alvo.j.player_id && !J.chutes.some(c => (c.id ?? c) === o.id)).id); await p.evaluate((i) => chutar(i), id); await p.waitForTimeout(250); }
  await auditar(p, `${vp} Quem Tá: depois de 3 chutes`); await foto('chutes');
  await p.fill('#busca', 'Ga'); await p.waitForTimeout(200);
  await auditar(p, `${vp} Quem Tá: autocompletar aberto`); await foto('busca');
  await p.evaluate(() => scrollTo(0, 0)); const cabe = await p.evaluate(() => { const c = document.querySelector('#busca').getBoundingClientRect(); const d = document.querySelector('#dicas').getBoundingClientRect(); return c.bottom <= innerHeight && d.bottom <= innerHeight; });
  ok(cabe, `${vp} carta, 6 dicas e campo de chute na mesma tela`);
  await p.click('#desistir').catch(() => {}); await p.waitForTimeout(300);
  await auditar(p, `${vp} Quem Tá: fim`); await foto('fim');
  await ctx.close();
}
ok(!erros.length, 'sem erro de JS ' + erros.join(' | '));
if (avisos.size) console.log('aviso 24-40px:', [...avisos.keys()].join(', '));
await b.close();
