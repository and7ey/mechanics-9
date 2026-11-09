import { describe, expect, it } from 'vitest'
import { CHAPTERS, LESSONS, PARAGRAPHS, SPREADS, paragraphTitle } from '../src/content/book'

describe('контент книги', () => {
  it('параграфы имеют уникальные номера', () => {
    const ns = LESSONS.map((l) => l.n)
    expect(new Set(ns).size).toBe(ns.length)
  })

  it('у каждого параграфа заполнены обязательные поля', () => {
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(3)
      expect(l.explanation.length).toBeGreaterThanOrEqual(2)
      expect(l.keywords.length).toBeGreaterThanOrEqual(3)
      expect(l.predict.options.length).toBeGreaterThanOrEqual(2)
      expect(l.predict.answer).toBeGreaterThanOrEqual(0)
      expect(l.predict.answer).toBeLessThan(l.predict.options.length)
      expect(l.equation.symbols.length).toBeGreaterThan(0)
      expect(l.challenge.text.length).toBeGreaterThan(10)
      expect(l.scene).toMatch(/^(spring|lift|friction)$/)
    }
  })

  it('все параграфы из оглавления имеют заголовок', () => {
    for (const ch of CHAPTERS) {
      for (const n of ch.paragraphs) expect(paragraphTitle(n).length).toBeGreaterThan(0)
    }
  })

  it('оглавление покрывает §1–§61 без пропусков', () => {
    const all = CHAPTERS.flatMap((c) => c.paragraphs).sort((a, b) => a - b)
    expect(all[0]).toBe(1)
    expect(all[all.length - 1]).toBe(61)
    expect(all.length).toBe(61)
  })

  it('развороты ссылаются на готовые параграфы', () => {
    for (const sp of SPREADS) {
      if (sp.kind !== 'lesson') continue
      expect(PARAGRAPHS.find((p) => p.n === sp.lesson.n)?.ready).toBe(true)
    }
  })
})
