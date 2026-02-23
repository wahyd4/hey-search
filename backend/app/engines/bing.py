"""Bing Search engine — direct scraping with Yahoo fallback on CAPTCHA."""

from __future__ import annotations

import base64
import logging
from urllib.parse import urlencode, urlparse, parse_qs, unquote

from lxml import html as lxml_html

from app.models import WebResult, ImageResult
from app.engines.base import SearchEngine, get_http_client

logger = logging.getLogger(__name__)

_BING_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/127.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-CH-UA": '"Not/A)Brand";v="8", "Chromium";v="127", "Google Chrome";v="127"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
}

_YAHOO_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# SearXNG pagination: FORM=PERE for page 2, PERE{n-2} for page n>2
def _bing_form_param(page: int) -> str:
    if page <= 1:
        return ""
    if page == 2:
        return "PERE"
    return f"PERE{page - 2}"


def _decode_bing_redirect(url: str) -> str:
    """Decode Bing's /ck/a? redirect URLs using base64 (SearXNG approach)."""
    if "bing.com/ck/a?" not in url:
        return url
    try:
        parsed = parse_qs(urlparse(url).query)
        encoded = parsed["u"][0]
        # Remove "a1" prefix (2 chars), then base64 decode
        encoded = encoded[2:]
        # Pad to valid base64 length
        encoded += "=" * (-len(encoded) % 4)
        return base64.urlsafe_b64decode(encoded).decode("utf-8")
    except Exception:
        return url


def _is_bing_captcha(text: str) -> bool:
    """Detect Bing CAPTCHA/rate limiting pages."""
    low = text.lower()
    return (
        "captcha" in low
        or "form id=\"captcha-form\"" in low
        or 'id="b_results"' not in low
    )


