import type { GraphSpec, Hit, Lesson, MarginLine } from '../types'
import {
  ACCENT,
  HAIR,
  INK,
  INK2,
  PAGE_H,
  PAGE_W,
  box,
  caps,
  checkbox,
  font,
  formula,
  formulaWidth,
  graph,
  paragraph,
  rule,
  wrap,
} from '../ink/canvas'

export interface PageState {
  predict: number | null
  flapOpen: boolean
  switches: Record<string, number>
  margin: MarginLine[]
  graph: GraphSpec | null
  stamped: boolean
  quiz: { picks: Record<number, number>; open: Record<number, boolean> }
  challengeMet: boolean
}

const L = {
  x0: 0.235,
  x1: 1.025,
  top: 0.095,
  body: 0.0242,
  lh: 0.0352,
}

const R = {
  x0: 0.075,
  x1: 1.035,
}

export const FLAP = { u0: 0.245, v0: 1.185, u1: 1.03, v1: 1.355 }

export function runningHead(ctx: CanvasRenderingContext2D, lesson: Lesson) {
  caps(ctx, `§ ${lesson.n} · ${lesson.runningHead}`, L.x0, 0.055, 0.0146, INK2)
  rule(ctx, L.x0, L.x1, 0.064)
}

export function folio(ctx: CanvasRenderingContext2D, n: number, side: 'left' | 'right') {
  font(ctx, 0.019, 500)
  ctx.fillStyle = INK2
  ctx.textAlign = side === 'left' ? 'left' : 'right'
  ctx.fillText(String(n), side === 'left' ? 0.06 : PAGE_W - 0.06, PAGE_H - 0.045)
  ctx.textAlign = 'left'
}

export function drawLessonLeft(
  ctx: CanvasRenderingContext2D,
  lesson: Lesson,
  st: PageState,
  pageNo: number,
): Hit[] {
  const hits: Hit[] = []
  runningHead(ctx, lesson)

  caps(ctx, `Параграф ${lesson.n}`, L.x0, L.top, 0.014, ACCENT)

  let y = L.top + 0.028
  font(ctx, 0.06, 620)
  ctx.fillStyle = INK
  const titleLines = wrap(ctx, lesson.title, L.x1 - L.x0)
  for (const line of titleLines) {
    ctx.fillText(line, L.x0, y + 0.052)
    y += 0.062
  }
  y += 0.004
  rule(ctx, L.x0, L.x0 + 0.14, y, ACCENT, 0.003)
  y += 0.022

  for (const p of lesson.explanation) {
    y = paragraph(ctx, p, L.x0, y, L.x1 - L.x0, L.body, L.lh) + 0.006
  }

  // формула
  y += 0.002
  const eh = 0.104
  box(ctx, L.x0, y, L.x1 - L.x0, eh, 0.008, 'rgba(255,252,245,0.55)')
  formula(ctx, lesson.equation.symbols, L.x0 + 0.03, y + 0.052, 0.04, 520)
  font(ctx, 0.0154, 400, true)
  ctx.fillStyle = INK2
  const wl = wrap(ctx, lesson.equation.words, L.x1 - L.x0 - 0.06)
  let wy = y + 0.078
  for (const line of wl.slice(0, 2)) {
    ctx.fillText(line, L.x0 + 0.03, wy)
    wy += 0.017
  }
  y += eh + 0.018

  // ключевые слова
  caps(ctx, 'Ключевые слова', L.x0, y, 0.0122, ACCENT)
  y += 0.017
  for (const k of lesson.keywords) {
    font(ctx, 0.0218, 640)
    ctx.fillStyle = INK
    const term = `${k.term} `
    ctx.fillText(term, L.x0, y)
    const tw = ctx.measureText(term).width
    y = paragraph(ctx, k.definition, L.x0 + tw, y, L.x1 - L.x0 - tw, 0.0204, 0.0282) + 0.004
  }
  y += 0.004

  // предсказание
  caps(ctx, 'Подумайте', L.x0, y, 0.0122, ACCENT)
  y += 0.017
  y = paragraph(ctx, lesson.predict.question, L.x0, y, L.x1 - L.x0, 0.023, 0.0308) + 0.006
  lesson.predict.options.forEach((opt, i) => {
    const top = y - 0.0155
    checkbox(ctx, L.x0, y, i, st.predict === i)
    font(ctx, 0.0218, 400)
    ctx.fillStyle = INK
    ctx.fillText(opt, L.x0 + 0.032, y)
    hits.push({ kind: 'predict', u0: L.x0, v0: top, u1: L.x1, v1: y + 0.007, data: i })
    y += 0.0274
  })
  y += 0.002

  // попробуйте
  caps(ctx, 'Попробуйте', L.x0, y, 0.0122, ACCENT)
  y += 0.017
  y = paragraph(ctx, lesson.tryHint, L.x0, y, L.x1 - L.x0, 0.0212, 0.0282)

  // ответ под клапаном
  const fa = FLAP
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(fa.u0 + 0.012, fa.v0 + 0.012, fa.u1 - fa.u0 - 0.024, fa.v1 - fa.v0 - 0.024, 0.008)
  ctx.clip()
  font(ctx, 0.0204, 400, true)
  ctx.fillStyle = INK
  paragraph(ctx, lesson.explain, fa.u0 + 0.03, fa.v0 + 0.055, fa.u1 - fa.u0 - 0.06, 0.0204, 0.0272)
  ctx.restore()

  // поля: живые числа
  drawMargin(ctx, st.margin, 0.058, 0.26, 0.155)

  // испытание
  caps(ctx, 'Испытание', 0.058, 1.196, 0.0122, ACCENT)
  paragraph(ctx, lesson.challenge.text, 0.058, 1.216, 0.15, 0.0182, 0.0234)
  if (st.stamped) {
    font(ctx, 0.018, 560, false, '"Caveat", cursive')
    ctx.fillStyle = ACCENT
    ctx.fillText('штамп получен', 0.058, 1.335)
  }

  if (st.stamped) stamp(ctx, lesson.n)
  folio(ctx, pageNo, 'left')
  return hits
}

