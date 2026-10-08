# RETOMAR — minigames

## 04/10 -- bateria de UX de 4.000 casos por jogo + 5º minigame (Top 10 em Casa)

Contexto completo no `RETOMAR.md` do futdata (seção 04/10). Resumo:
- Branch base `bateria-ux-4k` (= main cc62578). Branches por jogo (locais, worktrees em /tmp): `ux4k-prata`, `ux4k-dadao`,
  `ux4k-draft`, `ux4k-quemta`. Cada uma cria `testes/bateria-ux-<jogo>.mjs` (`CASOS=4000` = cheia; default curto pro CI),
  corrige o que achou (com prova por mutação) e deixa o jogo mais positivo, sem mexer em balanceamento.
- Próximo passo: juntar as 4 em `bateria-ux-4k`, trocar os `?v=`, `node testes/rodar.mjs` verde, PR pro main (conta temdadoemcasa).
- Top 10 em Casa: dados gerados no futdata (`futdata export-top10` → `dados/top10.json`); páginas `top10-em-casa.html`,
  `top10.js`, `top10.css` ainda por fazer (Tasks 5–8 do plano no futdata).


Atualizado em **2026-09-27 (noite)**. Branch `prata-evolucao-e-caminho` (saiu de `integracao-main`), no GitHub, **não está no `main`**.

## Quem Tá em Casa? e pacote de craque (30/09) -- no ar

- **Quem Tá em Casa?** (`quem-ta-em-casa.html`, `quem-ta.js`, `quem-ta.css`): carta misteriosa, 6 chutes. Liga/ano/posição
  abre desde o início; cada erro SORTEIA uma de 6 dicas (seleção, ranking na posição (pelo overall, na liga e ano da carta), 2 maiores atributos, overall,
  número e jogos, cores do clube com a cor do número), com animação de dado no cartão. No desafio do dia a ordem
  vem da semente da data (`ordemDoDia`), igual pra todo mundo. Desafio a partir de 02/10: 3 de 5 dias Brasileirão,
  Europa só `GRANDES_DA_EUROPA` ou 84+, uma carta por jogador. A partir de 05/10: só carta 83+ (`OVERALL_MINIMO`), no desafio e na partida livre. Chute compara clube, posição, seleção e overall (01/10). Chute
  errado compara clube, posição e overall (sem nota = "— OVR"). Desafio do dia (só temporada fechada, liga nova entra
  por data em `FASES_DO_DESAFIO`), partida livre com filtro Tudo/Brasileirão/Europa. Cartas: Brasileirão 2024-2026,
  Premier, LaLiga e Champions 25/26 (`dados/retratos-europa.json`). Teste: `testes/quem-ta.mjs` (45 checagens; 9
  mutações pegas na 1ª versão).
- **Pacote de craque** (home, à esquerda do campinho): uma carta 83+ do Brasileirão ou da Europa. `testes/pacote-craque.mjs`.
- **Home:** os 4 minigames em grade 2x2; depois vídeos; depois seleção (pacote + campinho).
- **Desafio desde 02/10:** uma carta por jogador, Europa só de clube grande (`GRANDES_DA_EUROPA`) ou carta 84+, 3 de 5
  dias do Brasileirão (`PADRAO_DO_DESAFIO`).
- **Ligue 1 25/26 (01/10):** só na partida livre (`retratos-europa.json`); fora do desafio até o dono decidir as cartas
  (Lens acima do PSG campeão) e a recalibração da Série A pela EA. Entrar no desafio = fase nova com data futura.
- **Próximo:** Bundesliga e Serie A ITA quando o futdata coletar: exportar, pôr em `retratos-europa.json`, rodar
  `export-paises`; no desafio, só por fase nova (data futura) em `FASES_DO_DESAFIO`.
- **Pendente com o dono:** Champions tem notas espremidas (máx. 17 jogos; Kairat média 73,6 > Wolves 67,6); sorteio da
  Champions usa piso de 900 min (76 cartas).

