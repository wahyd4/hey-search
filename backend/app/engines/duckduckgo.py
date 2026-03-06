# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Junwei Zhao
"""DuckDuckGo Search engine implementation."""

from __future__ import annotations

import json
import logging
from urllib.parse import urlencode

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client
from app.engines.date_utils import parse_date_from_text

logger = logging.getLogger(__name__)

DDG_HTML_URL = "https://html.duckduckgo.com/html/"
DDG_LITE_URL = "https://lite.duckduckgo.com/lite/"


class DuckDuckGoEngine(SearchEngine):
    name = "duckduckgo"
    display_name = "DuckDuckGo"
    supports_web = True
    supports_images = True

    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        data = {"q": query, "b": "", "kl": "wt-wt"}
        client = get_http_client()
        resp = await client.post(
            DDG_HTML_URL,
            data=data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": DDG_HTML_URL,
            },
        )
        resp.raise_for_status()

        results: list[WebResult] = []
        dom = lxml_html.fromstring(resp.text)

        for div in dom.xpath('//div[@id="links"]/div[contains(@class, "web-result")]'):
            title_els = div.xpath(".//h2/a")
            if not title_els:
                continue
            title = title_els[0].text_content().strip()
            url_els = div.xpath(".//h2/a/@href")
            if not url_els:
                continue
            url = url_els[0]
            content_els = div.xpath('.//a[contains(@class, "result__snippet")]')
            content = content_els[0].text_content().strip() if content_els else ""
            results.append(WebResult(title=title, url=url, content=content, engine=self.name, published_date=parse_date_from_text(content)))

        return results

    async def search_images(self, query: str, page: int = 1, image_size: str = "") -> list[ImageResult]:
        """Search images via DDG's i.js API (requires vqd token)."""
        client = get_http_client()
        # First get a vqd token from the HTML page
        token_resp = await client.get(
            f"https://duckduckgo.com/?{urlencode({'q': query, 'iax': 'images', 'ia': 'images'})}",
        )
        token_resp.raise_for_status()

        vqd = ""
        for line in token_resp.text.split("\n"):
            if "vqd=" in line or "vqd'" in line or 'vqd"' in line:
                # Try to extract vqd value
                import re
                m = re.search(r"vqd=['\"]?([^&'\"]+)", line)
                if m:
                    vqd = m.group(1)
                    break

        if not vqd:
            # Fallback: try extracting from form
            dom = lxml_html.fromstring(token_resp.text)
            vqd_els = dom.xpath('//input[@name="vqd"]/@value')
            if vqd_els:
                vqd = vqd_els[0]

        results: list[ImageResult] = []
        if not vqd:
            return results

        img_params: dict[str, str] = {"q": query, "vqd": vqd, "o": "json"}
        # DuckDuckGo size filter
        size_map = {"large": "Large", "medium": "Medium", "small": "Small"}
        if image_size in size_map:
            img_params["size"] = size_map[image_size]

        img_resp = await client.get(
            f"https://duckduckgo.com/i.js?{urlencode(img_params)}",
            headers={"Referer": "https://duckduckgo.com/"},
        )
        if img_resp.is_success:
            data = img_resp.json()
            for item in data.get("results", [])[:20]:
                results.append(ImageResult(
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    img_src=item.get("image", ""),
                    thumbnail_src=item.get("thumbnail", ""),
                    source=item.get("source", ""),
                    engine=self.name,
                    width=int(item.get("width", 0) or 0),
                    height=int(item.get("height", 0) or 0),
                    published_date=parse_date_from_text(str(item.get("age", ""))),
                ))

        return results

    async def autocomplete(self, query: str) -> list[str]:
        client = get_http_client()
        resp = await client.get(
            f"https://duckduckgo.com/ac/?{urlencode({'q': query, 'type': 'list'})}",
        )
        if resp.is_success:
            data = resp.json()
            if isinstance(data, list) and len(data) > 1:
                return data[1][:10]
        return []