function drawMargin(ctx: CanvasRenderingContext2D, lines: MarginLine[], x: number, y: number, maxW: number) {
  let cy = y
  for (const line of lines) {
    const size = line.size ?? 0.0192
    font(ctx, size, 560, false, '"Caveat", cursive')
    ctx.fillStyle = 'rgba(39,52,99,0.9)'
    for (const l of wrap(ctx, line.text, maxW)) {
      if (cy > 1.12) return
      ctx.fillText(l, x, cy)
      cy += size * 1.18
    }
    cy += (line.gap ?? 0.005)
  }
}

function stamp(ctx: CanvasRenderingContext2D, n: number) {
  const cx = 0.085
  const cy = 0.145
  const r = 0.052
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.17)
  ctx.strokeStyle = ACCENT
  ctx.globalAlpha = 0.82
  ctx.lineWidth = 0.006
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 0.0025
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = ACCENT
  font(ctx, r * 0.62, 700)
  ctx.textAlign = 'center'
  ctx.fillText(String(n), 0, -r * 0.02)
  font(ctx, r * 0.19, 700)
  ctx.fillText('ГОТОВО', 0, r * 0.42)
  ctx.restore()
}

export function drawLessonRight(
  ctx: CanvasRenderingContext2D,
  lesson: Lesson,
  st: PageState,
  pageNo: number,
): Hit[] {
  const hits: Hit[] = []
  ctx.save()
  ctx.textAlign = 'right'
  caps(ctx, `§ ${lesson.n} · ${lesson.runningHead}`, R.x1, 0.055, 0.0146, INK2)
  ctx.restore()
  rule(ctx, R.x0, R.x1, 0.064)

  // подпись рисунка
  font(ctx, 0.0204, 500, true)
  ctx.fillStyle = INK
  ctx.fillText(`Рис. ${lesson.n}  ${lesson.figure}`, R.x0, 1.3)
  if (lesson.figureNote) {
    font(ctx, 0.0168, 400, true)
    ctx.fillStyle = INK2
    const lines = wrap(ctx, lesson.figureNote, R.x1 - R.x0)
    let y = 1.322
    for (const l of lines.slice(0, 2)) {
      ctx.fillText(l, R.x0, y)
      y += 0.0195
    }
  }

  // переключатели
  let right = R.x1
  for (const sw of lesson.switches.slice().reverse()) {
    font(ctx, 0.019, 400, true)
    ctx.fillStyle = INK2
    const labelW = ctx.measureText(sw.label).width
    let x = right
    const opts = sw.options.map((o) => {
      font(ctx, 0.019, 640)
      return { t: o, w: ctx.measureText(o).width }
    })
    const total = opts.reduce((s, o) => s + o.w, 0) + 0.024 * (opts.length - 1)
    x = right - total
    const optStart = x
    opts.forEach((o, i) => {
      font(ctx, 0.019, 640)
      ctx.fillStyle = INK
      ctx.fillText(o.t, x, 1.372)
      hits.push({
        kind: 'switch',
        u0: x - 0.008,
        v0: 1.352,
        u1: x + o.w + 0.008,
        v1: 1.384,
        data: { id: sw.id, index: i },
      })
      if ((st.switches[sw.id] ?? 0) === i) {
        ctx.strokeStyle = 'rgba(39,52,99,0.7)'
        ctx.lineWidth = 0.0018
        ctx.beginPath()
        ctx.ellipse(x + o.w / 2, 1.366, o.w / 2 + 0.012, 0.0155, -0.03, 0, Math.PI * 2)
        ctx.stroke()
      }
      x += o.w + 0.024
    })
    font(ctx, 0.0198, 500, true)
    ctx.fillStyle = INK
    ctx.fillText(sw.label, optStart - labelW - 0.01, 1.372)
    right = optStart - labelW - 0.035
  }

  // график
  if (st.graph) {
    graph(ctx, st.graph, 0.05, 0.76, 0.36, 0.4)
  }

  folio(ctx, pageNo, 'right')
  return hits
}

