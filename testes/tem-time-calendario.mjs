import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const erros=[]; p.on('pageerror', e => erros.push(e.message));
const ok = (cond, msg) => console.log(cond ? 'OK  ' : 'FALHA', msg);
await p.goto(BASE + '/tem-time-em-casa.html'); await p.waitForTimeout(1500);
await p.click('#comecar-draft'); await p.waitForTimeout(400);
for (let i=0;i<30 && !(await p.locator('#comecar-temporada').isVisible());i++){ await p.locator('.opcao').first().click(); await p.waitForTimeout(400); }
await p.click('#comecar-temporada'); await p.waitForTimeout(300); await p.click('#aba-cal');
const st = () => p.evaluate(() => ({ i: D.temp.i, prox: D.temp.etapas[D.temp.i]?.data, ultimoMeu: [...D.temp.historico].reverse().find(h=>h.doUsuario)?.etapa.data, mes: D.mes, animando: D.animando }));
// 1) dia futuro COM jogo meu, em outro mes
const alvo = await p.evaluate(() => Motor.agenda(D.temp, 400).find(a => a.etapa.data >= '2026-03-10' && a.jogo).etapa.data);
await p.evaluate((iso) => { D.mes = iso.slice(0,7); desenharCalendario(); }, alvo);
await p.click(`.cal-dia[aria-label^="${await p.evaluate(i=>dataJogo(i), alvo)}"]`); await p.waitForTimeout(100);
const botao = await p.locator('#cal-acao .botao-primario').textContent(); ok(/jogar/.test(botao), `botao do dia com jogo: "${botao}"`);
const visivelAntes = await p.locator('#jogo').boundingBox();
await p.locator('#cal-acao .botao-primario').click(); await p.waitForTimeout(6500);
let s = await st(); ok(s.ultimoMeu === alvo, `simular ate ${alvo} e jogar -> ultimo jogo meu ${s.ultimoMeu}`);
ok(s.prox > alvo, `proxima etapa depois do alvo (${s.prox})`);
const vis = await p.evaluate(() => { const r = document.getElementById('jogo').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
ok(vis, 'painel do jogo visivel durante/apos a animacao');
ok(await p.evaluate(() => D.visao === 'jogo'), 'calendario mandou pra aba Jogo a jogo pra assistir');
const mesCal = await p.evaluate(() => D.mes); ok(mesCal === (await st()).prox.slice(0,7), 'calendario acompanhou a simulacao (mes ' + mesCal + ')');
// 2) dia futuro SEM jogo meu
const livre = await p.evaluate(() => { const ocup = new Set(D.temp.etapas.map(e=>e.data)); let d = new Date(D.temp.etapas[D.temp.i].data+'T12:00:00'); d.setDate(d.getDate()+20); while (ocup.has(d.toISOString().slice(0,10))) d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); });
await p.evaluate((iso) => simularAteDia(iso), livre); await p.waitForTimeout(300);
s = await st(); ok(s.prox >= livre, `sem jogo: proxima etapa ${s.prox} >= ${livre}`);
const atras = await p.evaluate((iso) => D.temp.etapas.slice(D.temp.i).some(e => e.data < iso), livre); ok(!atras, 'nenhuma etapa antes do alvo ficou pra tras');
// 3) dia passado -> ver o jogo
const passado = s.ultimoMeu;
await p.click('#aba-cal'); await p.evaluate((iso) => { D.mes = iso.slice(0,7); D.diaSel = iso; desenharCalendario(); }, passado);
const txt = await p.locator('#cal-acao').textContent(); ok(/Ver o jogo/.test(txt), 'dia passado oferece Ver o jogo');
// 4) ate decisivo
await p.click('#aba-jogo');
await p.click('#ate-decisivo'); await p.waitForTimeout(400);
s = await st();
const dec = await p.evaluate(() => { const a = Motor.agenda(D.temp,1)[0]; return a && a.indice === D.temp.i && Motor.decisiva(D.temp.etapas[D.temp.i]); });
ok(dec || s.animando, 'ate o decisivo parou antes de um jogo decisivo (ou ja esta assistindo)');
await p.waitForTimeout(6000);
// 5) simular ate fim da copa do brasil
await p.selectOption('#sim-alvo', 'cdb'); await p.click('#sim-ir'); await p.waitForTimeout(6500);
// 6) data de novembro
const nov = await p.evaluate(() => (Motor.agenda(D.temp, 400).find(a => a.etapa.data >= '2026-11-01') || {}).etapa?.data);
if (nov) { await p.evaluate((iso) => simularAteDia(iso), nov); await p.waitForTimeout(6500); s = await st(); ok(s.ultimoMeu === nov || s.prox >= nov, `novembro ${nov}: ultimo meu ${s.ultimoMeu}`); }
// 7) simular tudo
await p.click('#simular-tudo'); await p.waitForTimeout(600);
ok(await p.evaluate(() => !document.getElementById('tela-fim').hidden), 'simular tudo chega no balanco');
ok(await p.evaluate(() => D.temp.i === D.temp.etapas.length), 'todas as etapas jogadas');
ok(erros.length === 0, 'sem erro de JS ' + JSON.stringify(erros));
await p.screenshot({ path: `testes/resultados/fim.png`, fullPage: true });
await b.close();
