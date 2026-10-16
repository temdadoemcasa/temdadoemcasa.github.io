"""Os rankings do Top 10 em Casa. Faceis a medios: premio conhecido, artilharia,
mais valiosos e transferencias mais caras. `primeiro` e a trava: o 1o colocado
que a fonte TEM que dar (gerar.py para se der outro)."""
import datetime as dt

WIKI = "Wikipedia"
TMK = "Transfermarkt"


def idade(j, data):
    nasc = j[5]
    if not nasc:
        return None
    d = dt.date.fromisoformat(str(data))
    n = nasc.date() if hasattr(nasc, "date") else dt.date.fromisoformat(str(nasc)[:10])
    return d.year - n.year - ((d.month, d.day) < (n.month, n.day))


todos = lambda j, d: True
laterais = lambda j, d: j[4] in ("Left-Back", "Right-Back")
goleiros = lambda j, d: j[3] == "Goalkeeper"
zagueiros = lambda j, d: j[4] == "Centre-Back"
meias = lambda j, d: j[3] == "Midfield"
atacantes = lambda j, d: j[3] == "Attack"
de = lambda pais: (lambda j, d: j[2] == pais)
sub21 = lambda j, d: (idade(j, d) or 99) <= 21


def bo(ano, primeiro, apelidos=None):
    return dict(id=f"bola-de-ouro-{ano}", titulo=f"Bola de Ouro {ano}", sub="o top 10 da votação", recorte=f"Ballon d'Or {ano}",
                nivel="fácil", fonte="wikipedia", pagina=f"{ano} Ballon d'Or", primeiro=primeiro, unidade="pts", credito=WIKI,
                apelidos=apelidos or {})


def yashin(ano, primeiro, apelidos=None):
    return dict(id=f"yashin-{ano}", titulo=f"Melhores goleiros do mundo {ano}", sub="o top 10 do Troféu Yashin",
                recorte=f"Troféu Yashin {ano}", nivel="médio", fonte="wikipedia", pagina=f"{ano} Ballon d'Or",
                primeiro=primeiro, unidade="pts", credito=WIKI, apelidos=apelidos or {})


def kopa(ano, primeiro, apelidos=None):
    return dict(id=f"kopa-{ano}", titulo=f"Melhores jovens do mundo {ano}", sub="o top 10 do Troféu Kopa (sub-21)",
                recorte=f"Troféu Kopa {ano}", nivel="médio", fonte="wikipedia", pagina=f"{ano} Ballon d'Or",
                primeiro=primeiro, unidade="pts", credito=WIKI, apelidos=apelidos or {})


def br_gols(ano, primeiro, apelidos=None):
    return dict(id=f"artilheiros-brasileirao-{ano}", titulo=f"Artilheiros do Brasileirão {ano}", sub="quem mais fez gol na Série A",
                recorte=f"Brasileirão {ano}", nivel="fácil", fonte="wikipedia", pagina=f"{ano} Campeonato Brasileiro Série A",
                primeiro=primeiro, unidade="gols", credito=WIKI, checar_clube=True)


LIGAS = {"GB1": "Premier League", "ES1": "LaLiga", "IT1": "Serie A", "L1": "Bundesliga", "FR1": "Ligue 1", "CL": "Champions League"}


def gols(comp, temporada, primeiro, nivel="fácil"):
    t = f"{temporada}/{str(temporada + 1)[2:]}"
    return dict(id=f"artilheiros-{comp.lower()}-{temporada}", titulo=f"Artilheiros da {LIGAS[comp]} {t}", sub="quem mais fez gol",
                recorte=f"{LIGAS[comp]} {t}", nivel=nivel, fonte="tm-gols", args=(comp, temporada), primeiro=primeiro,
                unidade="gols", credito=TMK)


def valor(id_, titulo, data, filtro, primeiro, nivel="médio", sub="os mais valiosos no Transfermarkt"):
    rotulo = dt.date.fromisoformat(data).strftime("%m/%Y")
    return dict(id=id_, titulo=titulo, sub=sub, recorte=f"valor de mercado em {rotulo}", nivel=nivel, fonte="tm-valor",
                data=data, filtro=filtro, primeiro=primeiro, unidade="euro", credito=TMK)