/* ------------------------------ обложка ------------------------------ */

export function drawTitleLeft(ctx: CanvasRenderingContext2D) {
  caps(ctx, 'Электронное приложение к учебнику', 0.09, 0.12, 0.0146, INK2)
  rule(ctx, 0.09, 0.42, 0.13)

  font(ctx, 0.115, 620)
  ctx.fillStyle = INK
  ctx.fillText('Механика', 0.085, 0.34)
  font(ctx, 0.05, 400, true)
  ctx.fillStyle = ACCENT
  ctx.fillText('Инженеры будущего', 0.09, 0.405)
  caps(ctx, '9 класс', 0.09, 0.45, 0.02, INK2)

  // рисунок: пружина с грузом
  const gx = 0.55
  const gy = 0.72
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.0035
  ctx.lineCap = 'round'
  // кронштейн
  ctx.beginPath()
  ctx.moveTo(gx - 0.2, gy - 0.2)
  ctx.lineTo(gx + 0.16, gy - 0.2)
  ctx.stroke()
  ctx.lineWidth = 0.002
  ctx.beginPath()
  ctx.moveTo(gx - 0.18, gy - 0.2)
  ctx.lineTo(gx - 0.18, gy - 0.17)
  ctx.stroke()
  // пружина
  ctx.beginPath()
  const coils = 7
  for (let i = 0; i <= coils * 2; i++) {
    const t = i / (coils * 2)
    const x = gx + (i % 2 === 0 ? -0.045 : 0.045)
    const y = gy - 0.19 + t * 0.17
    if (i === 0) ctx.moveTo(gx, gy - 0.19)
    else ctx.lineTo(x, y)
  }
  ctx.lineTo(gx, gy - 0.015)
  ctx.stroke()
  // груз
  ctx.lineWidth = 0.0032
  ctx.beginPath()
  ctx.roundRect(gx - 0.075, gy - 0.005, 0.15, 0.075, 0.012)
  ctx.stroke()
  // штриховка груза
  ctx.lineWidth = 0.0011
  ctx.strokeStyle = 'rgba(39,52,99,0.45)'
  for (let i = -6; i < 8; i++) {
    ctx.beginPath()
    ctx.moveTo(gx - 0.075 + i * 0.018, gy + 0.07)
    ctx.lineTo(gx - 0.075 + i * 0.018 + 0.055, gy + 0.005)
    ctx.stroke()
  }
  // стрелка силы
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 0.003
  const ax = gx + 0.16
  ctx.beginPath()
  ctx.moveTo(ax, gy + 0.03)
  ctx.lineTo(ax, gy + 0.15)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(ax - 0.016, gy + 0.132)
  ctx.lineTo(ax, gy + 0.154)
  ctx.lineTo(ax + 0.016, gy + 0.132)
  ctx.stroke()
  font(ctx, 0.032, 560, false, '"Caveat", cursive')
  ctx.fillStyle = ACCENT
  ctx.fillText('F', ax + 0.024, gy + 0.15)
  ctx.restore()

  caps(ctx, 'Как читать', 0.09, 1.02, 0.014, ACCENT)
  const how = [
    'Отметьте ответ на вопрос «Подумайте».',
    'Посмотрите, как рисунок поднимается со страницы.',
    'Попробуйте сами: двигайте грузы, лифт и брусок.',
    'Поднимите клапан, чтобы узнать почему.',
    'Пройдите испытание и получите штамп.',
  ]
  let y = 1.045
  for (const h of how) {
    y = paragraph(ctx, h, 0.09, y, 0.36, 0.0204, 0.0272) + 0.006
  }
  font(ctx, 0.017, 400, true)
  ctx.fillStyle = INK2
  ctx.fillText('Механика · Инженеры будущего · 9 класс', 0.09, 1.395)
}

