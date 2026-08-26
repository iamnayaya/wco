'use client';

import Link from 'next/link';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { formatMoney } from '../../lib/utils/format';
import type { TopProduct } from '../../hooks/use-dashboard';

interface TopProductsProps {
  products?: TopProduct[];
  isLoading: boolean;
}

export function TopProducts({ products, isLoading }: TopProductsProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Products</h3>
        <Link
          href="/products"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : !products?.length ? (
        <div className="py-6">
          <EmptyState title="No products yet" description="Add your first product to get started." />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {products.slice(0, 5).map((product, index) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {product.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {product.unitsSold} units sold
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatMoney(product.revenue)}
                </p>
                {product.stock < 10 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {product.stock} left
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
