"""Google Search engine — using SearXNG's async progressive response approach."""

from __future__ import annotations

import json
import logging
import random
import re
import string
import time
from urllib.parse import urlencode, unquote

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client

logger = logging.getLogger(__name__)

# Characters used to generate random arc_id (matches SearXNG)
_ARCID_CHARS = string.ascii_letters + string.digits + "_-"
_ARCID_LEN = 23

# Cached arc_id prefix refreshed every hour
_arc_id_cache: tuple[float, str] = (0.0, "")


def _get_arc_id() -> str:
    """Generate a random arc_id prefix, refreshed hourly like SearXNG."""
    global _arc_id_cache
    now = time.time()
    if now - _arc_id_cache[0] > 3600:
        _arc_id_cache = (now, "".join(random.choices(_ARCID_CHARS, k=_ARCID_LEN)))
    return _arc_id_cache[1]


def _build_async_param(start: int) -> str:
    """Build the `async` parameter for Google's progressive response API."""
    arc_id = _get_arc_id()
    return f"arc_id:srp_{arc_id}_1{start},use_ac:true,_fmt:prog"


# Google Search App user agent (matches SearXNG's gen_gsa_useragent)
_GSA_UA = "GSA/14.46.1 (Linux; U; Android 14; Pixel 8a)"

_GOOGLE_HEADERS = {
    "User-Agent": _GSA_UA,
    "Accept": "*/*",
}