export function drawTitleRight(
  ctx: CanvasRenderingContext2D,
  chapters: { n: number; title: string; paragraphs: { n: number; title: string; ready: boolean }[] }[],
  goto: (spread: number) => number,
): Hit[] {
  const hits: Hit[] = []
  caps(ctx, 'Содержание', R.x0, 0.09, 0.02, ACCENT)
  rule(ctx, R.x0, R.x1, 0.104)

  const colX = [R.x0, 0.575]
  const colW = [0.46, 0.46]
  let col = 0
  let y = 0.135
  const bottom = 1.36

  for (const ch of chapters) {
    const need = 0.03 + ch.paragraphs.length * 0.0186 + 0.012
    if (y + need > bottom && col === 0) {
      col = 1
      y = 0.135
    }
    const x = colX[col]
    font(ctx, 0.0182, 650)
    ctx.fillStyle = ACCENT
    ctx.fillText(`${ch.n}. ${ch.title}`, x, y)
    y += 0.023
    for (const p of ch.paragraphs) {
      const line = `${p.n}. ${p.title}`
      font(ctx, 0.017, p.ready ? 600 : 400)
      ctx.fillStyle = p.ready ? INK : 'rgba(39,52,99,0.42)'
      const clipped = wrap(ctx, line, colW[col])[0] ?? line
      ctx.fillText(p.ready ? clipped : clipped.replace(/\.$/, ''), x + 0.012, y)
      if (p.ready) {
        const sp = goto(p.n)
        if (sp > 0) {
          ctx.fillStyle = ACCENT
          ctx.beginPath()
          ctx.arc(x + 0.004, y - 0.005, 0.0038, 0, 7)
          ctx.fill()
          hits.push({ kind: 'goto', u0: x, v0: y - 0.014, u1: x + colW[col], v1: y + 0.005, data: sp })
        }
      }
      y += 0.0196
    }
    y += 0.012
  }

  font(ctx, 0.0152, 400, true)
  ctx.fillStyle = 'rgba(39,52,99,0.55)'
  const note = 'Тёмные пункты уже открыты. Остальные параграфы появятся в следующих изданиях.'
  let ny = 1.375
  for (const l of wrap(ctx, note, 0.44).slice(0, 2)) {
    ctx.fillText(l, 0.575, ny)
    ny += 0.018
  }
  return hits
}

/* ------------------------------ итог ------------------------------ */

