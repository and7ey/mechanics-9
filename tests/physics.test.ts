import { describe, expect, it } from 'vitest'
import {
  G,
  frictionMax,
  iceChallengeMet,
  overloadMet,
  springChallengeMet,
  springDelta,
  stiffness,
  weightForce,
} from '../src/physics'

describe('закон Гука', () => {
  it('удлинение при 3 Н и 60 Н/м равно 5 см', () => {
    expect(springDelta(3, 60)).toBeCloseTo(0.05, 6)
  })
  it('жёсткость восстанавливается по F и Δl', () => {
    expect(stiffness(3, 0.05)).toBeCloseTo(60, 6)
  })
  it('нулевая нагрузка не растягивает пружину', () => {
    expect(springDelta(0, 60)).toBe(0)
  })
  it('испытание засчитывает ровно 5 см', () => {
    expect(springChallengeMet(0.05, false)).toBe(true)
    expect(springChallengeMet(0.06, false)).toBe(false)
    expect(springChallengeMet(0.05, true)).toBe(false)
  })
})

describe('вес тела', () => {
  it('в покое P = mg', () => {
    expect(weightForce(1, G, 0)).toBeCloseTo(9.8, 6)
  })
  it('при разгоне вверх P = m(g + a)', () => {
    expect(weightForce(1, G, 4.9)).toBeCloseTo(14.7, 6)
  })
  it('при разгоне вниз P = m(g − a)', () => {
    expect(weightForce(1, G, -4.9)).toBeCloseTo(4.9, 6)
  })
  it('в свободном падении вес равен нулю', () => {
    expect(weightForce(1, G, -G)).toBe(0)
  })
  it('испытание требует перегрузку 1,5 mg', () => {
    expect(overloadMet(1, G, 4.9)).toBe(true)
    expect(overloadMet(1, G, 0)).toBe(false)
  })
})

describe('сила трения', () => {
  it('предел трения покоя F = μN', () => {
    expect(frictionMax(0.4, 2, G)).toBeCloseTo(7.84, 6)
  })
  it('на льду предел меньше 1 Н', () => {
    expect(frictionMax(0.05, 2, G)).toBeLessThan(1)
  })
  it('испытание на льду требует малой силы', () => {
    expect(iceChallengeMet(1.2, 0.2)).toBe(true)
    expect(iceChallengeMet(2.5, 0.2)).toBe(false)
    expect(iceChallengeMet(1.2, 0.05)).toBe(false)
  })
})
