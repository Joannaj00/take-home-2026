import asyncio
import json
import logging
from pathlib import Path

from extractor import parse_html

logger = logging.getLogger(__name__)


async def process_file(path: Path) -> dict:
    logger.info(f"Parsing {path.name} ...")
    html = path.read_text(encoding="utf-8", errors="ignore")
    product = await parse_html(html)
    logger.info(
        f"  ✓ {product.name} | {product.category.name} "
        f"| {len(product.variants)} variants | {len(product.image_urls)} images"
    )
    return product.model_dump()


async def main():
    data_dir = Path("data")
    html_files = sorted(data_dir.glob("*.html"))
    logger.info(f"Found {len(html_files)} HTML files")

    results = await asyncio.gather(
        *[process_file(p) for p in html_files],
        return_exceptions=True,
    )

    products = []
    for path, result in zip(html_files, results):
        if isinstance(result, Exception):
            logger.error(f"Failed {path.name}: {result}")
        else:
            products.append(result)

    output = Path("products.json")
    output.write_text(json.dumps(products, indent=2))
    logger.info(f"Saved {len(products)} products to {output}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    asyncio.run(main())