## Show do Dadão: frase da resposta (29/09)

- Cada pergunta tem o campo `r`: uma frase de resenha sobre a resposta certa (aparece no carregamento se acertou e na tela final se errou; a curiosidade `x` continua embaixo).
- **A fonte do banco com as frases é `~/Documents/temdadoemcasa/show-do-dadao/perguntas.json`.** Quem for editar/adicionar perguntas parte dela e roda `python3 scripts/perguntas.py codificar <ela>`; gerar a partir de uma fonte sem `r` apaga as frases do site.
- Pergunta nova precisa de `r` (até 180 caracteres, validado pelo script): piada ou referência, nada de citação inventada, número só conferido.

## Junção com o `main` (feita em 27/09, noite)

O `main` tinha recebido os PRs #33–#38 de outra sessão em paralelo. O merge resolveu 23 conflitos no `carreira.js`:

- **Evolução:** fica a curva desta branch (94% do caminho até os 24) **com** o bônus de desempenho (#36) e o fator de liga A 1,3 · B 1,1 · C 0,9 · D 0,75 (#37) por cima; a ladeira depois do pico é a desta branch.
- **Lances:** centros e `chanceLance` desta branch + `emCampo`, `fezGol` e `deuAssist` do `main`.
- **Pedir titular:** a fórmula do `main` (#37) + "clube que pediu você não retira a proposta"; titular prometido usa `J.efeito.titular` do `main` (#33), também na bateria.
- Janela do clube: fica o sistema de contratos desta branch.
- `?v=` de todas as páginas: `2026-09-27j`.
- "O banco te chama → Pendura e assume" virou dominante com o merge: quem ainda é titular agora perde minutos no último ano.

Depois do merge: bateria do Prata com todas as metas PASSA; auge aleatório 13,3 / 8,4 / 5,1% (88–90 / 91–93 / 94+), estratégica 20,6 / 12,7 / 9,4%; aos 24 (potencial 83–88) 84 aleatório, 86 estratégica. Draft: 50 testes de tela ok; bateria com as mesmas 4 metas em FAIL de antes (17º 39,5 pts, ranking do inteligente, maior nota 21,8%, decisões +19 pp), não mexidas.

## O que esta branch fez (7 commits)

### Prata da Casa
- **Crescimento:** 94% do caminho até o potencial aos 24 (goleiro 26); o resto devagar até o pico. Aos 24, potencial 83–88 dá 83 no aleatório e 86 jogando bem (antes 79/81).
- **Carta equilibrada** (pedido do dono): atributo no máximo OVR + 8 ao subir; na queda, o que passa de OVR + 6 cai primeiro. Nenhuma carta passa de OVR + 7 do auge ao fim (antes até +17).
- **Caminho:** destaque na B/C/D (nota ≥ 7, ou garoto titular com nota ≥ 6,7) vai direto pra Série A; clube pequeno vende quem sobe depois de ano bom (70%). Porta da Europa: OVR 82 (20–24) ou 84 (18–19).
- **Potencial vira promessa:** escorrega 0,8/ano até os 24 se as escolhas não compensam (−6 a +2 do sorteado). Faixas: 76–84 58%, 85–89 24,5%, 90–92 12%, 93–95 4%, 97–99 1,5%.
- **Metas do auge (dono, 27/09):** jogando sério 94+ ~6–8%, 91–93 ~13%, 88–90 ~17%; aleatório 94+ ~5%. Medido: estratégica 9,6 / 12,4 / 20,1%; aleatória 4,9 / 5,3 / 15,1%.
- **Bola de Ouro:** abaixo de 94–95, cada Bola já ganha pesa na próxima (auge 91–93: no máximo 2). 94+ segue "adoidado" (média 5,4, máx 11).
- **Veterano:** carreira até os 40 (goleiro 42), sem aposentadoria sorteada; botão **Pendurar as chuteiras** a partir dos 34 (dois toques). Queda: até 1/ano depois do pico, 1–2/ano a partir dos 34. Veterano na Europa (34+, OVR < 90): clube não renova, tenta revender, proposta garantida de clube brasileiro, reserva só por um ano. Na Europa aos 35: 24%; aos 36: 8%.
- **Lances:** dificuldade pela força da liga (`chanceLance`) só nos lances de jogo (e no clássico).
- Bateria: todas as metas PASSA (`scripts/bateria/prata/metas.js`); política da bateria pendura a partir dos 34 (mediana 36).

### Tem Time em Casa (draft)
- Você escolhe a vaga: toque na vaga vazia abre o leque dela; toque no jogador e no destino muda de posição (ou troca dois que cabem na vaga um do outro).
- **Fim do roubo** (ir e voltar com o ⇄ refazia o leque): cada vaga sorteia UMA vez no draft; a vaga que esvazia volta com o que sobrou do leque dela. Teste em `testes-ui.js` (falha com o código antigo).

### Tem Time em Casa: placar crível (06/10)
- Dono reclamou de agregado de 12 a 0 e 13 a 0 contra Criciúma e Puerto Cabello. `motor_ttc.folga = [3, 0.5]`: quem já
  ganha por 3 tira o pé (cada gol a mais sai com 50%); `casa`/`fora` subiram (1,32 / 1,015) pra manter ~2,38 gols/jogo.
  `scripts/bateria/draft/goleadas.js`: saldo 8+ num mata-mata 11,7% → ~7% das temporadas; 5+ de diferença 1,5% → 0,6%.
  Metas: mesmas 7 FAIL de antes em número (fácil e difícil passaram; normal/inteligente 28,4 → 27,8%, na borda).
- `motor.js` também aceita `satura` (tanh na diferença de força), testado e NÃO usado (tirava gol demais contra time fraco).
- Janela de transferências no celular: grade alinhada (titulares/banco), setor colorido, selo no titular mais fraco.
- `scripts/bateria/package.json` = commonjs (o `package.json` da raiz é module, dos testes Playwright) e o registro do
  service worker no `app.js` checa `navigator`: as duas coisas tinham quebrado a bateria no node.

## Decisões com o dono (pendentes)

1. ✅ **(feito 08/10: rende 0,5 e teto +6; inteligente campeão ~44,6%, maior nota ~31%, ao acaso igual)** **Freios do time montado** (`draft.js:611`): um onze de média 85 empata com Palmeiras (83,7) e Flamengo (84,1) porque (a) time novo −1,4 de entrosamento, (b) o que passa do elenco mais forte da CPU rende 25%, (c) teto ~+3 sobre o clube mais forte. Proposta: rende 50% e teto +6 → quem monta bem vai de ~31% pra ~40–45% de título brasileiro. Dono disse "show" — confirmar antes de mexer.
2. ✅ **(feito 08/10: `motor_ttc.estrangeiros` 3,1 → 1,2; brasileiro campeão 87,9% sem você, argentino segue o principal rival)** **Libertadores:** hoje 78,7% de campeão brasileiro (meta atual 75–80; real 2019–2025: 7 de 7). Proposta: ~88%, tirando parte do +3,1 que soma em todo estrangeiro (`dados/competicoes-2026.json`, `estrangeiros`).
3. **Fluminense campeão 3 vezes seguidas:** na bateria o Flu leva o BR em 8,7% (Fla 29,9%, Pal 25,3%). Perguntar se o dono estava no **desafio do dia** (mesma semente o dia todo, temporada repete de propósito). Se não, investigar.
4. Zebras medidas (não mexer sem pedido): 3º mais forte fora x Remo em mata-mata perde 15%, por 2+ 3,5% (Brasileirão real top-4 fora x Z4: 11% / 6,8%, 44 jogos); seu time em casa x Junior perde 12%.
