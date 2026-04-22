import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Product } from '../types'
import { formatPrice } from '../utils'

interface ProductCardProps {
  product: Product
  index: number
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const mainImage = product.image_urls[0]
  const isOnSale =
    product.price.compare_at_price !== null &&
    product.price.compare_at_price > product.price.price

  return (
    <Link
      to={`/products/${index}`}
      className="block no-underline group animate-fade-in-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Image container */}
      <div className="aspect-[3/4] bg-[#ECEAE6] overflow-hidden mb-4 relative">
        {mainImage && !imgError ? (
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-light text-[#C8C4BE] select-none">
              {product.brand.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Product info */}
      <div>
        <p className="text-[10px] tracking-[0.15em] uppercase text-muted mb-1">
          {product.brand}
        </p>
        <p className="text-sm font-normal leading-snug text-ink mb-1.5">
          {product.name}
        </p>
        <div className="flex items-baseline gap-2">
          {isOnSale ? (
            <>
              <span className="text-xs line-through text-muted">
                {formatPrice(product.price.compare_at_price!, product.price.currency)}
              </span>
              <span className="text-sm text-[#B5451B]">
                {formatPrice(product.price.price, product.price.currency)}
              </span>
            </>
          ) : (
            <span className="text-sm text-ink">
              {formatPrice(product.price.price, product.price.currency)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
