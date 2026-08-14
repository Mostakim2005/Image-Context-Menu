export function isValidResizeValue(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) > 0;
  const match = /^(\d+)x(\d+)$/i.exec(trimmed);
  if (!match) return false;
  return Number(match[1]) > 0 && Number(match[2]) > 0;
}

export function normalizeResizeValue(value: string): string {
  return value.trim().replace(/\s+/g, '');
}
