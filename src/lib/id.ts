export function createId(prefix = 'id'): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) return `${prefix}_${random}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
