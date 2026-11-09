import type { GraphSpec } from '../types'

export const PAGE_W = 1.1
export const PAGE_H = 1.45
export const CANVAS_W = 1400
export const CANVAS_H = Math.round((CANVAS_W * PAGE_H) / PAGE_W)
export const SCALE = CANVAS_W / PAGE_W

export const INK = '#273463'
export const INK2 = 'rgba(39,52,99,0.66)'
export const HAIR = 'rgba(39,52,99,0.28)'
export const ACCENT = '#9a3b2a'
export const PAPER = '#efe5d1'

export const SERIF = '"Source Serif 4", Georgia, serif'
export const HAND = '"Caveat", cursive'

export function makeCanvas(w = CANVAS_W, h = CANVAS_H): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

let paperBase: HTMLCanvasElement | null = null

/** Бумага: тёплый фон, волокна и лёгкое затемнение у краёв. */
export function paper(): HTMLCanvasElement {
  if (paperBase) return paperBase
  const c = makeCanvas()
  const ctx = c.getContext('2d')!
  const s = SCALE
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)

  // волокна
  let seed = 90210
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  ctx.save()
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * PAGE_W
    const y = rnd() * PAGE_H
    const a = rnd() * Math.PI
    const l = 0.002 + rnd() * 0.007
    ctx.strokeStyle = rnd() < 0.55 ? 'rgba(120,95,60,0.05)' : 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 0.0012 + rnd() * 0.0012
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  ctx.restore()

  // мягкие пятна
  for (let i = 0; i < 14; i++) {
    const x = rnd() * PAGE_W
    const y = rnd() * PAGE_H
    const r = 0.06 + rnd() * 0.22
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(160,130,90,0.035)')
    g.addColorStop(1, 'rgba(160,130,90,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 7)
    ctx.fill()
  }

  // тень у корешка и по краям
  const edge = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, `rgba(90,68,44,${r0})`)
    g.addColorStop(1, `rgba(90,68,44,${r1})`)
    return g
  }
  ctx.fillStyle = edge(0, 0, 0.16, 0, 0.06, 0)
  ctx.fillRect(0, 0, 0.16, PAGE_H)
  ctx.fillStyle = edge(PAGE_W, 0, PAGE_W - 0.16, 0, 0.06, 0)
  ctx.fillRect(PAGE_W - 0.16, 0, 0.16, PAGE_H)
  ctx.fillStyle = edge(0, 0, 0, 0.1, 0.03, 0)
  ctx.fillRect(0, 0, PAGE_W, 0.1)
  ctx.fillStyle = edge(0, PAGE_H, 0, PAGE_H - 0.1, 0.03, 0)
  ctx.fillRect(0, PAGE_H - 0.1, PAGE_W, 0.1)

  paperBase = c
  return c
}

export function clearPage(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(paper(), 0, 0)
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export function font(ctx: CanvasRenderingContext2D, size: number, weight: number | string = 400, italic = false, family = SERIF) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

export function caps(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = INK, weight = 600) {
  ctx.save()
  font(ctx, size, weight)
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = `${(size * 0.12).toFixed(2)}px`
  ctx.fillStyle = color
  ctx.fillText(text.toUpperCase(), x, y)
  ;(ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
  ctx.restore()
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(t).width > maxW) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

export function paragraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  lh: number,
  opts: { weight?: number; italic?: boolean; color?: string; family?: string } = {},
): number {
  font(ctx, size, opts.weight ?? 400, opts.italic ?? false, opts.family ?? SERIF)
  ctx.fillStyle = opts.color ?? INK
  const lines = wrap(ctx, text, maxW)
  for (const line of lines) {
    ctx.fillText(line, x, y)
    y += lh
  }
  return y
}

function drawRuns(ctx: CanvasRenderingContext2D, runs: string[], x: number, y: number, size: number, weight: number) {
  let cx = x
  for (const run of runs) {
    if (!run) continue
    const first = run[0]
    if (first === '_' || first === '^') {
      const inner = run.slice(1)
      font(ctx, size * 0.62, weight)
      ctx.fillText(inner, cx, first === '_' ? y + size * 0.16 : y - size * 0.38)
      cx += ctx.measureText(inner).width + size * 0.03
    } else {
      font(ctx, size, weight)
      ctx.fillText(run, cx, y)
      cx += ctx.measureText(run).width
    }
  }
  return cx
}

/** Формула с пометками _{низ} и ^{верх}. */
export function formula(ctx: CanvasRenderingContext2D, markup: string, x: number, y: number, size: number, weight = 500) {
  const runs: string[] = []
  let i = 0
  let cur = ''
  while (i < markup.length) {
    const ch = markup[i]
    if ((ch === '_' || ch === '^') && markup[i + 1] === '{') {
      if (cur) {
        runs.push(cur)
        cur = ''
      }
      const end = markup.indexOf('}', i + 2)
      runs.push(ch + markup.slice(i + 2, end))
      i = end + 1
    } else {
      cur += ch
      i++
    }
  }
  if (cur) runs.push(cur)
  ctx.save()
  ctx.fillStyle = INK
  const end = drawRuns(ctx, runs, x, y, size, weight)
  ctx.restore()
  return end - x
}

export function formulaWidth(ctx: CanvasRenderingContext2D, markup: string, size: number, weight = 500): number {
  const save = ctx.getTransform()
  const runs: string[] = []
  let i = 0
  let cur = ''
  while (i < markup.length) {
    const ch = markup[i]
    if ((ch === '_' || ch === '^') && markup[i + 1] === '{') {
      if (cur) {
        runs.push(cur)
        cur = ''
      }
      const end = markup.indexOf('}', i + 2)
      runs.push(ch + markup.slice(i + 2, end))
      i = end + 1
    } else {
      cur += ch
      i++
    }
  }
  if (cur) runs.push(cur)
  let cx = 0
  for (const run of runs) {
    const first = run[0]
    if (first === '_' || first === '^') {
      font(ctx, size * 0.62, weight)
      cx += ctx.measureText(run.slice(1)).width + size * 0.03
    } else {
      font(ctx, size, weight)
      cx += ctx.measureText(run).width
    }
  }
  ctx.setTransform(save)
  return cx
}

export function rule(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color = HAIR, width = 0.0016) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  ctx.restore()
}

