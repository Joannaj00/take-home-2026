import { useEffect, useState } from 'react'
import { Product } from '../types'
import ProductCard from '../components/ProductCard'

interface CategoryNode {
  label: string
  prefix: string
  children: { label: string; prefix: string }[]
}

function buildCategoryTree(products: Product[]): CategoryNode[] {
  const tree = new Map<string, CategoryNode>()
  for (const p of products) {
    const parts = p.category.name.split(' > ')
    const topLabel = parts[0].trim()
    if (!tree.has(topLabel)) {
      tree.set(topLabel, { label: topLabel, prefix: topLabel, children: [] })
    }
    if (parts.length >= 2) {
      const node = tree.get(topLabel)!
      const childLabel = parts[1].trim()
      const childPrefix = `${topLabel} > ${childLabel}`
      if (!node.children.some((c) => c.prefix === childPrefix)) {
        node.children.push({ label: childLabel, prefix: childPrefix })
      }
    }
  }
  return Array.from(tree.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function matchesFilter(product: Product, filter: string): boolean {
  return (
    product.category.name === filter ||
    product.category.name.startsWith(filter + ' > ')
  )
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data: Product[]) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const tree = buildCategoryTree(products)
  const filtered = activeFilter
    ? products.filter((p) => matchesFilter(p, activeFilter))
    : products

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="px-8 pt-14 pb-10 flex items-baseline justify-between">
        <h1 className="text-base font-normal tracking-wide text-ink">Channel3 mini</h1>
        {!loading && (
          <span className="text-sm text-muted">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>

      {/* Divider + filter bar */}
      <div className="border-t border-stone mx-8" />
      {!loading && tree.length > 1 && (
        <div className="flex items-center gap-0 px-8 border-b border-stone">
          {/* All */}
          <button
            onClick={() => setActiveFilter(null)}
            className={`h-11 px-4 text-xs tracking-wide border-r border-stone transition-colors duration-150 ${
              activeFilter === null ? 'text-ink font-medium' : 'text-muted hover:text-ink'
            }`}
          >
            All
          </button>

          {/* Top-level categories */}
          {tree.map((node) => {
            const isActive =
              activeFilter === node.prefix ||
              (activeFilter?.startsWith(node.prefix + ' > ') ?? false)
            return (
              <div
                key={node.prefix}
                className="relative"
                onMouseEnter={() => setHovered(node.prefix)}
                onMouseLeave={() => setHovered(null)}
              >
                <button
                  onClick={() => setActiveFilter(activeFilter === node.prefix ? null : node.prefix)}
                  className={`h-11 px-4 text-xs tracking-wide border-r border-stone transition-colors duration-150 flex items-center gap-1 ${
                    isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink'
                  }`}
                >
                  {node.label}
                  {node.children.length > 0 && (
                    <span className="text-[9px] opacity-60">▾</span>
                  )}
                </button>

                {/* Dropdown */}
                {hovered === node.prefix && node.children.length > 0 && (
                  <div className="absolute top-full left-0 z-20 bg-cream border border-stone min-w-max shadow-sm">
                    {node.children.map((child) => (
                      <button
                        key={child.prefix}
                        onClick={() =>
                          setActiveFilter(activeFilter === child.prefix ? null : child.prefix)
                        }
                        className={`block w-full text-left px-4 py-2.5 text-xs tracking-wide transition-colors duration-150 border-b border-stone last:border-0 ${
                          activeFilter === child.prefix
                            ? 'text-ink font-medium bg-stone'
                            : 'text-muted hover:text-ink hover:bg-stone'
                        }`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-32">
          <span className="text-sm text-muted tracking-widest uppercase">Loading</span>
        </div>
      ) : (
        <main className="px-8 pb-24 pt-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {filtered.map((product) => {
              const originalIndex = products.indexOf(product)
              return <ProductCard key={originalIndex} product={product} index={originalIndex} />
            })}
          </div>
        </main>
      )}
    </div>
  )
}
