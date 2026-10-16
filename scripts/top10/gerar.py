"""Gera dados/top10.json: rankings de futebol "acertaveis" pro Top 10 em Casa.

Fontes (nada inventado, cada ranking diz de onde veio):
- Wikipedia: Bola de Ouro, Troféu Yashin, Troféu Kopa e artilharia do Brasileirão
  (tabelas das paginas em ingles, guardadas em cache).
- Transfermarkt (dcaribou/transfermarkt-datasets, CC0, a copia do futdata):
  artilharia das ligas europeias e da Champions (appearances), jogadores mais
  valiosos numa data (player_valuations) e transferencias mais caras (transfers).

Uso (com o ambiente do futdata, que tem duckdb, bs4 e requests):
  uv run --project ~/Documents/brenisio/futdata python scripts/top10/gerar.py \
      --tm ~/Documents/brenisio/futdata/data/externo/transfermarkt \
      --cache ~/Documents/temdadoemcasa/top10-cache --out dados/top10.json

Cada ranking traz o primeiro colocado esperado: se a fonte mudar ou o parser
errar a tabela, o script para em vez de publicar ranking torto.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
from pathlib import Path

import duckdb
import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from paises import iso_do_pais  # noqa: E402
from topicos import TOPICOS  # noqa: E402

# o Transfermarkt veio sem cidadania pra esses (conferido na pagina do jogador)
PAIS_MANUAL = {28021: "si"}  # Samir Handanovic, Eslovenia
# nome na Wikipedia -> id no Transfermarkt, quando o nome nao bate
APELIDOS = {"Dani Carvajal": 138927, "Álex Grimaldo": 193082, "José Manuel López": 844797}
UA = {"User-Agent": "temdadoemcasa-top10/1.0 (https://temdadoemcasa.github.io)"}
MAX_COM_EMPATE = 12


class Problema(Exception):
    """Ranking que nao passa nas travas: o gerador junta todos e para."""  # empate no 10o entra junto; mais que isso o ranking nao serve


def normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]", "", t.replace("-", " ")).strip()


# --- Transfermarkt -----------------------------------------------------------

class TM:
    def __init__(self, pasta: Path):
        self.c = duckdb.connect()
        for nome in ["players", "clubs", "appearances", "games", "player_valuations", "transfers"]:
            self.c.execute(f"create view {nome} as select * from read_csv_auto('{pasta / (nome + '.csv.gz')}', all_varchar=false)")
        self.jog = {r[0]: r for r in self.c.execute(
            "select player_id, name, country_of_citizenship, position, sub_position, date_of_birth, highest_market_value_in_eur from players").fetchall()}
        self.clubes = dict(self.c.execute("select club_id, name from clubs").fetchall())

    def pais(self, pid):
        return PAIS_MANUAL.get(pid) or iso_do_pais(self.jog[pid][2])

    def clube(self, cid, nome_bruto=None):
        return limpar_clube(self.clubes.get(cid) or nome_bruto or "")

    def artilheiros(self, comp, temporada):
        linhas = self.c.execute("""
            with gols as (
              select a.player_id, sum(a.goals) gols, arg_max(a.player_club_id, a.date) clube
              from appearances a join games g using (game_id)
              where a.competition_id = ? and g.season = ?
              group by 1)
            select player_id, gols, clube from gols where gols > 0 order by gols desc, player_id""", [comp, temporada]).fetchall()
        return [{"tm": p, "valor": int(g), "clube": self.clube(c)} for p, g, c in linhas]

    def valiosos(self, data, filtro):
        # valor mais recente ate a data, so de quem foi avaliado nos 12 meses antes (aposentado nao conta)
        linhas = self.c.execute("""
            select player_id, arg_max(market_value_in_eur, date) valor, arg_max(current_club_id, date) clube,
                   arg_max(current_club_name, date) nome_clube
            from player_valuations
            where date <= ?::date and date > ?::date - interval 365 day
            group by 1 order by valor desc, player_id""", [data, data]).fetchall()
        saida = []
        for p, v, c, nc in linhas:
            j = self.jog.get(p)
            if not j or not filtro(j, data):
                continue
            # current_club_id na tabela de valores e o clube de HOJE; o nome e o da epoca
            saida.append({"tm": p, "valor": int(v), "clube": limpar_clube(nc)})
            if len(saida) >= 40:
                break
        return saida

    def transferencias(self, temporada):
        linhas = self.c.execute("""
            select player_id, max(transfer_fee) fee, arg_max(to_club_id, transfer_fee), arg_max(to_club_name, transfer_fee)
            from transfers where transfer_season = ? and transfer_fee > 0
            group by 1 order by fee desc, player_id limit 40""", [temporada]).fetchall()
        return [{"tm": p, "valor": int(f), "clube": self.clube(c, n)} for p, f, c, n in linhas]

    def clubes_de(self, pid):
        nomes = self.c.execute("select distinct current_club_name from player_valuations where player_id = ?", [pid]).fetchall()
        return {normalizar(limpar_clube(n)) for (n,) in nomes if n} | {normalizar(n) for (n,) in nomes if n}

    def achar(self, nome, pais_iso=None, clube=None):
        """id do Transfermarkt pelo nome (Wikipedia -> TM). Sem par: None.
        Homonimo ("Pedro", "Wesley"): fica quem passou pelo clube da tabela, depois o do pais."""
        alvo = normalizar(nome)
        cands = [p for p, j in self.jog.items() if normalizar(j[1]) == alvo]
        if not cands:  # "Son Heung-min" x "Heung-min Son": mesmas palavras, outra ordem
            chave = sorted(alvo.split())
            cands = [p for p, j in self.jog.items() if sorted(normalizar(j[1]).split()) == chave]
        if len(cands) > 1 and clube:
            alvo_clube = normalizar(limpar_clube(clube))
            no_clube = [p for p in cands if any(alvo_clube in c or (c and c in alvo_clube) for c in self.clubes_de(p))]
            cands = no_clube or cands
        if len(cands) > 1 and pais_iso:
            cands = [p for p in cands if self.pais(p) == pais_iso] or cands
        if len(cands) > 1:  # homonimo: o mais famoso
            cands.sort(key=lambda p: -(self.jog[p][6] or 0))
        return cands[0] if cands else None


# nome curto, do jeito que o torcedor fala (o Transfermarkt usa o nome oficial)
CLUBES_CURTOS = {
    "Paris Saint-Germain Football Club": "PSG", "Paris Saint-Germain": "PSG", "Manchester City Football Club": "Manchester City",
    "Real Madrid Club de Fútbol": "Real Madrid", "Futbol Club Barcelona": "Barcelona", "FC Barcelona": "Barcelona",
    "FC Bayern München": "Bayern", "Bayern Munich": "Bayern", "Inter Milan": "Inter", "Football Club Internazionale Milano S.p.A.": "Inter",
    "Club Internacional de Fútbol Miami": "Inter Miami", "Associazione Sportiva Roma": "Roma", "Società Sportiva Lazio": "Lazio",
    "SSC Napoli": "Napoli", "Atalanta BC": "Atalanta", "ACF Fiorentina": "Fiorentina", "AC Milan": "Milan", "Genoa CFC": "Genoa",
    "US Salernitana 1919": "Salernitana", "US Sassuolo": "Sassuolo", "Spezia Calcio": "Spezia", "Torino FC": "Torino",
    "Atlético Madrid": "Atlético de Madrid", "CA Osasuna": "Osasuna", "RCD Espanyol Barcelona": "Espanyol", "RCD Mallorca": "Mallorca",
    "Real Betis Balompié": "Betis", "Deportivo Alavés": "Alavés", "Celta de Vigo": "Celta", "Villarreal CF": "Villarreal",
    "Bayer 04 Leverkusen": "Bayer Leverkusen", "TSG 1899 Hoffenheim": "Hoffenheim", "1.FSV Mainz 05": "Mainz", "FC Augsburg": "Augsburg",
    "LOSC Lille": "Lille", "Olympique Lyon": "Lyon", "Olympique Marseille": "Olympique de Marseille", "OGC Nice": "Nice",
    "FC Metz": "Metz", "FC Toulouse": "Toulouse", "Stade Rennais": "Rennes", "AS Monaco": "Monaco", "RC Lens": "Lens",
    "SL Benfica": "Benfica", "FC Porto": "Porto", "Al-Hilal Saudi": "Al-Hilal", "Al-Hilal SFC": "Al-Hilal", "Al-Nassr FC": "Al-Nassr",
    "Al-Ittihad Club": "Al-Ittihad", "AFC Bournemouth": "Bournemouth", "Wolverhampton Wanderers": "Wolverhampton",
    "Red Bull Salzburg": "Salzburg", "Tottenham Hotspur": "Tottenham", "Newcastle United": "Newcastle", "West Ham United": "West Ham",
    "Brighton & Hove Albion": "Brighton", "Ajax Amsterdam": "Ajax", "PSV Eindhoven": "PSV",
}


def limpar_clube(nome: str) -> str:
    nome = re.sub(r"\[.*?\]", "", nome).strip()
    if nome in CLUBES_CURTOS:
        return CLUBES_CURTOS[nome]
    for sufixo in [" Football Club", " FC", " F.C.", " CF", " SAD", " S.A.D.", " S.p.A."]:
        if nome.endswith(sufixo):
            nome = nome[: -len(sufixo)]
    return CLUBES_CURTOS.get(nome, nome)


# --- Wikipedia ---------------------------------------------------------------

def pagina(titulo: str, cache: Path) -> BeautifulSoup:
    arq = cache / (re.sub(r"[^A-Za-z0-9]+", "_", titulo) + ".html")
    if not arq.exists():
        r = requests.get("https://en.wikipedia.org/api/rest_v1/page/html/" + requests.utils.quote(titulo.replace(" ", "_")), headers=UA, timeout=30)
        r.raise_for_status()
        arq.write_text(r.text)
    return BeautifulSoup(arq.read_text(), "lxml")


def celula(c, coluna: str) -> dict:
    """Texto da celula + o que a tabela diz alem dele: bandeira (flagicon) e link do jogador."""
    bandeira = c.select_one("span.flagicon a[title]")
    links = [a for a in c.find_all("a") if not a.find_parent("span", class_="flagicon") and a.get_text(strip=True)
             and not a.get_text(strip=True).startswith("[") and not a.find_parent("sup")]
    texto = re.sub(r"\[.*?\]", "", c.get_text(" ", strip=True)).strip()
    if "club" in coluna and len(links) > 1:  # mais de um clube na temporada: vale o ultimo
        texto = links[-1].get_text(strip=True)
    return {"texto": texto, "pais": bandeira["title"] if bandeira else None,
            "link": links[0].get("href", "").lstrip("./") if links else None}


def tabela_ranking(soup: BeautifulSoup, primeiro: str):
    """A tabela cujo 1o colocado e `primeiro`, como lista de {coluna: celula}.
    Linha de empate (rowspan) herda posicao e valor de cima."""
    for tb in soup.find_all("table"):
        linhas = tb.find_all("tr")
        if not linhas:
            continue
        cab = [c.get_text(" ", strip=True).lower() for c in linhas[0].find_all(["th", "td"])]
        if not cab or "player" not in " ".join(cab):
            continue
        dados, pendente = [], {}
        for tr in linhas[1:]:
            celulas = tr.find_all(["td", "th"])
            if not celulas:
                continue
            linha, i, col = {}, 0, 0
            # reconstroi a grade respeitando os rowspan de cima
            while i < len(celulas) or col in pendente:
                if col in pendente:
                    info, resta = pendente[col]
                    linha[col] = info
                    if resta <= 1:
                        del pendente[col]
                    else:
                        pendente[col] = (info, resta - 1)
                else:
                    c = celulas[i]
                    i += 1
                    linha[col] = celula(c, cab[col] if col < len(cab) else "")
                    span = int(c.get("rowspan", 1) or 1)
                    if span > 1:
                        pendente[col] = (linha[col], span - 1)
                col += 1
            dados.append({cab[k]: v for k, v in linha.items() if k < len(cab)})
        jogador = next((c for c in cab if "player" in c), None)
        if dados and jogador in dados[0] and normalizar(dados[0][jogador]["texto"]) == normalizar(primeiro):
            return cab, dados
    raise Problema(f"tabela com {primeiro!r} em 1o nao encontrada")


def passou_pelo_clube(tm: TM, pid, clube: str) -> bool:
    alvo = normalizar(limpar_clube(clube))
    return any(alvo in c or (c and c in alvo) for c in tm.clubes_de(pid))


def ranking_wiki(tm: TM, cache: Path, t: dict):
    cab, dados = tabela_ranking(pagina(t["pagina"], cache), t["primeiro"])
    col = lambda *nomes: next((c for c in cab if any(n in c for n in nomes)), None)
    cp, cj, cn, cc, cv = col("rank"), col("player"), col("national", "nation"), col("club"), col("points", "goals")
    saida = []
    for d in dados:
        pos = d.get(cp, {}).get("texto", "")
        if not re.fullmatch(r"=?\d+", pos):
            continue
        j = d[cj]
        nome = j["texto"]
        clube = d[cc]["texto"] if cc in d else ""
        pais = iso_do_pais(d[cn]["texto"]) if cn in d else iso_do_pais(j["pais"])
        pid = APELIDOS.get(nome) or tm.achar(nome, pais, clube or None)
        if pid is not None and t.get("checar_clube") and clube and not passou_pelo_clube(tm, pid, clube):
            pid = None  # homonimo de outro clube: o certo nao esta no Transfermarkt
        item = {"pos_fonte": int(pos.lstrip("=")), "clube": limpar_clube(clube) or None,
                "valor": int(re.sub(r"\D", "", d[cv]["texto"])) if cv in d and re.search(r"\d", d[cv]["texto"]) else None}
        if pid is not None:
            saida.append(item | {"tm": pid, "pais": pais})
        elif j["link"] and pais:
            # fora do Transfermarkt: identidade pelo link da Wikipedia, bandeira da propria tabela
            saida.append(item | {"tm": "w:" + j["link"], "nome": nome, "pais": pais})
        else:
            raise Problema(f"sem par no Transfermarkt nem link/bandeira na Wikipedia: {nome!r} (ponha em APELIDOS)")
    return saida


# --- montagem ----------------------------------------------------------------

def cortar_top10(lista, *, pos_da_fonte=False):
    """Top 10 com empate no 10o lugar entrando junto (posicao compartilhada)."""
    saida = []
    for i, item in enumerate(lista):
        pos = item["pos_fonte"] if pos_da_fonte else (saida[-1]["pos"] if saida and item["valor"] == saida[-1]["valor"] else i + 1)
        if pos > 10:
            break
        saida.append({**item, "pos": pos})
    return saida


def formatar(valor, unidade):
    if valor is None:
        return None
    if unidade == "euro":
        mi = valor / 1e6
        return f"€ {mi:.0f} mi" if mi >= 10 or mi == int(mi) else f"€ {mi:.1f} mi".replace(".", ",")
    return f"{valor} {unidade}"


def lista_da_fonte(tm: TM, cache: Path, t: dict):
    if t["fonte"] == "wikipedia":
        return cortar_top10(ranking_wiki(tm, cache, t), pos_da_fonte=True)
    if t["fonte"] == "tm-gols":
        return cortar_top10(tm.artilheiros(*t["args"]))
    if t["fonte"] == "tm-valor":
        return cortar_top10(tm.valiosos(t["data"], t["filtro"]))
    if t["fonte"] == "tm-transfer":
        return cortar_top10(tm.transferencias(t["temporada"]))
    raise Problema(f"fonte desconhecida {t['fonte']}")


def um_ranking(tm: TM, cache: Path, t: dict):
    lista = lista_da_fonte(tm, cache, t)
    nome = lambda x: x.get("nome") or tm.jog[x["tm"]][1]
    nomes = lambda: ", ".join(f"{x['pos']}. {nome(x)} ({x['valor']})" for x in lista)
    if not 10 <= len(lista) <= MAX_COM_EMPATE:
        raise Problema(f"{len(lista)} nomes no top 10 (empate demais ou fonte curta): {nomes()}")
    # a trava: o 1o (ou um dos empatados em 1o) tem que ser o esperado
    if normalizar(t["primeiro"]) not in [normalizar(nome(x)) for x in lista if x["pos"] == 1]:
        raise Problema(f"1o nao e {t['primeiro']!r}: {nomes()}")
    ids = [x["tm"] for x in lista]
    if len(set(ids)) != len(ids):
        raise Problema("jogador repetido")
    top = []
    for x in lista:
        pais = x.get("pais") or tm.pais(x["tm"])
        if not pais:
            raise Problema(f"sem pais pra {nome(x)}")
        top.append({"pos": x["pos"], "id": x["tm"], "nome": nome(x), "pais": pais,
                    "clube": x["clube"] or None, "valor": formatar(x["valor"], t["unidade"])})
    return {k: t[k] for k in ["id", "titulo", "sub", "recorte", "nivel"]} | {"fonte": t["credito"], "top": top}


def montar(tm: TM, cache: Path):
    rankings, problemas = [], []
    for t in TOPICOS:
        try:
            r = um_ranking(tm, cache, t)
        except Problema as e:
            problemas.append(f"[{t['id']}] {e}")
            continue
        rankings.append(r)
        print(f"ok {r['id']:<28} " + ", ".join(f"{x['pos']}.{x['nome']}[{x['pais']}|{x['clube']}|{x['valor']}]" for x in r["top"]))
    if problemas:
        raise SystemExit("\n".join(["", "PROBLEMAS:"] + problemas))
    # busca: quem esta em algum ranking + quem ja valeu 15 mi ou mais (pra busca nao entregar a resposta)
    pool = {x["id"]: {"id": x["id"], "nome": x["nome"], "pais": x["pais"]} for r in rankings for x in r["top"]}
    for p, j in tm.jog.items():
        if (j[6] or 0) >= 15_000_000 and p not in pool:
            pool[p] = {"id": p, "nome": j[1], "pais": tm.pais(p)}
    desempatar_homonimos(tm, pool, rankings)
    jogadores = sorted(pool.values(), key=lambda j: normalizar(j["nome"]))
    return rankings, jogadores


POSICOES = {"Goalkeeper": "goleiro", "Defender": "defensor", "Midfield": "meio-campo", "Attack": "atacante"}


def desempatar_homonimos(tm: TM, pool: dict, rankings: list):
    """Mesmo nome e mesma bandeira na busca ("Ederson" goleiro x "Ederson" volante): a
    sugestao ganha posicao e ano de nascimento (ou o clube da tabela, pra quem so esta
    na Wikipedia), senao o jogador chutaria no escuro."""
    grupos = {}
    for j in pool.values():
        grupos.setdefault((normalizar(j["nome"]), j["pais"]), []).append(j)
    clube_wiki = {x["id"]: x["clube"] for r in rankings for x in r["top"] if isinstance(x["id"], str)}
    for grupo in grupos.values():
        if len(grupo) < 2:
            continue
        for j in grupo:
            if isinstance(j["id"], str):
                j["extra"] = clube_wiki.get(j["id"]) or "Brasileirão"
            else:
                _, _, _, pos, _, nasc, _ = tm.jog[j["id"]]
                partes = [POSICOES.get(pos)] + ([f"nasc. {str(nasc)[:4]}"] if nasc else [])
                j["extra"] = " · ".join(x for x in partes if x)
        extras = [j.get("extra") for j in grupo]
        if len(set(extras)) != len(extras) or not all(extras):
            raise SystemExit(f"homonimos que nem posicao/ano separam: {[(j['nome'], j['id'], j.get('extra')) for j in grupo]}")


def baixar_bandeiras(codigos, pasta: Path):
    """SVG de cada bandeira usada (pacote flag-icons, MIT), guardado no proprio site."""
    pasta.mkdir(parents=True, exist_ok=True)
    for c in sorted(codigos):
        arq = pasta / f"{c}.svg"
        if arq.exists():
            continue
        r = requests.get(f"https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/{c}.svg", headers=UA, timeout=30)
        r.raise_for_status()
        arq.write_text(r.text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tm", type=Path, required=True)
    ap.add_argument("--cache", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("dados/top10.json"))
    ap.add_argument("--bandeiras", type=Path, default=Path("img/bandeiras"))
    a = ap.parse_args()
    a.cache.mkdir(parents=True, exist_ok=True)
    rankings, jogadores = montar(TM(a.tm.expanduser()), a.cache.expanduser())
    a.out.write_text(json.dumps({"gerado_em": dt.date.today().isoformat(), "rankings": rankings, "jogadores": jogadores},
                                ensure_ascii=False, separators=(",", ":")) + "\n")
    baixar_bandeiras({j["pais"] for j in jogadores if j["pais"]}, a.bandeiras)
    print(f"{len(rankings)} rankings, {len(jogadores)} jogadores na busca -> {a.out}")


if __name__ == "__main__":
    main()
