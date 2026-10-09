let counter = 0;

/** Short unique id with a readable prefix. */
export function newId(prefix: string): string {
  counter++;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}-${rand}`;
}
