// Notebook de tela baixa (dono, 18/10: "tenho que ficar scrollando e isso ta ruim"): em 1366x657
// e 1280x633 (janela util de 1366x768 e 1280x720 com a barra do navegador) cada etapa do Prata
// cabe sem rolar a pagina e o botao principal fica a vista. Sem o bloco "notebook de tela baixa"
// do carreira.css, todas as etapas rolam (de 260 a 740 px a mais).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const b = await chromium.launch();
for (const [w, h] of [[1366, 657], [1280, 633]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(`${BASE}/prata-da-casa.html`); await p.waitForSelector('#confirmar-jogador:not([disabled])');
  const cabe = async (etapa, botao) => {
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(100);
    const m = await p.evaluate((botao) => {
      const fim = document.querySelector('main').getBoundingClientRect().bottom + scrollY;
      const bt = botao && document.querySelector(botao); const r = bt && bt.offsetParent ? bt.getBoundingClientRect() : null;
      return { fim: Math.round(fim), jan: innerHeight, botao: r ? Math.round(r.bottom) : null };
    }, botao);
    ok(m.fim <= m.jan + 2 && (m.botao === null || m.botao <= m.jan), `${w}x${h} ${etapa} cabe na tela (conteudo ${m.fim}, janela ${m.jan}${m.botao !== null ? `, botao ${m.botao}` : ''})`);
  };
  await cabe('criacao', '#confirmar-jogador');
  await p.fill('#nome-camisa', 'Teste'); await p.locator('[data-modo="completo"]').click(); await p.locator('#confirmar-jogador').click();
  await cabe('carta', '#confirmar-carta');
  await p.locator('#auto-pontos').click(); await p.locator('#confirmar-carta').click();
  await cabe('peneira', null);
  await p.locator('#propostas-base .proposta .botao-primario').first().click(); await p.waitForTimeout(300);
  await cabe('carreira', '#proxima');
  await p.locator('#proxima').click(); await p.waitForTimeout(1200);
  await cabe('temporada em andamento', null);
  await p.evaluate(() => { for (let i = 0; i < 8; i++) jogarTemporada(); C.eventos = null; C.ofertasAbertas = null; C.rolagem = null; document.getElementById('mercado').hidden = true; mostrarLinha(C.J.historico.at(-1)); desenharPainelJogador(); desenharTabelaCarreira(); });
  await p.waitForTimeout(300);
  await cabe('carreira de 9 anos', '#proxima');
  ok(!erros.length, `${w}x${h} sem erro de JS ${erros.slice(0, 2).join(' | ')}`);
  await p.close();
}
await b.close();
