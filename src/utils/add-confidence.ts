import type { AIResult } from '../types/product.ts';

export default function addConfidence(result: AIResult) {
  return {
    ...result,
    products: result.products.map((p) => {
      const hasValidPrice =
        typeof p.price === 'number' && p.price > 0 && p.price < 10000;

      const hasGoodName =
        typeof p.name === 'string' &&
        p.name.length >= 4 &&
        !/^[^a-zA-Zа-яА-Я]+$/.test(p.name);

      const hasBrand = Boolean(p.brand);

      let score = 0;
      if (hasValidPrice) {
        score += 2;
      }
      if (hasGoodName) {
        score += 1;
      }
      if (hasBrand) {
        score += 1;
      }

      let confidenceLevel: 'low' | 'medium' | 'high';
      if (score >= 4) {
        confidenceLevel = 'high';
      } else if (score >= 2) {
        confidenceLevel = 'medium';
      } else {
        confidenceLevel = 'low';
      }

      return {
        ...p,
        confidence: confidenceLevel,
      };
    }),
  };
}
