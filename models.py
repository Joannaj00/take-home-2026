from pathlib import Path
from pydantic import BaseModel, field_validator

CATEGORIES_FILE = Path(__file__).parent / "categories.txt"
VALID_CATEGORIES = set()
if CATEGORIES_FILE.exists():
    with open(CATEGORIES_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                VALID_CATEGORIES.add(line)


class Category(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name_exists(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Category '{v}' is not a valid Google Product Taxonomy category")
        return v


class Price(BaseModel):
    price: float
    currency: str
    compare_at_price: float | None = None


class Variant(BaseModel):
    sku: str | None = None
    color: str | None = None
    size: str | None = None
    price: Price | None = None
    image_url: str | None = None
    in_stock: bool = True


class Product(BaseModel):
    name: str
    price: Price
    description: str
    key_features: list[str]
    image_urls: list[str]
    video_url: str | None = None
    category: Category
    brand: str
    colors: list[str]
    variants: list[Variant]