export function drawSummaryLeft(ctx: CanvasRenderingContext2D, pageNo: number) {
  caps(ctx, 'Итог · параграфы 23–25', L.x0, 0.055, 0.0146, INK2)
  rule(ctx, L.x0, L.x1, 0.064)
  caps(ctx, 'Итог', L.x0, 0.12, 0.014, ACCENT)
  font(ctx, 0.07, 620)
  ctx.fillStyle = INK
  ctx.fillText('Сравним силы', L.x0, 0.185)

  const x = L.x0
  const w = L.x1 - x
  const rows: [string, string, string, string][] = [
    ['Сила упругости', 'F = k·|Δl|', 'Против деформации', 'К телу'],
    ['Вес тела', 'P = mg', 'Вниз, к опоре', 'К опоре или подвесу'],
    ['Сила трения', 'F = μN', 'Против движения', 'К телу'],
  ]
  const cols = [0.18, 0.18, 0.21, 0.22]
  const top = 0.24
  ctx.save()
  ctx.strokeStyle = HAIR
  ctx.lineWidth = 0.0016
  const line = (yy: number) => {
    ctx.beginPath()
    ctx.moveTo(x, yy)
    ctx.lineTo(x + w, yy)
    ctx.stroke()
  }
  line(top)
  let y = top + 0.034
  let cx = x
  const heads = ['Сила', 'Формула', 'Куда направлена', 'К чему приложена']
  heads.forEach((h, i) => {
    caps(ctx, h, cx + 0.008, y, 0.0112, INK2)
    cx += cols[i]
  })
  y += 0.014
  for (const row of rows) {
    line(y)
    y += 0.034
    cx = x
    row.forEach((cell, i) => {
      if (i === 1) {
        formula(ctx, cell, cx + 0.008, y, 0.03, 520)
      } else {
        const lines = wrap(ctx, cell, cols[i] - 0.02)
        font(ctx, 0.0198, i === 0 ? 600 : 400)
        ctx.fillStyle = INK
        ctx.fillText(lines[0], cx + 0.008, y)
        if (lines[1]) {
          font(ctx, 0.0176, 400)
          ctx.fillStyle = INK2
          ctx.fillText(lines[1], cx + 0.008, y + 0.021)
        }
      }
      cx += cols[i]
    })
    y += 0.042
  }
  line(y)
  ctx.restore()

  const notes = [
    'Все три силы измеряют в ньютонах. Формулы работают вблизи поверхности Земли, где g ≈ 9,8 Н/кг.',
    'Вес и сила тяжести — разные силы: они приложены к разным телам.',
    'Закон Гука выполняется только до предела пропорциональности.',
  ]
  let ny = y + 0.06
  caps(ctx, 'Запомните', x, ny, 0.0132, ACCENT)
  ny += 0.03
  for (const n of notes) {
    ny = paragraph(ctx, n, x, ny, w, 0.0242, 0.034) + 0.014
  }
  folio(ctx, pageNo, 'left')
}

export const QUIZ: {
  q: string
  options: string[]
  answer: number
  explain: string
}[] = [
  {
    q: 'Какая сила возникает при деформации тела?',
    options: ['Сила упругости', 'Сила тяжести', 'Сила трения'],
    answer: 0,
    explain: 'Деформированное тело стремится вернуть форму — возникает сила упругости.',
  },
  {
    q: 'Чему равен вес тела массой 2 кг в покое?',
    options: ['19,6 Н', '2 Н', '0 Н'],
    answer: 0,
    explain: 'P = mg = 2 кг × 9,8 Н/кг = 19,6 Н.',
  },
  {
    q: 'По какой формуле считают силу трения скольжения?',
    options: ['F = μN', 'F = mg', 'F = kΔl'],
    answer: 0,
    explain: 'Сила трения скольжения пропорциональна силе реакции опоры.',
  },
  {
    q: 'В свободно падающем лифте вес тела…',
    options: ['равен нулю', 'равен mg', 'больше mg'],
    answer: 0,
    explain: 'Опора падает вместе с телом, поэтому давить на неё не нужно — невесомость.',
  },
]

