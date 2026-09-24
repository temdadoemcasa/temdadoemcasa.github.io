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
| `index.html` | home: topo (seleção), vídeos, cartas, "de onde vem" |
| `app.js` | lógica da home e peças comuns (carta, camisa, níveis, envelope); texto dos dados entra por `textContent`, nunca `innerHTML` |
| `draft.html`, `draft.js`, `draft.css` | minigame Draft: monta o time com figurinhas e joga a temporada 2026 |
| `motor.js` | simulação de jogos e temporada, sem DOM (roda no navegador e no node) |
| `dados/competicoes-2026.json` | regulamento e calendário (Brasileirão, Copa do Brasil, Libertadores, Sul-Americana) e força **estimada** dos estrangeiros; editado à mão |
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
niveis {madeira, tijolo, grafeno}      ← opcional
```

- **`niveis` (opcional):** overall mínimo de cada casa na temporada. Se vier,
  o site usa. Se não vier, calcula pela posição na liga (palha = 35% de
  baixo, madeira até 85%, tijolo até 98%, grafeno = 2% do topo), então a
  escala do modelo pode mudar sem quebrar nada.

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
- **Casas (nível):** cortes vêm de `niveis` no retrato ou da posição na liga
  (ver o contrato acima); a legenda das cartas mostra os números da temporada.
- **Envelope:** chance fixa por casa (palha 55%, madeira 38%, tijolo 6,5%,
  grafeno 0,5%), mostrada na página; `CHANCES` em `app.js`. O Draft usa a mesma.
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

## Draft (`draft.html`)

Cria o clube (nome, camisa, esquema), escolhe quem sai da Série A e se joga
Libertadores ou Sul-Americana; abre 5 figurinhas por vaga (GOL, LD, ZAG, LE,
VOL, MC, MEI, PD, PE, CA, alas) e joga a temporada em duas abas sincronizadas
(jogo a jogo e calendário).

- **Motor (`motor.js`):** gols ~ Poisson com ataque × defesa, mando, altitude,
  expulsão (muda a força dali pra frente) e pênalti. Esquema mexe em ataque e
  defesa (`Motor.TATICA`, calibrado à mão por enquanto).
- **Régua de força:** a Série A é convertida pela posição relativa na liga
  (desvios da média) pra mesma régua dos estrangeiros estimados, então o
  motor não depende da escala do overall.
- **Função do jogador:** os dados só têm G/D/M/F. Titular ganha a função pelo
  lugar na `escalacao_base`; reserva, pelo perfil dos eixos. Quando o futdata
  trouxer posição detalhada, trocar `inferirFuncoes` em `draft.js` pelo dado.
- **Testar o motor sem navegador:** `node -e "const M=require('./motor.js')…"`.
