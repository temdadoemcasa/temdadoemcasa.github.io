// Todo js/css que mudou na branch desde a base (merge-base com origin/main; em main, o commit anterior) precisa de ?v= novo em todo HTML que o usa:
// senao o cache HTTP do GitHub Pages serve o arquivo velho sob o HTML novo.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const git = (a) => execSync(`git ${a}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
// base = onde a branch saiu de main; rodando na propria main, o commit anterior. Sem historico (checkout raso) nao da pra comparar: FALHA.
function achaBase() {
  const head = git('rev-parse HEAD');
  for (const ref of ['origin/main', 'main']) {
    try { const mb = git(`merge-base HEAD ${ref}`); return mb === head ? git('rev-parse HEAD~1') : mb; } catch { /* tenta o proximo */ }
  }
  return null;
}
const BASE_GIT = achaBase();
if (!BASE_GIT) { ok(false, 'nao achei o commit base (checkout raso? use fetch-depth: 0)'); process.exit(0); }
console.log('base da comparacao:', BASE_GIT.slice(0, 7));
const refs = (html) => [...html.matchAll(/(?:src|href)="([^"#:?]+\.(?:js|css))\?v=([^"]+)"/g)].map((m) => [m[1], m[2]]);
let n = 0;
for (const pagina of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  let antes = [];
  try { antes = refs(execSync(`git show ${BASE_GIT}:${pagina}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* pagina nova na branch */ }
  for (const [arq, v] of refs(readFileSync(pagina, 'utf8'))) {
    let mudou = false;
    try { git(`diff --quiet ${BASE_GIT} HEAD -- ${arq}`); } catch { mudou = true; }
    if (!mudou) continue;
    n++;
    const vAntes = antes.find(([a]) => a === arq)?.[1];
    ok(vAntes === undefined || vAntes !== v, `${pagina}: ${arq} mudou na branch e o ?v= (${v}) e novo`);
  }
}
ok(n > 0, `conferiu ${n} referencias de arquivos alterados`);