export function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke = 'rgba(39,52,99,0.22)',
  lw = 0.0018,
) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.stroke()
  }
  ctx.restore()
}

export function checkbox(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, on: boolean) {
  const s = 0.021
  const top = y - s + 0.004
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.0018
  ctx.strokeRect(x, top, s, s)
  if (on) {
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 0.0032
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + s * 0.14, top + s * 0.55)
    ctx.lineTo(x + s * 0.42, top + s * 0.82)
    ctx.lineTo(x + s * 0.9, top + s * 0.16)
    ctx.stroke()
  }
  ctx.restore()
}

/** График на бумаге: оси, штрихи, точки, теоретическая прямая. */
export function graph(ctx: CanvasRenderingContext2D, spec: GraphSpec, x: number, y: number, w: number, h: number) {
  const x0 = x + 0.062
  const y0 = y + h - 0.05
  const x1 = x + w - 0.012
  const y1 = y + 0.02

  ctx.save()
  ctx.strokeStyle = 'rgba(39,52,99,0.8)'
  ctx.lineWidth = 0.002
  ctx.beginPath()
  ctx.moveTo(x0, y1)
  ctx.lineTo(x0, y0)
  ctx.lineTo(x1, y0)
  ctx.stroke()

  const xt = (v: number) => x0 + (v / spec.xMax) * (x1 - x0)
  const yt = (v: number) => y0 - (v / spec.yMax) * (y0 - y1)

  // штрихи
  const xs = spec.xStep ?? spec.xMax / 5
  const ys = spec.yStep ?? spec.yMax / 3
  ctx.strokeStyle = HAIR
  font(ctx, 0.0175, 500)
  ctx.fillStyle = INK2
  ctx.textAlign = 'center'
  for (let v = 0; v <= spec.xMax + 1e-9; v += xs) {
    ctx.beginPath()
    ctx.moveTo(xt(v), y0)
    ctx.lineTo(xt(v), y0 + 0.006)
    ctx.stroke()
    if (v > 0) ctx.fillText(String(Math.round(v * 10) / 10), xt(v), y0 + 0.028)
  }
  ctx.textAlign = 'right'
  for (let v = 0; v <= spec.yMax + 1e-9; v += ys) {
    ctx.beginPath()
    ctx.moveTo(x0 - 0.006, yt(v))
    ctx.lineTo(x0, yt(v))
    ctx.stroke()
    if (v > 0) ctx.fillText(String(Math.round(v * 10) / 10), x0 - 0.01, yt(v) + 0.006)
  }
  ctx.textAlign = 'left'

  // теоретическая прямая
  if (spec.slope && spec.slope > 0) {
    const top = Math.min(spec.yMax, spec.slope * spec.xMax)
    ctx.setLineDash([0.009, 0.007])
    ctx.strokeStyle = 'rgba(154,59,42,0.55)'
    ctx.lineWidth = 0.0018
    ctx.beginPath()
    ctx.moveTo(xt(0), yt(0))
    ctx.lineTo(xt(top / spec.slope), yt(top))
    ctx.stroke()
    ctx.setLineDash([])
  }

  // точки
  for (const p of spec.points) {
    const px = xt(Math.min(p.x, spec.xMax))
    const py = yt(Math.min(p.y, spec.yMax))
    ctx.fillStyle = ACCENT
    ctx.beginPath()
    ctx.arc(px, py, 0.0065, 0, 7)
    ctx.fill()
    ctx.strokeStyle = 'rgba(154,59,42,0.35)'
    ctx.lineWidth = 0.0012
    ctx.beginPath()
    ctx.arc(px, py, 0.011, 0, 7)
    ctx.stroke()
  }

  // подписи осей
  font(ctx, 0.02, 560, false, HAND)
  ctx.fillStyle = INK2
  ctx.textAlign = 'center'
  ctx.fillText(spec.xLabel, (x0 + x1) / 2, y0 + 0.05)
  ctx.save()
  ctx.translate(x0 - 0.075, (y0 + y1) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(spec.yLabel, 0, 0)
  ctx.restore()
  ctx.restore()
}
