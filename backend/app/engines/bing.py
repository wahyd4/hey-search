"""Bing Search engine implementation."""

from __future__ import annotations

import base64
import logging
import re
from urllib.parse import urlencode, urlparse, parse_qs

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bing.com"


class BingEngine(SearchEngine):
    name = "bing"
    display_name = "Bing"
    supports_web = True
    supports_images = True

    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        offset = (page - 1) * 10 + 1
        params: dict = {"q": query, "pq": query}
        if page > 1:
            params["first"] = offset
            params["FORM"] = "PERE" if page == 2 else f"PERE{page - 2}"

        client = get_http_client()
        resp = await client.get(
            f"{BASE_URL}/search?{urlencode(params)}",
            cookies={
                "_EDGE_CD": "m=en-us&u=en",
                "_EDGE_S": "mkt=en-us&ui=en",
            },
        )
        resp.raise_for_status()

        results: list[WebResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath('//ol[@id="b_results"]/li[contains(@class, "b_algo")]'):
            link_els = el.xpath(".//h2/a")
            if not link_els:
                continue
            link = link_els[0]
            url = link.get("href", "")
            title = link.text_content().strip()

            # Decode Bing redirect URLs
            if url.startswith("https://www.bing.com/ck/a?"):
                try:
                    parsed_qs = parse_qs(urlparse(url).query)
                    encoded = parsed_qs["u"][0][2:]
                    encoded += "=" * (-len(encoded) % 4)
                    url = base64.urlsafe_b64decode(encoded).decode()
                except Exception:
                    pass

            content_els = el.xpath(".//p")
            # Remove algoSlug_icon spans
            for p in content_els:
                for span in p.xpath('.//span[@class="algoSlug_icon"]'):
                    span.getparent().remove(span)
            content = " ".join(p.text_content().strip() for p in content_els)

            results.append(WebResult(title=title, url=url, content=content, engine=self.name))

        return results

    async def search_images(self, query: str, page: int = 1) -> list[ImageResult]:
        offset = (page - 1) * 35
        params = {"q": query, "form": "HDRSC2", "first": offset}
        client = get_http_client()
        resp = await client.get(
            f"{BASE_URL}/images/search?{urlencode(params)}",
            cookies={
                "_EDGE_CD": "m=en-us&u=en",
                "_EDGE_S": "mkt=en-us&ui=en",
            },
        )
        resp.raise_for_status()

        results: list[ImageResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath('//a[contains(@class, "iusc")]'):
            m_attr = el.get("m", "")
            if not m_attr:
                continue
            import json
            try:
                m_data = json.loads(m_attr)
                results.append(ImageResult(
                    title=m_data.get("t", ""),
                    url=m_data.get("purl", ""),
                    img_src=m_data.get("murl", ""),
                    thumbnail_src=m_data.get("turl", ""),
                    source="Bing",
                    engine=self.name,
                ))
            except (json.JSONDecodeError, KeyError):
                continue

        return results