export function drawSummaryRight(
  ctx: CanvasRenderingContext2D,
  st: PageState,
  pageNo: number,
): Hit[] {
  const hits: Hit[] = []
  caps(ctx, 'Проверьте себя', R.x0, 0.09, 0.016, ACCENT)
  rule(ctx, R.x0, R.x1, 0.106)

  let y = 0.155
  QUIZ.forEach((item, qi) => {
    const open = !!st.quiz.open[qi]
    const pick = st.quiz.picks[qi]
    const qLines = wrap(ctx, `${qi + 1}. ${item.q}`, R.x1 - R.x0)
    paragraph(ctx, `${qi + 1}. ${item.q}`, R.x0, y, R.x1 - R.x0, 0.027, 0.034)
    let qy = y + qLines.length * 0.034 + 0.012
    item.options.forEach((opt, oi) => {
      const right = open && oi === item.answer
      checkbox(ctx, R.x0 + 0.004, qy, oi, pick === oi || right)
      font(ctx, 0.0238, right ? 650 : 400)
      ctx.fillStyle = right ? ACCENT : INK
      ctx.fillText(opt, R.x0 + 0.04, qy)
      hits.push({ kind: 'quiz-pick', u0: R.x0, v0: qy - 0.019, u1: R.x1, v1: qy + 0.009, data: { q: qi, o: oi } })
      qy += 0.033
    })
    if (open) {
      font(ctx, 0.0206, 400, true)
      ctx.fillStyle = INK2
      qy = paragraph(ctx, item.explain, R.x0 + 0.012, qy + 0.008, R.x1 - R.x0 - 0.024, 0.0206, 0.028)
    } else {
      font(ctx, 0.021, 500, false, '"Caveat", cursive')
      ctx.fillStyle = ACCENT
      ctx.fillText('показать ответ ▸', R.x0 + 0.012, qy + 0.008)
      qy += 0.02
    }
    hits.push({ kind: 'quiz-open', u0: R.x0, v0: qy - 0.022, u1: R.x0 + 0.26, v1: qy + 0.014, data: qi })
    y = qy + 0.05
    if (qi < QUIZ.length - 1) rule(ctx, R.x0, R.x1, y - 0.026, 'rgba(39,52,99,0.14)')
  })

  const done = Object.keys(st.quiz.open).length
  const right = QUIZ.reduce((acc, q, i) => acc + (st.quiz.open[i] && st.quiz.picks[i] === q.answer ? 1 : 0), 0)
  font(ctx, 0.022, 600, false, '"Caveat", cursive')
  ctx.fillStyle = INK2
  ctx.fillText(`Проверено ${done} из ${QUIZ.length}. Верно: ${right}.`, R.x0, 1.36)

  folio(ctx, pageNo, 'right')
  return hits
}

export function drawFlapFace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const CW = 0.785
  const CH = (FLAP.v1 - FLAP.v0) * PAGE_H
  ctx.save()
  ctx.scale(w / CW, h / CH)
  ctx.fillStyle = '#efe5d1'
  ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = 'rgba(39,52,99,0.35)'
  ctx.lineWidth = 0.0028
  ctx.strokeRect(0.012, 0.012, CW - 0.024, CH - 0.024)

  caps(ctx, 'Почему?', 0.04, 0.038, 0.018, ACCENT)
  font(ctx, 0.036, 500)
  ctx.fillStyle = INK
  ctx.fillText('Поднимите, чтобы увидеть ответ', 0.04, 0.083)
  font(ctx, 0.019, 400, true)
  ctx.fillStyle = INK2
  ctx.fillText('…после того как дадите ответ.', 0.04, 0.118)

  font(ctx, 0.024, 560, false, '"Caveat", cursive')
  ctx.fillStyle = ACCENT
  ctx.fillText('поднимите здесь', CW - 0.29, CH - 0.045)
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 0.0022
  ctx.beginPath()
  ctx.moveTo(CW - 0.13, CH - 0.036)
  ctx.quadraticCurveTo(CW - 0.095, CH - 0.055, CW - 0.075, CH - 0.078)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(CW - 0.098, CH - 0.068)
  ctx.lineTo(CW - 0.075, CH - 0.078)
  ctx.lineTo(CW - 0.09, CH - 0.094)
  ctx.stroke()
  ctx.restore()
}

export function drawFlapBack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const CW = 0.785
  const CH = (FLAP.v1 - FLAP.v0) * PAGE_H
  ctx.save()
  ctx.scale(w / CW, h / CH)
  ctx.fillStyle = '#ece1cb'
  ctx.fillRect(0, 0, CW, CH)
  ctx.strokeStyle = 'rgba(39,52,99,0.2)'
  ctx.lineWidth = 0.002
  ctx.strokeRect(0.012, 0.012, CW - 0.024, CH - 0.024)
  ctx.strokeStyle = 'rgba(39,52,99,0.12)'
  ctx.lineWidth = 0.0016
  for (let y = 0.03; y < CH - 0.02; y += 0.03) {
    ctx.beginPath()
    ctx.moveTo(0.03, y)
    ctx.lineTo(CW - 0.03, y)
    ctx.stroke()
  }
  ctx.restore()
}
