# temdadoemcasa.github.io

Site do canal **Tem dado em casa**: a carta de cada jogador do Brasileirão, a
seleção da temporada e os vídeos. HTML, CSS e JS puros, sem build nem
framework, publicado pelo GitHub Pages a partir do `main` (push no `main` = site no ar em
~1 min).

Os números vêm do repositório privado `temdadoemcasa/futdata`: o site só lê
JSON e publica o que é **calculado** (percentil, overall). Nunca publica a
base bruta do Sofascore nem ratings do EA.

## Arquivos

| arquivo | o que é |
|---|---|
| `index.html` | página única: topo (seleção), vídeos, cartas, "de onde vem" |
| `app.js` | toda a lógica; texto dos dados entra por `textContent`, nunca `innerHTML` |
| `estilo.css` | tokens em `:root`, tema escuro |
| `dados/overalls-{ano}.json` | retrato da temporada, gerado por `futdata export-site` |
| `dados/temporadas.json` | anos no seletor, o primeiro é o padrão (`[2026, 2025, 2024]`) |
| `dados/videos.json` | vídeos do canal; atualizado pelo workflow `videos.yml` (RSS, diário) |
| `dados/uniformes.json` | camisa de cada clube; **editado à mão**, o pipeline não toca |

## Contrato de `dados/overalls-{ano}.json`

Pode ganhar campo novo; não pode remover nem renomear (o `app.js` depende).

```
temporada, gerado_em, populacao, piso_minutos, jogos_com_placar, jogos_esperados,
eixos {sigla: rótulo}, times[]
  time: team_id, nome, cor, uniforme {primaria, numero},
        escalacao_base {formacao, jogos, posicoes[{slot, x, y, player_id, vezes}]},
        jogadores[]
    jogador: player_id, nome, camisa, posicao (G/D/M/F), jogos, minutos,
             overall | null, eixos {…}, sem_nota_por | null
```

- **Eixos de linha:** `RIT FIN PAS DRI DEF FIS` (modelo v2). Retrato antigo
  com `VEL CHU CRI PAS DRI FOR DEF` é convertido no carregamento
  (`normalizarEixos` em `app.js`: VEL→RIT, CHU→FIN, média de PAS e CRI→PAS,
  FOR→FIS). **Goleiro:** `REF EVI MAO PES SAI`.
- Abaixo do piso de minutos: `overall: null` com o motivo em `sem_nota_por`,
  nunca zero. Eixo sem dado: ausente ou `null`, que aparece como "—".

## `dados/uniformes.json`

Chave = nome do time no retrato. Só cores e listras, sem escudo (marca
registrada). Time sem entrada sai com camisa lisa na cor do retrato.

```
lisa:        {"padrao": "lisa", "base": "#hex"}
vertical /
horizontal:  {"padrao": "vertical", "faixas": [["#hex", largura], ...]}
faixa-peito: {"padrao": "faixa-peito", "base": "#hex", "faixas": [["#hex", altura]], "inicio": 58}
diagonal:    {"padrao": "diagonal", "base": "#hex", "faixa": "#hex", "largura": 12}
opcionais:   "numero": "#hex", "gola": "#hex"
```

## Regras do que a página mostra

- **Seleção (topo):** 4-3-3 com o maior overall por posição (desempate por
  minutos), só quem tem nota. D é separado em lateral × zagueiro pelo `x` do
  jogador na `escalacao_base` do próprio time (lateral se x ≤ 0,3 ou ≥ 0,7);
  sem posição registrada, pode ocupar qualquer vaga. O melhor do meio e do
  ataque fica no centro. Acompanha a temporada escolhida.
- **Casas (nível):** palha < 50 ≤ madeira < 65 ≤ tijolo < 75 ≤ grafeno.
  Faixas pensadas para a escala de percentil; revisar quando o v2 publicar
  (no v2 o melhor jogador de linha vira 85).
- **Link direto para uma carta:** `…/#jogador-{player_id}` (vai na descrição do vídeo).

## Atualizar os dados

No `futdata` (ver o `SETUP.md` de lá):

```bash
futdata export-site --season 2026 --out ../temdadoemcasa.github.io/dados/overalls-2026.json
```

Um arquivo por temporada. Depois, commit e push no `main` deste repo. A Etapa
5 do plano do futdata automatiza isso pelo GitHub Actions.

## Ver localmente

```bash
python -m http.server 8000     # http://127.0.0.1:8000
```

`fetch` não funciona abrindo o `index.html` direto do disco (`file://`).
Para testar no celular sem aparelho, use um iframe de 390 px: o Edge/Chrome
headless tem largura mínima de janela (~500 px) e recorta o print, o que
parece um estouro lateral que não existe.
