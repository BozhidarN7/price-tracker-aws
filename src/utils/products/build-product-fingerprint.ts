import normalize from './normalize.ts';

export default function buildProductFingerprint(input: {
  name: string;
  brand?: string;
  category?: string;
  variant?: string;
}) {
  return [
    normalize(input.category ?? 'no-category'),
    normalize(input.brand ?? 'no-brand'),
    normalize(input.name),
    normalize(input.variant ?? 'no-variant'),
  ].join('|');
}
