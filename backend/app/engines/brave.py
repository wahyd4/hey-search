"""Brave Search engine implementation."""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client

logger = logging.getLogger(__name__)

BASE_URL = "https://search.brave.com"


class BraveEngine(SearchEngine):
    name = "brave"
    display_name = "Brave"
    supports_web = True
    supports_images = True

    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        args = {"q": query, "source": "web"}
        if page > 1:
            args["offset"] = page - 1

        client = get_http_client()
        resp = await client.get(
            f"{BASE_URL}/search?{urlencode(args)}",
            headers={"Accept-Encoding": "gzip, deflate"},
            cookies={"safesearch": "moderate", "useLocation": "0", "country": "all"},
        )
        resp.raise_for_status()

        results: list[WebResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath("//div[contains(@class, 'snippet ')]"):
            url_els = el.xpath(".//a/@href")
            title_els = el.xpath(".//div[contains(@class, 'title')]")
            if not url_els or not title_els:
                continue
            url = url_els[0]
            if not url.startswith("http"):
                continue
            title = title_els[0].text_content().strip()
            content_els = el.xpath(".//div[contains(concat(' ', @class, ' '), ' content ')]")
            content = content_els[0].text_content().strip() if content_els else ""
            results.append(WebResult(title=title, url=url, content=content, engine=self.name))

        return results

    async def search_images(self, query: str, page: int = 1, image_size: str = "") -> list[ImageResult]:
        args: dict[str, str | int] = {"q": query, "source": "web"}
        # Brave size filter
        size_map = {"large": "Large", "medium": "Medium", "small": "Small"}
        if image_size in size_map:
            args["size"] = size_map[image_size]
        client = get_http_client()
        resp = await client.get(
            f"{BASE_URL}/images?{urlencode(args)}",
            headers={"Accept-Encoding": "gzip, deflate"},
            cookies={"safesearch": "moderate", "useLocation": "0", "country": "all"},
        )
        resp.raise_for_status()

        results: list[ImageResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath("//div[contains(@class, 'img-card')]"):
            img_els = el.xpath(".//img/@src")
            link_els = el.xpath(".//a/@href")
            title_els = el.xpath(".//span[contains(@class, 'title')]")
            if not img_els or not link_els:
                continue
            results.append(ImageResult(
                title=title_els[0].text_content().strip() if title_els else "",
                url=link_els[0],
                img_src=img_els[0],
                thumbnail_src=img_els[0],
                source="Brave",
                engine=self.name,
            ))

        return results

    async def autocomplete(self, query: str) -> list[str]:
        client = get_http_client()
        resp = await client.get(
            f"https://search.brave.com/api/suggest?{urlencode({'q': query})}",
            cookies={"country": "all"},
        )
        if resp.is_success:
            data = resp.json()
            if isinstance(data, list) and len(data) > 1:
                return data[1][:10]
        return []