class BingEngine(SearchEngine):
    name = "bing"
    display_name = "Bing"
    supports_web = True
    supports_images = True

    async def search_web(self, query: str, page: int = 1) -> list[WebResult]:
        # Try direct Bing first
        results = await self._bing_direct_web(query, page)
        if results is not None:
            return results

        # Fallback to Yahoo (Bing-powered)
        logger.info("Bing direct blocked — falling back to Yahoo for '%s'", query)
        return await self._yahoo_web(query, page)

    async def search_images(self, query: str, page: int = 1, image_size: str = "") -> list[ImageResult]:
        # Try direct Bing first
        results = await self._bing_direct_images(query, page, image_size)
        if results is not None:
            return results

        # Fallback to Yahoo images
        logger.info("Bing images blocked — falling back to Yahoo for '%s'", query)
        return await self._yahoo_images(query, page)

    # ── Direct Bing ──────────────────────────────────────────────

    async def _bing_direct_web(self, query: str, page: int) -> list[WebResult] | None:
        """Search Bing directly. Returns None if CAPTCHA detected."""
        first = (page - 1) * 10 + 1
        params: dict[str, str | int] = {"q": query, "pq": query, "first": first}
        form = _bing_form_param(page)
        if form:
            params["FORM"] = form

        client = get_http_client()
        try:
            resp = await client.get(
                f"https://www.bing.com/search?{urlencode(params)}",
                headers=_BING_HEADERS,
                cookies={
                    "_EDGE_CD": "m=en-us&u=en",
                    "_EDGE_S": "mkt=en-us&ui=en",
                },
            )
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Bing direct request failed: %s", e)
            return None

        if _is_bing_captcha(resp.text):
            logger.warning("Bing CAPTCHA detected")
            return None

        dom = lxml_html.fromstring(resp.text)
        results: list[WebResult] = []

        for el in dom.xpath('//ol[@id="b_results"]/li[contains(@class, "b_algo")]'):
            link = el.xpath(".//h2/a")
            if not link:
                continue
            raw_url = link[0].get("href", "")
            title = link[0].text_content().strip()
            url = _decode_bing_redirect(raw_url)
            if not url.startswith("http"):
                continue

            # Content: paragraph text, exclude icon spans
            content = ""
            for p in el.xpath(".//p"):
                # Remove algoSlug_icon spans
                for span in p.xpath('.//span[contains(@class, "algoSlug_icon")]'):
                    span.getparent().remove(span)
                txt = p.text_content().strip()
                if len(txt) > len(content):
                    content = txt

            results.append(WebResult(title=title, url=url, content=content, engine=self.name))

        # Rate limit detection: Bing silently resets to page 1
        if page > 1 and results:
            actual_first = dom.xpath('//ol[@id="b_results"]/li[contains(@class, "b_algo")]')
            expected = (page - 1) * 10
            # If we got results but Bing ignored our pagination, log it
            if len(actual_first) > 0:
                sb_count = dom.xpath('//span[@class="sb_count"]')
                if sb_count:
                    count_text = sb_count[0].text_content()
                    logger.debug("Bing result count text: %s", count_text)

        return results

    async def _bing_direct_images(self, query: str, page: int, image_size: str = "") -> list[ImageResult] | None:
        """Search Bing Images directly. Returns None if blocked."""
        first = (page - 1) * 35 + 1
        params: dict[str, str | int] = {"q": query, "first": first, "FORM": "HDRSC2"}
        # Bing size filter
        size_map = {"large": "+filterui:imagesize-large", "medium": "+filterui:imagesize-medium", "small": "+filterui:imagesize-small"}
        if image_size in size_map:
            params["qft"] = size_map[image_size]

        client = get_http_client()
        try:
            resp = await client.get(
                f"https://www.bing.com/images/search?{urlencode(params)}",
                headers=_BING_HEADERS,
                cookies={
                    "_EDGE_CD": "m=en-us&u=en",
                    "_EDGE_S": "mkt=en-us&ui=en",
                },
            )
            resp.raise_for_status()
        except Exception as e:
            logger.warning("Bing images request failed: %s", e)
            return None

        if "captcha" in resp.text.lower():
            return None

        dom = lxml_html.fromstring(resp.text)
        results: list[ImageResult] = []

        import json as _json
        for el in dom.xpath('//a[@class="iusc"]'):
            m_attr = el.get("m", "")
            if not m_attr:
                continue
            try:
                data = _json.loads(m_attr)
                img_url = data.get("murl", "")
                thumb_url = data.get("turl", "")
                title = data.get("t", "")
                source_url = data.get("purl", "")
                if img_url:
                    results.append(
                        ImageResult(
                            title=title,
                            url=source_url or img_url,
                            img_src=img_url,
                            thumbnail_src=thumb_url or img_url,
                            source="Bing",
                            engine=self.name,
                        )
                    )
            except _json.JSONDecodeError:
                continue

        if not results:
            return None

        return results

    # ── Yahoo fallback (Bing-powered) ────────────────────────────

    async def _yahoo_web(self, query: str, page: int) -> list[WebResult]:
        offset = (page - 1) * 10 + 1
        params: dict[str, str | int] = {"p": query, "b": offset}
        client = get_http_client()
        resp = await client.get(
            f"https://search.yahoo.com/search?{urlencode(params)}",
            headers=_YAHOO_HEADERS,
        )
        resp.raise_for_status()

        results: list[WebResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath('//div[contains(@class, "algo")]'):
            h3_links = el.xpath(".//h3//a")
            if not h3_links:
                continue
            link = h3_links[0]
            raw_url = link.get("href", "")
            title_text = link.text_content().strip()
            url = _extract_yahoo_url(raw_url)
            if not url.startswith("http"):
                continue

            title = title_text
            if "›" in title:
                parts = title.split("›")
                last = parts[-1].strip()
                if len(last) > 10:
                    title = last

            desc_els = el.xpath('.//div[contains(@class, "compText")]//p') or el.xpath(".//p")
            content = desc_els[0].text_content().strip() if desc_els else ""
            results.append(WebResult(title=title, url=url, content=content, engine=self.name))

        if not results:
            logger.warning("Yahoo fallback returned no results for '%s'", query)

        return results

    async def _yahoo_images(self, query: str, page: int) -> list[ImageResult]:
        offset = (page - 1) * 60 + 1
        params: dict[str, str | int] = {"p": query, "b": offset}
        client = get_http_client()
        resp = await client.get(
            f"https://images.search.yahoo.com/search/images?{urlencode(params)}",
            headers=_YAHOO_HEADERS,
        )
        resp.raise_for_status()

        results: list[ImageResult] = []
        dom = lxml_html.fromstring(resp.text)

        for el in dom.xpath('//li[contains(@class, "ld")]'):
            links = el.xpath(".//a")
            for a in links:
                img_els = a.xpath(".//img")
                if not img_els:
                    continue
                img = img_els[0]
                thumb = img.get("data-src", "") or img.get("src", "")
                alt = img.get("alt", "")
                page_url = a.get("href", "")
                if thumb and ("yimg" in thumb or thumb.startswith("http")):
                    results.append(
                        ImageResult(
                            title=alt,
                            url=page_url if page_url.startswith("http") else "",
                            img_src=thumb,
                            thumbnail_src=thumb,
                            source="Bing",
                            engine=self.name,
                        )
                    )
                    break

        return results


def _extract_yahoo_url(raw_url: str) -> str:
    """Extract the real URL from Yahoo's redirect wrapper."""
    if "r.search.yahoo.com" in raw_url or "yahoo.com/RV=" in raw_url:
        try:
            if "/RU=" in raw_url:
                start = raw_url.index("/RU=") + 4
                end = raw_url.index("/RK=", start) if "/RK=" in raw_url else len(raw_url)
                return unquote(raw_url[start:end])
        except (ValueError, IndexError):
            pass
    return raw_url
