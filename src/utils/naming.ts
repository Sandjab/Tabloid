export function nextAvailableName(prefix: string, existingNames: string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const usedIndices = new Set<number>();
  for (const name of existingNames) {
    const match = name.match(pattern);
    if (match) usedIndices.add(Number(match[1]));
  }
  let i = 1;
  while (usedIndices.has(i)) i++;
  return `${prefix}${i}`;
}
