export const G = 9.8

/** Удлинение пружины по закону Гука: Δl = F / k. */
export function springDelta(f: number, k: number): number {
  if (!(k > 0)) return 0
  return Math.max(0, f) / k
}

/** Жёсткость по измеренным F и Δl. */
export function stiffness(f: number, dl: number): number {
  if (!(dl > 0)) return Number.NaN
  return f / dl
}

/** Вес тела при ускорении опоры: P = m(g + a), где a > 0 — вверх. */
export function weightForce(m: number, g = G, a = 0): number {
  return Math.max(0, m * (g + a))
}

/** Предел трения покоя: F = μN, N = mg. */
export function frictionMax(mu: number, m: number, g = G): number {
  return mu * m * g
}

/** Испытание §23: удлинение ровно 5,0 см (с допуском 1,2 мм). */
export function springChallengeMet(dlMetres: number, plastic: boolean): boolean {
  return !plastic && Math.abs(dlMetres - 0.05) <= 0.0012
}

/** Испытание §24: перегрузка 1,5 mg. */
export function overloadMet(m: number, g: number, a: number): boolean {
  const p = weightForce(m, g, a)
  return Math.abs(p - 1.5 * m * g) < 1e-6
}

/** Испытание §25: брусок сдвинут по льду при силе меньше 2 Н. */
export function iceChallengeMet(peakForce: number, moved: number): boolean {
  return peakForce > 0.1 && peakForce < 2 && moved > 0.12
}
