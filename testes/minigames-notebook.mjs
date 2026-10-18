// Notebook de tela baixa (dono, 18/10): em 1366x657 e 1280x633 cada tela dos minigames cabe sem
// rolar a pagina e o botao principal fica a vista. O Top 10 roda com o ranking mais longo (12
// barras por empate). A temporada do Tem Time em Casa e um painel que cresce com o historico:
// la so o "Proximo jogo" precisa estar a vista. O Prata tem o teste dele (prata-notebook).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
const medir = async (p, rot, botao, { soBotao = false } = {}) => {
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(120);
  const m = await p.evaluate((botao) => {
    const fim = Math.round(document.querySelector('main').getBoundingClientRect().bottom + scrollY);
    const bt = botao && document.querySelector(botao); const r = bt && bt.offsetParent ? bt.getBoundingClientRect() : null;
    return { fim, jan: innerHeight, botao: r ? Math.round(r.bottom) : null };
  }, botao);
  ok((soBotao || m.fim <= m.jan + 2) && (m.botao === null || m.botao <= m.jan), `${rot} cabe (conteudo ${m.fim}, janela ${m.jan}${m.botao !== null ? `, botao ${m.botao}` : ''})`);
};
for (const [w, h] of [[1366, 657], [1280, 633]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  const v = `${w}x${h}`;
  // Top 10
  await p.goto(`${BASE}/top10-em-casa.html`); await p.waitForSelector('#form-inicio:not([hidden])');
  await medir(p, `${v} top10 inicio`, '#jogar-livre');
  await p.evaluate(() => { T.rankings = T.rankings.filter((x) => x.id === 'artilheiros-cl-2024'); });
  await p.locator('#jogar-livre').click(); await p.waitForSelector('#tela-jogo:not([hidden])');
  await medir(p, `${v} top10 partida (12 barras)`, '#desistir');
  await p.locator('#desistir').click(); await p.waitForSelector('#tela-fim:not([hidden])');
  await medir(p, `${v} top10 fim (12 barras abertas)`, '#outro');
  // Show do Dadao
  await p.goto(`${BASE}/show-do-dadao.html`); await p.waitForSelector('#form-inicio button[type=submit]');
  await medir(p, `${v} dadao inicio`, '#form-inicio button[type=submit]');
  await p.locator('#form-inicio button[type=submit]').click(); await p.waitForSelector('#tela-jogo:not([hidden])'); await p.waitForTimeout(400);
  await medir(p, `${v} dadao pergunta`, '#parar');
  // Maior ou Menor
  await p.goto(`${BASE}/maior-ou-menor.html`); await p.waitForSelector('#jogar-livre');
  await medir(p, `${v} maior-menor inicio`, '#jogar-livre');
  await p.locator('#jogar-livre').click(); await p.waitForTimeout(500);
  await medir(p, `${v} maior-menor partida`, '#menos');
  // Tem Time em Casa
  await p.goto(`${BASE}/tem-time-em-casa.html`); await p.waitForFunction(() => typeof D !== 'undefined' && D.r && document.querySelector('#padroes .chip'));
  await medir(p, `${v} tem-time criar o time`, '#comecar-draft');
  await p.locator('#comecar-draft').click(); await p.waitForSelector('#tela-draft:not([hidden])'); await p.waitForTimeout(300);
  await medir(p, `${v} tem-time draft`, '#trocar-leque');
  for (let i = 0; i < 60 && await p.locator('#tela-draft').isVisible(); i++) {
    const o = p.locator('#leque .opcao:not([disabled])').first();
    if (await o.count()) await o.click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(350);
  }
  await p.waitForSelector('#tela-resumo:not([hidden])', { timeout: 10000 }).catch(() => {});
  await medir(p, `${v} tem-time resumo`, '#comecar-temporada');
  await p.locator('#comecar-temporada').click(); await p.waitForTimeout(600);
  await medir(p, `${v} tem-time temporada (botao a vista)`, '#proximo', { soBotao: true });
  ok(!erros.length, `${v} sem erro de JS ${erros.slice(0, 2).join(' | ')}`);
  await p.close();
}
await b.close();
