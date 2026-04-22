import re
import json
import asyncio
import logging
from pydantic import BaseModel
from bs4 import BeautifulSoup

import ai
from models import VALID_CATEGORIES, Category, Price, Variant, Product

logger = logging.getLogger(__name__)

MODEL = "google/gemini-2.5-flash-lite"


# ── Structured extraction (no AI) ─────────────────────────────────────────────

def extract_json_ld(html: str) -> list[dict]:
    """Pull every JSON-LD block out of the page."""
    results = []
    for m in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    ):
        try:
            results.append(json.loads(m.group(1)))
        except json.JSONDecodeError:
            pass
    return results


def extract_og_tags(html: str) -> dict[str, str]:
    """Pull Open Graph meta tags (og:title, og:image, og:description, etc.)."""
    og: dict[str, str] = {}
    for meta in re.finditer(r'<meta([^>]+)>', html):
        attrs = meta.group(1)
        prop = re.search(r'property=["\']og:([^"\']+)["\']', attrs)
        content = re.search(r'content=["\']([^"\']*)["\']', attrs)
        if prop and content:
            og.setdefault(prop.group(1), content.group(1))
    return og


_EMBEDDED_VARS = ["__NEXT_DATA__", "__SERVER_DATA__", "__INITIAL_STATE__", "__STORE__"]


def extract_embedded_json(html: str) -> dict:
    """
    Extract embedded JSON state variables injected by React/Next.js apps.
    Uses json.JSONDecoder.raw_decode so it stops exactly at the end of the
    object rather than relying on a fragile regex boundary.
    """
    decoder = json.JSONDecoder()
    for var in _EMBEDDED_VARS:
        m = re.search(rf'window\.{re.escape(var)}\s*=\s*', html)
        if not m:
            continue
        remainder = html[m.end():].lstrip()
        if remainder.startswith("{"):
            try:
                obj, _ = decoder.raw_decode(remainder)
                return obj
            except json.JSONDecodeError:
                pass
    return {}


def _summarize_embedded_json(data: dict) -> str:
    """
    For large embedded JSON blobs, extract only the fields relevant to a
    product: title, prices, images, color/size options, and description.
    Falls back to raw truncation if no recognized product structure is found.
    """
    product = data.get("product")
    if not product or not isinstance(product, dict):
        # Try Next.js pageProps path
        product = data.get("props", {}).get("pageProps", {}).get("product", {})
    if not product or not isinstance(product, dict):
        return json.dumps(data, indent=2)[:6_000]

    kept = {
        k: product[k]
        for k in ["title", "description", "brand", "prices", "media",
                  "questions", "productDetails", "items"]
        if k in product
    }
    raw = json.dumps(kept, indent=2)
    return raw[:12_000] + ("  [truncated]" if len(raw) > 12_000 else "")


