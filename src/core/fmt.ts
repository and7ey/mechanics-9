export function num(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return s.replace('.', ',')
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
