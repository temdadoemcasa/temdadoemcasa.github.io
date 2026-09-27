#!/usr/bin/env bash
# Bateria do Prata da Casa. As 5.000: 5 politicas x 1.000 (700 no modo completo
# + 300 no rapido), sementes fixas e pareadas entre politicas. Junto, fora das
# 5.000: a politica "estrategica" (1.000, mesmas sementes) e a "pior" (700 no
# completo), que medem o quanto as escolhas pesam. No maximo 4 processos.
# Saida: $BATERIA_OUT (padrao: $TMPDIR/bateria-prata-da-casa) -- fora do repo.
# Sementes: SEMENTE_C (completo, padrao 1) e SEMENTE_R (rapido, padrao 10001);
# o conjunto novo da fase 2 usa SEMENTE_C=20001 SEMENTE_R=30001.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${BATERIA_OUT:-${TMPDIR:-/tmp}/bateria-prata-da-casa}"
SC="${SEMENTE_C:-1}"; SR="${SEMENTE_R:-10001}"
mkdir -p "$OUT"
export BATERIA_OUT="$OUT"
{
  for pol in aleatoria gulosa cautelosa primeira impaciente estrategica; do
    echo "$pol completo $SC 700 $OUT/$pol-completo.jsonl"
    echo "$pol rapido $SR 300 $OUT/$pol-rapido.jsonl"
  done
  echo "pior completo $SC 700 $OUT/pior-completo.jsonl"
} | xargs -P 4 -L 1 sh -c 'node rodar.js "$0" "$1" "$2" "$3" "$4"'
node agregar.js
node metas.js "$OUT" "$OUT" > "$OUT/metas.md"
echo "metas: $OUT/metas.md"