def extract_visible_text(html: str, max_chars: int = 12_000) -> str:
    """Strip all HTML tags and return only visible text, capped at max_chars."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "head", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars]


def build_context(html: str) -> str:
    """
    Combine every structured signal (JSON-LD, OG tags, embedded JSON, visible
    text) into a single string to send to the model.
    """
    parts: list[str] = []

    json_ld = extract_json_ld(html)
    if json_ld:
        parts.append("=== STRUCTURED DATA (JSON-LD) ===")
        parts.append(json.dumps(json_ld, indent=2))

    og = extract_og_tags(html)
    if og:
        parts.append("\n=== OPEN GRAPH ===")
        parts.extend(f"og:{k}: {v}" for k, v in og.items())

    embedded = extract_embedded_json(html)
    if embedded:
        parts.append("\n=== EMBEDDED JSON STATE ===")
        parts.append(_summarize_embedded_json(embedded))

    visible = extract_visible_text(html)
    if visible:
        parts.append("\n=== PAGE TEXT ===")
        parts.append(visible)

    return "\n".join(parts)


# ── Category assignment (AI, 2 sub-calls) ────────────────────────────────────

def _top_level_categories() -> list[str]:
    return sorted(c for c in VALID_CATEGORIES if " > " not in c)


def _direct_children(parent: str) -> list[str]:
    """Return categories that are exactly one level below parent."""
    prefix = parent + " > "
    depth = parent.count(" > ") + 1
    return sorted(
        c for c in VALID_CATEGORIES
        if c.startswith(prefix) and c.count(" > ") == depth
    )


def _category_tree_summary() -> str:
    """
    Compact tree: each top-level category with ALL its direct children listed
    so the model can see the full range before picking.
    """
    lines = []
    for top in _top_level_categories():
        children = [c.split(" > ")[-1] for c in _direct_children(top)]
        hint = f" (includes: {', '.join(children)})" if children else ""
        lines.append(f"- {top}{hint}")
    return "\n".join(lines)


class _Pick(BaseModel):
    category: str


def _fuzzy_match(chosen: str, options: list[str]) -> str | None:
    if chosen in options:
        return chosen
    chosen_lower = chosen.lower()
    return next(
        (o for o in options if o.lower() in chosen_lower or chosen_lower in o.lower()),
        None,
    )


async def _assign_category(
    name: str, brand: str, description: str, page_category_hint: str = ""
) -> Category:
    hint_line = f"\nPage's own category label: {page_category_hint}" if page_category_hint else ""
    summary = f"Product: {name}\nBrand: {brand}\nDescription: {description[:400]}{hint_line}"

    # Step 1 — pick top-level bucket (~21 options, each with child hints)
    tops = _top_level_categories()
    step1: _Pick = await ai.responses(
        MODEL,
        summary
        + "\n\nWhich top-level Google Product Taxonomy category fits this product?\n\n"
        + _category_tree_summary()
        + "\n\nPick exactly one top-level category name from the list above.",
        text_format=_Pick,
    )
    chosen_top = _fuzzy_match(step1.category, tops) or tops[0]

    # Step 2 — pick depth-2 category (direct children, typically 5–20 options)
    depth2 = _direct_children(chosen_top)
    if depth2:
        step2: _Pick = await ai.responses(
            MODEL,
            summary
            + f"\n\nTop-level category: {chosen_top}\n\n"
            + "Which subcategory fits best?\n\n"
            + "\n".join(f"- {c}" for c in depth2)
            + "\n\nPick exactly one.",
            text_format=_Pick,
        )
        chosen_d2 = _fuzzy_match(step2.category, depth2) or chosen_top
    else:
        chosen_d2 = chosen_top

    # Step 3 — pick specific leaf from the depth-2 subtree (typically 5–50 options)
    depth3_and_below = [
        c for c in VALID_CATEGORIES if c.startswith(chosen_d2 + " > ")
    ]
    if depth3_and_below:
        step3: _Pick = await ai.responses(
            MODEL,
            summary
            + f"\n\nCategory so far: {chosen_d2}\n\n"
            + "Pick the most specific matching subcategory:\n\n"
            + "\n".join(f"- {c}" for c in sorted(depth3_and_below))
            + "\n\nPick exactly one, or respond with the parent category if none fit.",
            text_format=_Pick,
        )
        chosen_final = step3.category
    else:
        chosen_final = chosen_d2

    if chosen_final in VALID_CATEGORIES:
        return Category(name=chosen_final)

    # Walk up the path until we hit a valid ancestor
    segments = chosen_final.split(" > ")
    for i in range(len(segments), 0, -1):
        candidate = " > ".join(segments[:i])
        if candidate in VALID_CATEGORIES:
            return Category(name=candidate)

    return Category(name=chosen_top if chosen_top in VALID_CATEGORIES else tops[0])


# ── Product extraction (AI, 1 call) ──────────────────────────────────────────

class _ProductDraft(BaseModel):
    """Mirrors Product but without the category validator — AI fills this in."""
    name: str
    price: Price
    description: str
    key_features: list[str]
    image_urls: list[str]
    video_url: str | None = None
    brand: str
    colors: list[str]
    variants: list[Variant]


_SYSTEM = """\
You are a product data extraction expert. Extract complete, accurate product \
information from a product detail page.

Rules:
- image_urls: ALL product images. Prepend "https:" to protocol-relative URLs \
  (e.g. "//cdn.example.com/img.jpg" → "https://cdn.example.com/img.jpg"). \
  Deduplicate. Full-resolution preferred.
- variants: ALL discrete configurations (color × size × fit × finish × etc.). \
  For each variant include: sku, color, size, price (only if it differs from \
  the base price), image_url (if variant-specific), in_stock (false only if \
  explicitly stated as unavailable).
- key_features: 3–10 main selling points or features listed on the page.
- colors: every available color or finish option.
- price: the current selling price a customer would pay today. \
  compare_at_price: only set this if there is a visibly higher "original" / \
  "was" / "regular" price shown alongside a lower current price — it must \
  always be greater than price. Leave it null if the product is not on sale.
- brand: the manufacturer or brand name.
- description: clean, complete product description from the page.
"""


async def _extract_draft(context: str) -> _ProductDraft:
    return await ai.responses(
        MODEL,
        [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": context},
        ],
        text_format=_ProductDraft,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def _extract_page_category_hint(html: str) -> str:
    """Pull the page's own category label from JSON-LD if present."""
    for block in extract_json_ld(html):
        items = block if isinstance(block, list) else [block]
        for item in items:
            if isinstance(item, dict) and item.get("category"):
                cat = item["category"]
                return cat if isinstance(cat, str) else str(cat)
    return ""


async def parse_html(html: str) -> Product:
    context = build_context(html)
    draft = await _extract_draft(context)
    hint = _extract_page_category_hint(html)
    category = await _assign_category(draft.name, draft.brand, draft.description, hint)
    # Deduplicate image URLs while preserving order
    seen: set[str] = set()
    unique_images = []
    for url in draft.image_urls:
        if url not in seen:
            seen.add(url)
            unique_images.append(url)

    return Product(
        name=draft.name,
        price=draft.price,
        description=draft.description,
        key_features=draft.key_features,
        image_urls=unique_images,
        video_url=draft.video_url,
        category=category,
        brand=draft.brand,
        colors=draft.colors,
        variants=draft.variants,
    )
