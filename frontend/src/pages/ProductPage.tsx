import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Product } from '../types'
import { formatPrice } from '../utils'

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [mainImgError, setMainImgError] = useState(false)

  useEffect(() => {
    if (id === undefined) return
    setLoading(true)
    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data: Product) => {
        setProduct(data)
        setActiveImage(0)
        setMainImgError(false)
        // Initialize color/size selections
        if (data.colors.length > 0) {
          setSelectedColor(data.colors[0])
        } else {
          setSelectedColor('')
        }
        // Pick first in-stock size for initial color
        const initialColor = data.colors.length > 0 ? data.colors[0] : null
        const sizes = getUniqueSizes(data)
        const firstAvailableSize = sizes.find((s) =>
          data.variants.some(
            (v) =>
              (initialColor === null || v.color === initialColor || data.colors.length <= 1) &&
              v.size === s &&
              v.in_stock,
          ),
        )
        setSelectedSize(firstAvailableSize ?? (sizes[0] ?? ''))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const getUniqueSizes = (p: Product): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const v of p.variants) {
      if (v.size && !seen.has(v.size)) {
        seen.add(v.size)
        result.push(v.size)
      }
    }
    return result
  }

  const isSizeAvailable = useCallback(
    (size: string): boolean => {
      if (!product) return false
      return product.variants.some(
        (v) =>
          (v.color === selectedColor || product.colors.length <= 1) &&
          v.size === size &&
          v.in_stock,
      )
    },
    [product, selectedColor],
  )

  const categoryLeaf = (name: string): string => {
    const parts = name.split('>')
    return parts[parts.length - 1].trim()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="text-sm text-muted tracking-widest uppercase">Loading</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted">Product not found.</p>
        <Link to="/" className="text-sm text-ink underline underline-offset-4">
          Back to catalog
        </Link>
      </div>
    )
  }

  const uniqueSizes = getUniqueSizes(product)
  const hasColors = product.colors.length > 1
  const hasSizes = uniqueSizes.length > 0
  const isOnSale =
    product.price.compare_at_price !== null &&
    product.price.compare_at_price > product.price.price

  const thumbnails = product.image_urls.slice(0, 8)
  const currentImageUrl = product.image_urls[activeImage] ?? product.image_urls[0]

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* LEFT PANEL */}
        <div className="lg:w-[58%] lg:sticky lg:top-0 lg:h-screen flex flex-col px-8 pt-10 pb-8">
          {/* Back link */}
          <Link
            to="/"
            className="text-sm text-muted hover:text-ink transition-colors duration-150 self-start mb-6"
          >
            ← All Products
          </Link>

          {/* Main image — flex-1 so it fills remaining panel height */}
          <div className="flex-1 min-h-0 bg-[#ECEAE6] overflow-hidden">
            {currentImageUrl && !mainImgError ? (
              <img
                key={activeImage}
                src={currentImageUrl}
                alt={product.name}
                className="w-full h-full object-contain transition-opacity duration-200"
                onError={() => setMainImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl font-light text-[#C8C4BE] select-none">
                  {product.brand.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {thumbnails.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
              {thumbnails.map((url, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveImage(i)
                    setMainImgError(false)
                  }}
                  className={`flex-shrink-0 w-14 h-14 bg-[#ECEAE6] overflow-hidden transition-all duration-150 ${
                    activeImage === i
                      ? 'ring-1 ring-ink opacity-100'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:w-[42%] overflow-y-auto px-8 lg:px-14 pt-10 lg:py-16 pb-20">
          {/* Full category path */}
          <p className="text-[10px] tracking-[0.15em] uppercase text-muted mb-6">
            {product.category.name}
          </p>

          {/* Brand */}
          <p className="text-xs tracking-widest uppercase text-muted mb-2">
            {product.brand}
          </p>

          {/* Product name */}
          <h1 className="text-[1.6rem] font-light leading-tight text-ink mb-5">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-5">
            {isOnSale ? (
              <>
                <span className="text-xl text-[#B5451B]">
                  {formatPrice(product.price.price, product.price.currency)}
                </span>
                <span className="text-sm line-through text-muted">
                  {formatPrice(product.price.compare_at_price!, product.price.currency)}
                </span>
                <span className="text-xs font-medium text-[#B5451B] bg-[#B5451B]/10 px-1.5 py-0.5">
                  {Math.round((1 - product.price.price / product.price.compare_at_price!) * 100)}% off
                </span>
              </>
            ) : (
              <span className="text-xl text-ink">
                {formatPrice(product.price.price, product.price.currency)}
              </span>
            )}
          </div>

          <div className="h-px bg-stone mb-7" />

          {/* Colors */}
          {hasColors && (
            <div className="mb-6">
              <p className="text-[10px] tracking-widest uppercase text-muted mb-3">
                Color — <span className="text-ink">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-3 h-9 text-xs border transition-all duration-150 ${
                      selectedColor === color
                        ? 'border-ink bg-ink text-white'
                        : 'border-stone text-ink hover:border-ink'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {hasSizes && (
            <div className="mb-7">
              <p className="text-[10px] tracking-widest uppercase text-muted mb-3">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueSizes.map((size) => {
                  const available = isSizeAvailable(size)
                  return (
                    <button
                      key={size}
                      onClick={() => available && setSelectedSize(size)}
                      disabled={!available}
                      className={`min-w-[3rem] px-3 h-9 text-xs border transition-all duration-150 ${
                        selectedSize === size
                          ? 'border-ink bg-ink text-white'
                          : 'border-stone text-ink hover:border-ink'
                      } ${!available ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(hasColors || hasSizes) && <div className="h-px bg-stone mb-7" />}

          {/* Description */}
          <p className="text-sm text-[#555555] leading-relaxed mb-7 whitespace-pre-line">
            {product.description}
          </p>

          <div className="h-px bg-stone mb-7" />

          {/* Key features */}
          {product.key_features.length > 0 && (
            <div className="mb-10">
              <p className="text-[10px] tracking-widest uppercase text-muted mb-3">
                Details
              </p>
              <ul className="space-y-2">
                {product.key_features.map((feature, i) => (
                  <li key={i} className="flex gap-2.5 items-start">
                    <span className="text-muted text-sm leading-relaxed flex-shrink-0">*</span>
                    <span className="text-sm text-[#444444] leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
