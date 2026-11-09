export interface Progress {
  bookmark: number
  visited: Record<number, true>
  stamps: Record<number, true>
  predicts: Record<number, number | null>
  flaps: Record<number, true>
}

const KEY = 'mechanics9:v1'

const EMPTY: Progress = {
  bookmark: 1,
  visited: {},
  stamps: {},
  predicts: {},
  flaps: {},
}

export class Store {
  data: Progress = { ...EMPTY }
  private ok = true

  constructor() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) this.data = { ...EMPTY, ...JSON.parse(raw) }
    } catch {
      this.ok = false
    }
  }

  private save() {
    if (!this.ok) return
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch {
      this.ok = false
    }
  }

  visit(k: number) {
    if (this.data.visited[k]) return
    this.data.visited[k] = true
    this.save()
  }

  bookmark(k: number) {
    if (this.data.bookmark === k) return
    this.data.bookmark = k
    this.save()
  }

  stamp(k: number): boolean {
    if (this.data.stamps[k]) return false
    this.data.stamps[k] = true
    this.save()
    return true
  }

  predict(k: number, n: number | null) {
    this.data.predicts[k] = n
    this.save()
  }

  flap(k: number, open: boolean) {
    if (open) this.data.flaps[k] = true
    else delete this.data.flaps[k]
    this.save()
  }

  reset() {
    this.data = { ...EMPTY }
    this.save()
  }
}

export const store = new Store()
