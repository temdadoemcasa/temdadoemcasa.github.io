#!/usr/bin/env bash
# Experimentos de balanceamento (fora das 5.000): mesmo harness, com patch SO em memoria
# (PATCH_MOTOR / PATCH_DRAFT, ver carregar.js). 2.100 tentativas por cenario
# (aleatorio/melhor/pior x 7 esquemas), 4 processos. Saida em $SAIDA/exp/<cenario>.
set -e
cd "$(dirname "$0")"
[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null
SAIDA=${SAIDA:-${TMPDIR:-/tmp}/bateria-draft}
mkdir -p "$SAIDA/exp"
node -e '
const ESQ=["4-3-3","4-2-3-1","4-4-2","4-1-4-1","3-5-2","3-4-3","5-3-2"]; const p=[];
for (const pol of ["aleatorio","melhor","pior"]) for (let k=0;k<700;k++) p.push({bloco:pol,politica:pol,esquema:ESQ[k%7],continental:k%2?"sul":"lib"});
require("fs").writeFileSync(process.argv[1],JSON.stringify(p));' "$SAIDA/plano-exp.json"
run() { # $1 nome do cenario
  mkdir -p "$SAIDA/exp/$1"
  for s in 0 1 2 3; do node sim.js "$SAIDA/plano-exp.json" $((s*525)) $(((s+1)*525)) "$SAIDA/exp/$1/p$s.jsonl" & done; wait
  cat "$SAIDA/exp/$1"/p*.jsonl > "$SAIDA/exp/$1/tudo.jsonl"; rm -f "$SAIDA/exp/$1"/p*.jsonl
}
PATCH_MOTOR="[]" PATCH_DRAFT="[]" run base
PATCH_DRAFT='[["palha: 0.2, madeira: 0.45, tijolo: 0.28, grafeno: 0.07","palha: 0.55, madeira: 0.38, tijolo: 0.065, grafeno: 0.01"]]' run envelope
PATCH_MOTOR='[["const K = 27;","const K = 21;"],["const MEDIA_CASA = 1.24;","const MEDIA_CASA = 1.36;"],["const MEDIA_FORA = 0.96;","const MEDIA_FORA = 0.93;"]]' run motorB
PATCH_MOTOR='[["const K = 27;","const K = 21;"],["const MEDIA_CASA = 1.24;","const MEDIA_CASA = 1.36;"],["const MEDIA_FORA = 0.96;","const MEDIA_FORA = 0.93;"],["const REGUA = { media: 55.5, dp: 3.2 };","const REGUA = { media: 55.5, dp: 4.0 };"]]' run motorC
PATCH_MOTOR='[["{ mc *= 1.25; mf *= 0.85; }","{ mc *= 1.12; mf *= 0.92; }"]]' run altitude
node resumo-exp.js base envelope motorB motorC altitude
