"""Google Search engine implementation."""

from __future__ import annotations

import json
import logging
from urllib.parse import urlencode, unquote

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client

logger = logging.getLogger(__name__)


class GoogleEngine(SearchEngine):
    name = "google"
    display_name = "Google"
    supports_web = True
    supports_images = True

    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        start = (page - 1) * 10
        params = {
            "q": query,
            "hl": "en",
            "lr": "",
            "ie": "utf8",
            "oe": "utf8",
            "start": start,
            "filter": "0",
        }
        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/search?{urlencode(params)}",
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            cookies={"CONSENT": "YES+"},
        )
        resp.raise_for_status()

        results: list[WebResult] = []
        dom = lxml_html.fromstring(resp.text)

        for result in dom.xpath('.//div[contains(@class, "g")]'):
            link_els = result.xpath('.//a/@href')
            title_els = result.xpath('.//h3')
            if not link_els or not title_els:
                continue
            raw_url = link_els[0]
            # Clean google redirect URLs
            if raw_url.startswith("/url?"):
                from urllib.parse import parse_qs, urlparse
                parsed = parse_qs(urlparse(raw_url).query)
                raw_url = parsed.get("q", [raw_url])[0]
            if not raw_url.startswith("http"):
                continue
            title = title_els[0].text_content().strip()
            content_els = result.xpath('.//div[contains(@class, "VwiC3b")]')
            content = content_els[0].text_content().strip() if content_els else ""
            results.append(WebResult(title=title, url=raw_url, content=content, engine=self.name))

        return results

    async def search_images(self, query: str, page: int = 1) -> list[ImageResult]:
        params = {
            "q": query,
            "tbm": "isch",
            "hl": "en",
            "ie": "utf8",
            "oe": "utf8",
        }
        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/search?{urlencode(params)}",
            cookies={"CONSENT": "YES+"},
        )
        resp.raise_for_status()

        results: list[ImageResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath('//div[contains(@class, "isv-r")]'):
            link_els = el.xpath('.//a/@href')
            img_els = el.xpath('.//img/@src') or el.xpath('.//img/@data-src')
            if not link_els or not img_els:
                continue
            title_els = el.xpath('.//img/@alt')
            results.append(ImageResult(
                title=title_els[0] if title_els else "",
                url=link_els[0],
                img_src=img_els[0],
                thumbnail_src=img_els[0],
                source="Google",
                engine=self.name,
            ))

        return results

    async def autocomplete(self, query: str) -> list[str]:
        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/complete/search?{urlencode({'q': query, 'client': 'gws-wiz', 'hl': 'en'})}",
        )
        if resp.is_success:
            text = resp.text
            try:
                json_txt = text[text.index("["):text.rindex("]", -5) + 1]
                data = json.loads(json_txt)
                suggestions = []
                for item in data[0]:
                    raw = item[0] if isinstance(item, list) else str(item)
                    # Strip HTML tags from suggestions
                    clean = lxml_html.fromstring(raw).text_content()
                    suggestions.append(clean)
                return suggestions[:10]
            except (ValueError, json.JSONDecodeError, IndexError):
                pass
        return []
