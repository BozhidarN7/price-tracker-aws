import type { AIResult } from '../types/product.ts';

export default function addConfidence(result: AIResult) {
  return {
    ...result,
    products: result.products.map((p) => ({
      ...p,
      confidence: {
        name: p.name.length > 5 ? 0.9 : 0.6,
        price: typeof p.price === 'number' ? 0.95 : 0.4,
        brand: p.brand ? 0.7 : 0.3,
      },
    })),
  };
}
