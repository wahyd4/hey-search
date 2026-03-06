"""Brave Search engine implementation."""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client
from app.engines.date_utils import parse_date_from_text

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
            # Try to extract date from dedicated age element, fall back to content text
            date_els = el.xpath(".//div[contains(@class, 'snippet-description')]//time/@datetime") \
                or el.xpath(".//*[contains(@class, 'age')]")
            if date_els and isinstance(date_els[0], str):
                published_date = date_els[0][:10]
            else:
                age_text = date_els[0].text_content().strip() if date_els else ""
                published_date = parse_date_from_text(age_text) or parse_date_from_text(content)
            results.append(WebResult(title=title, url=url, content=content, engine=self.name, published_date=published_date))

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
            title_els = el.xpath(".//span[contains(@class, 'title')]")
            if not img_els:
                continue
            # Prefer links that don't wrap an <img> — those are source page links.
            # Links that wrap an <img> point directly to the image file, not the page.
            page_links = el.xpath(".//a[not(.//img)]/@href")
            all_links = el.xpath(".//a/@href")
            page_url = (page_links or all_links or [""])[0]
            if not page_url:
                continue
            results.append(ImageResult(
                title=title_els[0].text_content().strip() if title_els else "",
                url=page_url,
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
