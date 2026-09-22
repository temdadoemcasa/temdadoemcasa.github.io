"""python -m unittest discover -s scripts"""

import unittest

from atualizar_videos import MAXIMO, videos_do_feed

CABECALHO = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" '
    'xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">'
    "<title>Tem dado em casa</title>"
)


def _entrada(video_id, titulo, publicado):
    return (
        f"<entry><yt:videoId>{video_id}</yt:videoId><title>{titulo}</title>"
        f"<published>{publicado}</published></entry>"
    )


class VideosDoFeed(unittest.TestCase):
    def test_canal_vazio_e_lista_vazia_e_nao_erro(self):
        # o feed real do canal hoje (2026-09-22): so o cabecalho
        self.assertEqual(videos_do_feed(CABECALHO + "</feed>"), [])

    def test_mais_recente_primeiro_mesmo_fora_de_ordem_no_feed(self):
        xml = (
            CABECALHO
            + _entrada("aaa", "Antigo", "2026-09-01T10:00:00+00:00")
            + _entrada("bbb", "Novo", "2026-09-20T10:00:00+00:00")
            + "</feed>"
        )
        videos = videos_do_feed(xml)
        self.assertEqual([v["id"] for v in videos], ["bbb", "aaa"])
        self.assertEqual(videos[0]["url"], "https://www.youtube.com/watch?v=bbb")
        self.assertEqual(videos[0]["thumb"], "https://i.ytimg.com/vi/bbb/hqdefault.jpg")
        self.assertEqual(videos[0]["titulo"], "Novo")

    def test_corta_no_maximo(self):
        entradas = "".join(
            _entrada(f"v{i:02d}", f"V{i}", f"2026-09-{i + 1:02d}T10:00:00+00:00") for i in range(10)
        )
        videos = videos_do_feed(CABECALHO + entradas + "</feed>")
        self.assertEqual(len(videos), MAXIMO)
        self.assertEqual(videos[0]["id"], "v09")


if __name__ == "__main__":
    unittest.main()
