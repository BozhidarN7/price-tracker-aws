export function formatDate(
  dateString: string,
  options?: { short?: boolean },
): string {
  const safeDateString = dateString.replace(/:(\d{3})Z$/, '.$1Z'); // fix malformed input
  const date = new Date(safeDateString);

  if (isNaN(date.getTime())) return ''; // handle invalid date

  return date.toLocaleDateString('en-US', {
    month: options?.short ? 'short' : 'long',
    day: 'numeric',
    year: options?.short ? undefined : 'numeric',
  });
}
