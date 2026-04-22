import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Product Catalog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PRODUCTS_FILE = Path(__file__).parent / "products.json"


def load_products() -> list[dict]:
    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/products")
def get_products() -> list[dict]:
    return load_products()


@app.get("/api/products/{product_id}")
def get_product(product_id: int) -> dict:
    products = load_products()
    if product_id < 0 or product_id >= len(products):
        raise HTTPException(status_code=404, detail="Product not found")
    return products[product_id]
