# Bateria do Tem Time em Casa (draft + temporada)

Roda milhares de tentativas completas do minigame no node, sem navegador. Cada tentativa tem o draft (11 titulares e 5 reservas) e uma temporada inteira: Brasileirão, Copa do Brasil e Libertadores ou Sul-Americana, com lesões, suspensões, postura e janela.

Os scripts carregam o `app.js`, o `motor.js` e o `draft.js` **de verdade** num `vm` do node, com um DOM mínimo de mentira. O relatório com os números (fase 1 e fase 2) está em `docs/bateria-tem-time-em-casa.md`.

## Rodar (a partir da raiz do repo)

Requisito: node 22 (`source ~/.nvm/nvm.sh`). Não há dependências.

```bash
scripts/bateria/draft/rodar.sh                        # 5.000 tentativas, 4 processos, ~25 s
node scripts/bateria/draft/metas.js                   # metas da fase 2, uma linha PASS/FAIL cada
SEMENTE_BASE=777777 SAIDA=/tmp/b2 scripts/bateria/draft/rodar.sh && node scripts/bateria/draft/metas.js /tmp/b2/tudo.jsonl   # outro conjunto de sementes
node scripts/bateria/draft/esquemas.js 400            # meta 3: esquema ótimo por elenco (pontos esperados, sem sorteio)
scripts/bateria/draft/decisoes.sh 400                 # meta 4 por componente: postura, janela, esquema (pareado)
scripts/bateria/draft/dificuldade.sh normal           # afinar uma dificuldade (ao acaso, maior nota, inteligente)
node scripts/bateria/draft/extras.js                  # time dos sonhos/pesadelo, tempo das chances do resumo, desafio do dia
node scripts/bateria/draft/testes-ui.js               # 39 checagens de tela: trava, banco, janela, postura, desafio e o fluxo dos botões com cartão aberto (DOM falso)
node scripts/bateria/draft/janela.js 150              # janela de transferências: abre em toda temporada? quando? quantos usam?
node scripts/bateria/draft/estrela.js 40 50           # um concreto no lugar de um madeira: quanto mexe nas chances
node scripts/bateria/draft/decisivos.js 300 humano    # paradas "Até o próximo decisivo" por temporada, por competição e por mês
node scripts/bateria/draft/libertadores-prata.js 600   # Libertadores no mundo do Prata (calibragem padrão do motor)
node scripts/bateria/draft/emocao.js <tudo.jsonl>     # drafts com 2+ concretos e leques com tijolo+ (também sai no metas.js, grupo [E])
```

- A saída vai para `${TMPDIR:-/tmp}/bateria-draft/`, fora do repo. O `.jsonl` tem uns 5 MB. Para mudar a pasta, use `SAIDA=<pasta>`.
- Para rodar em outra cópia do site, use `REPO_DIR=<pasta com app.js, motor.js, draft.js e dados/>`.
- Para experimentar sem editar os arquivos (a troca vale só em memória):
  - `PATCH_MOTOR='[["de","para"]]'` troca texto no `motor.js`;
  - `PATCH_DRAFT` faz o mesmo no `draft.js`;
  - `PATCH_CALIB='{"K":22}'` mexe na calibragem `motor_ttc`.

## Como funciona

- **`carregar.js`** roda os três arquivos do site no `vm`.
  - Corta só a chamada final `iniciarDraft()`.
  - Troca o `Math.random` do contexto por um mulberry32 com semente. O mesmo gerador fica exposto como `api.random` para as políticas.
- **`sim.js`** faz uma tentativa.
  - O draft espelha "Montar meu time", `lequeAtual` e `escolher`, usando as funções reais `sortearLeque`, `lequeDaVaga`, `proximaVaga`, `encaixeNaVaga` e `forcaDoElenco`.
  - A temporada é `montarTemporada` + `Motor.avancar`, com as checagens a cada etapa: número de jogos, 38 por time, time contra si mesmo, NaN, dois jogos no mesmo dia, agenda × quem jogou, expulso que marca, dias seguidos.
  - Políticas de draft:
    - `aleatorio`;
    - `melhor`: maior nota do leque;
    - `pior`;
    - `humano`: 70% a maior nota, 30% ao acaso;
    - `inteligente`: maior força do time com a carta, contando encaixe, entrosamento, eixos e banco.
  - Políticas de temporada:
    - `padrao`: sempre Equilibrado, sem janela, sem trocar esquema. É o que "Simular tudo" faz.
    - `bom`: postura pelo contexto, janela no pior titular e o melhor esquema para o elenco.
    - `postura`, `janela`, `esquema` e `semEsquema`, para medir cada parte separada.
- **`domfalso.js`** é um DOM de mentira (elementos, classes, eventos, `querySelector` por classe). Com ele, `testes-ui.js` roda as funções de tela reais (`comecarTemporada`, `simular`, `proximoJogo`, os cartões e o balanço) sem navegador. É assim que o teste pega regressões como "Até o próximo decisivo parado com o cartão aberto".
- **`plano.js`** monta as 5.000 tentativas:
  - aleatório: 800;
  - maior nota: 1.000;
  - pior: 400;
  - inteligente: 900;
  - humano: 200;
  - temporada padrão × boa: 400 + 400, pareadas pela semente;
  - Fácil e Difícil × (ao acaso, maior nota): 225 cada.
- **Semente** da tentativa `i`: `SEMENTE_BASE + 1000003*i + 7` (o bloco pareado usa a semente do par). Mesma semente, mesma tentativa.
- **Limite de CPU:** todos os `.sh` sobem no máximo 4 processos.