def _extract_url(raw: str) -> str:
    """Extract real URL from Google's /url?q= redirect wrapper."""
    if raw.startswith("/url?"):
        # Format: /url?q=<encoded_url>&sa=U&...
        url = unquote(raw[7:].split("&sa=")[0])
        return url
    if raw.startswith("http") and "google.com" not in raw:
        return raw
    return ""


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
            "ie": "utf8",
            "oe": "utf8",
            "start": start,
            "filter": "0",
            "asearch": "arc",
            "async": _build_async_param(start),
        }

        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/search?{urlencode(params)}",
            headers=_GOOGLE_HEADERS,
            cookies={"CONSENT": "YES+"},
        )
        resp.raise_for_status()

        # Detect captcha
        url_str = str(resp.url)
        if "sorry.google.com" in url_str or "/sorry/" in url_str:
            logger.warning("Google CAPTCHA detected — results blocked")
            return []

        dom = lxml_html.fromstring(resp.text)
        results: list[WebResult] = []

        for container in dom.xpath('.//div[contains(@class, "MjjYud")]'):
            # Extract title from role="link" div (SearXNG pattern)
            title_el = container.xpath('.//div[contains(@role, "link")]')
            if not title_el:
                title_el = container.xpath(".//h3")
            if not title_el:
                continue
            title = title_el[0].text_content().strip()
            if not title:
                continue

            # Extract URL from first valid anchor
            url = ""
            for a in container.xpath(".//a/@href"):
                extracted = _extract_url(a)
                if extracted:
                    url = extracted
                    break
            if not url:
                continue

            # Extract content/description (data-sncf="1" is SearXNG's selector)
            content = ""
            content_els = container.xpath('.//div[contains(@data-sncf, "1")]')
            if content_els:
                # Remove script tags before extracting text
                for script in content_els[0].xpath(".//script"):
                    script.getparent().remove(script)
                content = content_els[0].text_content().strip()
            if not content:
                # Fallback: look for any description-like paragraph
                for p in container.xpath(".//span"):
                    txt = p.text_content().strip()
                    if len(txt) > 40:
                        content = txt
                        break

            results.append(WebResult(title=title, url=url, content=content, engine=self.name))

        if not results:
            logger.warning("Google returned no parseable results for '%s'", query)

        return results

    async def search_images(self, query: str, page: int = 1) -> list[ImageResult]:
        start = (page - 1) * 50
        params = {
            "q": query,
            "tbm": "isch",
            "hl": "en",
            "ie": "utf8",
            "oe": "utf8",
            "asearch": "arc",
            "async": _build_async_param(start),
        }

        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/search?{urlencode(params)}",
            headers=_GOOGLE_HEADERS,
            cookies={"CONSENT": "YES+"},
        )
        resp.raise_for_status()

        url_str = str(resp.url)
        if "sorry.google.com" in url_str or "/sorry/" in url_str:
            logger.warning("Google CAPTCHA detected for image search")
            return []

        dom = lxml_html.fromstring(resp.text)
        text = resp.text

        # Build thumbnail map from base64 data embedded in response
        # Pattern: dimg_<id>","0"]<digits>;data:image/<type>;base64,<data>
        thumb_map: dict[str, str] = {}
        b64_matches = re.findall(
            r'(dimg_[^"]+)","0"\]\d+;(data:image/[^;]+;base64,[A-Za-z0-9+/=]+)', text
        )
        for img_id, data_uri in b64_matches:
            thumb_map[img_id] = data_uri

        # Also collect encrypted-tbn thumbnail URLs
        tbn_urls: list[str] = []
        raw_text = text.replace("\\\\u003d", "=").replace('\\"', '"')
        tbn_urls = re.findall(
            r"https://encrypted-tbn\d\.gstatic\.com/images\?q[^\"\\&\s]+", raw_text
        )

        results: list[ImageResult] = []
        seen: set[str] = set()

        # Parse image items from ivg-i containers (image grid items)
        for item in dom.xpath('.//div[contains(@class, "ivg-i")]'):
            img = item.xpath(".//img[@alt]")
            if not img:
                continue
            alt = img[0].get("alt", "").strip()
            if not alt:
                continue

            # Find source page URL
            source_url = ""
            for a in item.xpath(".//a/@href"):
                extracted = _extract_url(a)
                if extracted:
                    source_url = extracted
                    break
            # Skip Google-internal URLs
            if not source_url or source_url in seen:
                continue
            seen.add(source_url)

            # Get thumbnail: prefer base64 from thumb_map, else encrypted-tbn
            img_id = img[0].get("id", "")
            thumb = thumb_map.get(img_id, "")
            if not thumb and tbn_urls:
                thumb = tbn_urls.pop(0)

            results.append(
                ImageResult(
                    title=alt,
                    url=source_url,
                    img_src=thumb or "",
                    thumbnail_src=thumb or "",
                    source="Google",
                    engine=self.name,
                )
            )

        # Fallback: if no ivg-i items, try imgs with alt inside MjjYud
        if not results:
            for img_el in dom.xpath('//img[@alt and @alt!=""]'):
                alt = img_el.get("alt", "").strip()
                if not alt or len(alt) < 3:
                    continue
                el = img_el
                source_url = ""
                for _ in range(10):
                    el = el.getparent()
                    if el is None:
                        break
                    if el.tag == "a":
                        extracted = _extract_url(el.get("href", ""))
                        if extracted:
                            source_url = extracted
                            break
                if source_url and source_url not in seen:
                    seen.add(source_url)
                    img_id = img_el.get("id", "")
                    thumb = thumb_map.get(img_id, "")
                    if not thumb and tbn_urls:
                        thumb = tbn_urls.pop(0)
                    results.append(
                        ImageResult(
                            title=alt,
                            url=source_url,
                            img_src=thumb or "",
                            thumbnail_src=thumb or "",
                            source="Google",
                            engine=self.name,
                        )
                    )
                if len(results) >= 50:
                    break

        return results

    async def autocomplete(self, query: str) -> list[str]:
        client = get_http_client()
        resp = await client.get(
            f"https://www.google.com/complete/search?{urlencode({'q': query, 'client': 'gws-wiz', 'hl': 'en'})}",
        )
        if resp.is_success:
            text = resp.text
            try:
                json_txt = text[text.index("[") : text.rindex("]", -5) + 1]
                data = json.loads(json_txt)
                suggestions = []
                for item in data[0]:
                    raw = item[0] if isinstance(item, list) else str(item)
                    clean = lxml_html.fromstring(raw).text_content()
                    suggestions.append(clean)
                return suggestions[:10]
            except (ValueError, json.JSONDecodeError, IndexError):
                pass
        return []
