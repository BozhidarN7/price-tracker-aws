export default function normalize(value?: string) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9а-я]/gi, '')
      .trim() ?? 'unknown'
  );
}
