#!/usr/bin/env bash
# Bateria de 5.000 tentativas (draft + temporada), 4 processos no maximo.
#   REPO_DIR  pasta com app.js, motor.js, draft.js e dados/ (padrao: o repo, ../../..)
#   SAIDA     pasta de saida, fora do repo (padrao: ${TMPDIR:-/tmp}/bateria-draft)
set -e
cd "$(dirname "$0")"
[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null
SAIDA=${SAIDA:-${TMPDIR:-/tmp}/bateria-draft}
mkdir -p "$SAIDA"
node plano.js "$SAIDA/plano.json"
N=$(node -e 'console.log(require(process.argv[1]).length)' "$SAIDA/plano.json")
Q=$(( (N + 3) / 4 ))
for s in 0 1 2 3; do
  node sim.js "$SAIDA/plano.json" $((s*Q)) $(( (s+1)*Q < N ? (s+1)*Q : N )) "$SAIDA/parte$s.jsonl" &
done
wait
cat "$SAIDA"/parte*.jsonl > "$SAIDA/tudo.jsonl"
rm -f "$SAIDA"/parte*.jsonl
wc -l "$SAIDA/tudo.jsonl"
