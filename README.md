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
| `tem-time-em-casa.html`, `draft.js`, `draft.css` | minigame Draft: monta o time com figurinhas e joga a temporada 2026 |
| `quem-ta-em-casa.html`, `quem-ta.js`, `quem-ta.css` | minigame Quem Tá em Casa?: adivinha o jogador pela carta, 6 chutes, desafio do dia |
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
niveis {madeira, tijolo, concreto}     ← opcional (aceita "grafeno" no lugar de "concreto")
```

- **`niveis` (opcional):** overall mínimo de cada casa na temporada. Se vier,
  o site usa. Se não vier, calcula pela posição na liga (palha = 35% de
  baixo, madeira até 85%, tijolo até 98%, concreto = 2% do topo), então a
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
  concreto 1%), mostrada na página; `CHANCES` em `app.js`. O Tem Time em Casa usa chances
  próprias, mais generosas (palha 20%, madeira 45%, tijolo 28%, concreto 7%;
  `CHANCES_DO_LEQUE` em `draft.js`): com as do envelope, montar ao acaso caía na
  maioria das temporadas.
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

## Tem Time em Casa (`tem-time-em-casa.html`)

Cria o clube (nome, camisa, esquema), entra na Série A no lugar da Chapecoense e escolhe se joga
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

### Números da temporada (opcional)

Cada jogador pode trazer `numeros`, com o total da temporada no Brasileirão. Todos os campos são opcionais; o que não vier não aparece.

```json
"numeros": { "gols": 12, "assistencias": 5, "desarmes": 38, "interceptacoes": 21, "duelos_ganhos": 95,
             "dribles_certos": 30, "grandes_chances_criadas": 7, "defesas": 64, "jogos_sem_sofrer": 9,
             "passes_certos_pct": 88 }
```

Na carta, o rodapé troca os minutos pelos dois números da função do jogador: gols e assistências (centroavante, ponta, meia e meio-campo), desarmes e % de passes certos (volante), desarmes e assistências (lateral), desarmes e interceptações (zagueiro), jogos sem sofrer gol e defesas (goleiro). Na ficha aparecem todos os que vierem. São totais calculados, nunca a base bruta.

## Quem Tá em Casa? (`quem-ta-em-casa.html`)

Uma carta misteriosa e 6 chutes. Usa só as cartas de `dados/overalls-{ano}.json` e as da Europa listadas em `dados/retratos-europa.json` (`overalls-premier-league-2025.json`, `overalls-laliga-2025.json`, `overalls-champions-2025.json`, geradas por `futdata export-site --torneio 17|8|7`, na mesma régua do Brasileirão): nenhum número novo. Só esta página carrega os arquivos da Europa.

- **Sorteio:** carta com nota calculada e 1.500 minutos ou mais na temporada (menos que isso sorteia reserva); 900 na Champions, que tem no máximo 17 jogos. A partida livre filtra por liga (Tudo, Brasileirão, Europa).
- **Dicas, uma por erro:** liga, ano e posição (desde o início) → 2 maiores atributos → o resto e a seleção → overall → camisa e jogos → cores da camisa do clube (sem escudo). A seleção vem de `dados/paises.json` (`futdata export-paises`, do bruto de escalações do SofaScore, um mapa só pra todas as ligas); sem país no bruto, a dica diz "sem dado".
- **Cada chute errado** compara com o certo: mesmo clube, mesma posição, overall maior ou menor. Chute sem nota naquela temporada mostra "— OVR", nunca seta: ausência não é zero.
- **Vale o jogador**, em qualquer temporada ou liga. A carta do chute usada na comparação é a do mesmo retrato do alvo (liga e ano), senão a do mesmo ano, senão a mais nova.
- **Desafio do dia:** só sorteia temporada fechada (`FASES_DO_DESAFIO`: liga nova entra a partir de uma data, nunca no meio do dia; desde 01/10 Brasileirão 2024 e 2025, Premier, LaLiga e Champions 25/26), porque o retrato da temporada em andamento muda toda semana e o jogador do dia mudaria junto. O pool é embaralhado uma vez com semente fixa e o desafio N pega a posição N: não repete até passar por todos. Uma tentativa por dia (`localStorage`); compartilhar sai em quadradinhos (🟩 acertou, 🟨 mesmo clube e posição, 🟥 errou, ⬜ não usou).
- **Testes:** `node testes/rodar.mjs quem-ta`.

## Pacote de craque (home, ao lado do campinho)

Só pela resenha: três cliques rasgam o pacote e sai UMA carta 83+, do Brasileirão (2024 a 2026) ou da Europa (`dados/retratos-europa.json`, carregado no primeiro clique). Só quem passou do piso de minutos da liga; a melhor carta de cada jogador, chance igual pra cada um, e o pool aparece escrito embaixo. Teste: `node testes/rodar.mjs pacote-craque`.
