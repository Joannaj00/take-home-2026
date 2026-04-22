import { useEffect, useState } from 'react'
import { Product } from '../types'
import ProductCard from '../components/ProductCard'

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="px-8 pt-14 pb-10 flex items-baseline justify-between">
        <h1 className="text-base font-normal tracking-wide text-ink">All Products</h1>
        {!loading && (
          <span className="text-sm text-muted">
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>

      {/* Divider */}
      <div className="h-px bg-stone mx-8 mb-14" />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-32">
          <span className="text-sm text-muted tracking-widest uppercase">Loading</span>
        </div>
      ) : (
        <main className="px-8 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {products.map((product, i) => (
              <ProductCard key={i} product={product} index={i} />
            ))}
          </div>
        </main>
      )}
    </div>
  )
}
