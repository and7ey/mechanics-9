export interface Keyword {
  term: string
  definition: string
}

export interface SwitchDef {
  id: string
  label: string
  options: string[]
}

export interface Predict {
  question: string
  options: string[]
  answer: number
}

export interface Lesson {
  /** Номер параграфа */
  n: number
  title: string
  runningHead: string
  /** Подпись рисунка */
  figure: string
  figureNote?: string
  explanation: string[]
  equation: { symbols: string; words: string }
  keywords: Keyword[]
  predict: Predict
  tryHint: string
  explain: string
  challenge: { text: string; done: string }
  switches: SwitchDef[]
  scene: SceneId
  sources?: string[]
}

export type SceneId = 'spring' | 'lift' | 'friction'

export interface Chapter {
  n: number
  title: string
  paragraphs: number[]
}

export interface ParagraphRef {
  n: number
  title: string
  ready: boolean
}

export type Spread =
  | { kind: 'title'; short: string; title: string }
  | { kind: 'lesson'; short: string; title: string; lesson: Lesson }
  | { kind: 'summary'; short: string; title: string }

export interface MarginLine {
  text: string
  size?: number
  gap?: number
}

export interface Hit {
  kind: string
  u0: number
  v0: number
  u1: number
  v1: number
  data?: unknown
}

export interface Point {
  x: number
  y: number
}

export interface GraphSpec {
  points: Point[]
  xMax: number
  yMax: number
  xLabel: string
  yLabel: string
  /** Теоретическая прямая: y = slope * x */
  slope?: number
  xStep?: number
  yStep?: number
}
