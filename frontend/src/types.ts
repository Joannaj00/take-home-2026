export interface Price {
  price: number
  currency: string
  compare_at_price: number | null
}

export interface Variant {
  sku: string | null
  color: string | null
  size: string | null
  price: Price | null
  image_url: string | null
  in_stock: boolean
}

export interface Category {
  name: string
}

export interface Product {
  name: string
  price: Price
  description: string
  key_features: string[]
  image_urls: string[]
  video_url: string | null
  category: Category
  brand: string
  colors: string[]
  variants: Variant[]
}
