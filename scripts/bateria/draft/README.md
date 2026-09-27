# Bateria do Tem Time em Casa (draft + temporada)

Roda milhares de tentativas completas do minigame no node, sem navegador. Cada tentativa tem um draft de 11 vagas e uma temporada inteira: Brasileirão, Copa do Brasil e Libertadores ou Sul-Americana.

Os scripts carregam o `app.js`, o `motor.js` e o `draft.js` **de verdade** num `vm` do node, com um DOM mínimo de mentira. O relatório com os resultados está em `docs/bateria-tem-time-em-casa.md`.

## Rodar (a partir da raiz do repo)

Requisito: node 22 (`source ~/.nvm/nvm.sh`). Não há dependências.

```bash
scripts/bateria/draft/rodar.sh                      # 5.000 tentativas, 4 processos, ~25 s
node scripts/bateria/draft/analisar.js              # métricas (posição, títulos, realismo, erros)
node scripts/bateria/draft/testes-ui.js             # testes das correções de UI do draft.js (12 checagens)
node scripts/bateria/draft/colisao.js               # clube com nome de convidado da Copa do Brasil
node scripts/bateria/draft/extras.js                # forças, time dos sonhos/pesadelo, expulsos, descanso, datas
scripts/bateria/draft/experimento.sh                # cenários de balanceamento (patch só em memória)
```

A saída vai para `${TMPDIR:-/tmp}/bateria-draft/`, fora do repo; o `.jsonl` tem ~40 MB. Para escolher outra pasta, use `SAIDA=<pasta>`. O `plano.json` é gerado pelo `plano.js` a cada rodada e não é versionado.

Para comparar duas versões do código, aponte `REPO_DIR` para uma cópia com `app.js`, `motor.js`, `draft.js` e `dados/`:

```bash
REPO_DIR=/tmp/antes  SAIDA=/tmp/b-antes  scripts/bateria/draft/rodar.sh
REPO_DIR=$PWD        SAIDA=/tmp/b-depois scripts/bateria/draft/rodar.sh
node scripts/bateria/draft/comparar.js /tmp/b-antes/tudo.jsonl /tmp/b-depois/tudo.jsonl
```

## Como funciona

- **`carregar.js`** executa os três arquivos do site num `vm`.
  - A única mudança, feita só em memória, é cortar a chamada final `iniciarDraft().catch(...)`.
  - O `Math.random` do contexto vira mulberry32 com semente. O mesmo gerador fica exposto como `api.random` para o harness.
  - `PATCH_MOTOR` e `PATCH_DRAFT` (JSON `[["de","para"],...]`) trocam trechos do código também só em memória. Servem para os experimentos.
- **`sim.js`** faz uma tentativa.
  - O draft usa as funções reais `sortearLeque`, `proximaVaga` e `cabeNaVaga`. O resto espelha `abrirLeque`, `escolher` e "Trocar o leque".
  - A temporada espelha `comecarTemporada` com as funções reais `serieAComUsuario` e `regrasComUsuario`. Depois roda `Motor.avancar` até o fim.
  - A cada etapa, checa: número de jogos por competição, 38 jogos por time, time contra si mesmo, time indefinido, NaN, dois jogos no mesmo dia, agregado e pênaltis, `Motor.agenda` batendo com quem jogou, se o clube do usuário é o draftado, e expulso que marca ou bate pênalti depois do vermelho.
  - O ⇄ (mudar de vaga) não é simulado.
- **`plano.js`** monta as 5.000 tentativas:
  - aleatório: 1.000;
  - maior nota do leque, 250 por esquema: 1.750;
  - pior nota do leque, 100 por esquema: 700;
  - maior nota usando a troca de leque: 300;
  - "humano" (70% a maior nota, 30% ao acaso): 250;
  - cada um dos 20 clubes como quem sai da Série A: 1.000.

  Libertadores e Sul-Americana ficam 50/50.
- **Semente** da tentativa `i`: `1000003*i+7`. Mesma semente, mesma tentativa: duas rodadas do mesmo código dão 5.000 de 5.000 iguais (confira com `comparar.js`).
- **Limite de CPU:** `rodar.sh` e `experimento.sh` sobem no máximo 4 processos.
