import type { PriceEntry } from '../types/product.ts';

export default function computeTendencyMetrics(
  priceHistory: PriceEntry[] = [],
) {
  if (priceHistory.length === 0) {
    return {
      averagePrice: 0,
      lowestPrice: 0,
      highestPrice: 0,
      trend: 'stable',
    };
  }

  const prices = priceHistory.map((p) => p.price);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  let trend = 'stable';
  if (prices.length > 1) {
    const last = prices[prices.length - 1];
    const prev = prices[prices.length - 2];
    if (last > prev) trend = 'up';
    else if (last < prev) trend = 'down';
  }

  return { averagePrice, lowestPrice, highestPrice, trend };
}
