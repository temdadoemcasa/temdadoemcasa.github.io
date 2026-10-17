// Toda liga publicada tem que vir do MESMO codigo de carta (campo `modelo`
// do export do futdata). Em 17/10 o goleiro +4 so estava no Brasileirão
// 2026 e as outras ligas seguiam no modelo de 04/10 -- o Maior ou Menor
// mostrava um numero e a carta outro. Teste de arquivo, sem navegador.
import { readdirSync, readFileSync } from 'node:fs';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const arquivos = readdirSync('dados').filter((f) => /^overalls-.*\.json$/.test(f)).sort();
const modelos = Object.fromEntries(arquivos.map((f) => [f, JSON.parse(readFileSync(`dados/${f}`, 'utf8')).modelo]));
ok(arquivos.length >= 7, `${arquivos.length} ligas publicadas`);
ok(Object.values(modelos).every((m) => typeof m === 'string' && m.length === 12), 'toda liga traz a impressao do modelo');
ok(new Set(Object.values(modelos)).size === 1, `todas do mesmo modelo: ${JSON.stringify(modelos)}`);
