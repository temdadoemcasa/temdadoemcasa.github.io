// Todo js/css que mudou na branch desde a base (cc62578) precisa de ?v= novo em todo HTML que o usa:
// senao o cache HTTP do GitHub Pages serve o arquivo velho sob o HTML novo.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const ok = (c, m) => console.log(c ? 'OK  ' : 'FALHA', m);
const BASE_GIT = 'cc62578';
const git = (a) => execSync(`git ${a}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const refs = (html) => [...html.matchAll(/(?:src|href)="([^"#:?]+\.(?:js|css))\?v=([^"]+)"/g)].map((m) => [m[1], m[2]]);
let n = 0;
for (const pagina of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  let antes = [];
  try { antes = refs(git(`show ${BASE_GIT}:${pagina}`)); } catch { /* pagina nova na branch */ }
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