def transfer(temporada, primeiro, nivel="médio"):
    return dict(id=f"transferencias-{temporada.replace('/', '-')}", titulo=f"Contratações mais caras de {temporada}",
                sub="as transferências mais caras da temporada", recorte=f"janelas de {temporada}", nivel=nivel,
                fonte="tm-transfer", temporada=temporada, primeiro=primeiro, unidade="euro", credito=TMK)


TOPICOS = [
    bo(2018, "Luka Modrić"), bo(2019, "Lionel Messi"), bo(2021, "Lionel Messi"), bo(2022, "Karim Benzema"),
    bo(2023, "Lionel Messi"), bo(2024, "Rodri"), bo(2025, "Ousmane Dembélé"),
    yashin(2021, "Gianluigi Donnarumma"), yashin(2022, "Thibaut Courtois"), yashin(2023, "Emiliano Martínez"),
    yashin(2024, "Emiliano Martínez"), yashin(2025, "Gianluigi Donnarumma"),
    kopa(2022, "Gavi"), kopa(2023, "Jude Bellingham"), kopa(2024, "Lamine Yamal"), kopa(2025, "Lamine Yamal"),
    br_gols(2023, "Paulinho"), br_gols(2024, "Yuri Alberto"), br_gols(2025, "Kaio Jorge"),
    gols("GB1", 2022, "Erling Haaland"), gols("GB1", 2023, "Erling Haaland"), gols("GB1", 2024, "Mohamed Salah"),
    gols("ES1", 2022, "Robert Lewandowski"), gols("ES1", 2023, "Artem Dovbyk", "médio"), gols("ES1", 2024, "Kylian Mbappé"),
    gols("IT1", 2022, "Victor Osimhen", "médio"), gols("IT1", 2023, "Lautaro Martínez", "médio"),
    gols("L1", 2023, "Harry Kane", "médio"), gols("L1", 2024, "Harry Kane", "médio"),
    gols("FR1", 2023, "Kylian Mbappé", "médio"),
    gols("CL", 2022, "Erling Haaland"), gols("CL", 2024, "Raphinha"),
    valor("valiosos-2019", "Mais valiosos do mundo 2019", "2019-12-31", todos, "Kylian Mbappé", "fácil"),
    valor("valiosos-2022", "Mais valiosos do mundo 2022", "2022-12-31", todos, "Kylian Mbappé", "fácil"),
    valor("valiosos-2024", "Mais valiosos do mundo 2024", "2024-12-31", todos, "Erling Haaland", "fácil"),
    valor("valiosos-2025", "Mais valiosos do mundo hoje", "2025-09-01", todos, "Lamine Yamal", "fácil"),
    valor("laterais-2022", "Laterais mais valiosos de 2022", "2022-12-31", laterais, "Achraf Hakimi"),
    valor("goleiros-2023", "Goleiros mais valiosos de 2023", "2023-12-31", goleiros, "Mike Maignan"),
    valor("zagueiros-2024", "Zagueiros mais valiosos de 2024", "2024-12-31", zagueiros, "William Saliba"),
    valor("brasileiros-2019", "Brasileiros mais valiosos de 2019", "2019-12-31", de("Brazil"), "Neymar", "fácil"),
    valor("brasileiros-2022", "Brasileiros mais valiosos de 2022", "2022-12-31", de("Brazil"), "Vinicius Junior", "fácil"),
    valor("argentinos-2023", "Argentinos mais valiosos de 2023", "2023-12-31", de("Argentina"), "Lautaro Martínez"),
    valor("ingleses-2023", "Ingleses mais valiosos de 2023", "2023-12-31", de("England"), "Jude Bellingham"),
    valor("franceses-2024", "Franceses mais valiosos de 2024", "2024-12-31", de("France"), "Kylian Mbappé"),
    valor("portugueses-2024", "Portugueses mais valiosos de 2024", "2024-12-31", de("Portugal"), "Rafael Leão"),
    valor("sub21-2024", "Jovens mais valiosos de 2024", "2024-12-31", sub21, "Lamine Yamal", sub="os sub-21 mais valiosos no Transfermarkt"),
    transfer("17/18", "Neymar", "fácil"), transfer("19/20", "João Félix"), transfer("22/23", "Enzo Fernández"),
    transfer("23/24", "Jude Bellingham"), transfer("24/25", "Khvicha Kvaratskhelia"), transfer("25/26", "Alexander Isak"),
]
