import type { Lesson, MarginLine, Spread } from '../types'
import type { A11yAction } from '../scenes/types'
import { QUIZ } from '../layout/pages'

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (t) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[t] as string)

export interface PanelData {
  k: number
  spread: Spread
  state: {
    predict: number | null
    flapOpen: boolean
    switches: Record<string, number>
    quiz: { picks: Record<number, number>; open: Record<number, boolean> }
  }
  margin: MarginLine[]
  actions: A11yAction[]
}

function formulaLine(text: string) {
  return `<div class="eq">${esc(text).replace(/_\{([^}]*)\}/g, '<sub>$1</sub>')}</div>`
}

function lessonHTML(l: Lesson, d: PanelData): string {
  const st = d.state
  let h = `<h2>§ ${l.n}. ${esc(l.title)}</h2>`
  h += l.explanation.map((p) => `<p>${esc(p)}</p>`).join('')
  h += formulaLine(l.equation.symbols)
  h += `<p><em>${esc(l.equation.words)}</em></p>`

  h += '<h3>Ключевые слова</h3><dl>'
  for (const k of l.keywords) h += `<dt>${esc(k.term)}</dt><dd>${esc(k.definition)}</dd>`
  h += '</dl>'

  h += `<h3>Подумайте</h3><p>${esc(l.predict.question)}</p><div class="opts">`
  l.predict.options.forEach((o, i) => {
    h += `<div>${st.predict === i ? '☑' : '☐'} ${esc(o)}</div>`
  })
  h += '</div>'

  h += `<h3>Попробуйте</h3><p>${esc(l.tryHint)}</p>`
  h += `<h3>Почему?</h3><p>${esc(st.flapOpen ? l.explain : 'Поднимите клапан, чтобы увидеть ответ.')}</p>`
  h += `<h3>Испытание</h3><p>${esc(l.challenge.text)}</p>`

  if (l.switches.length) {
    h += '<h3>Переключатели</h3>'
    for (const sw of l.switches) {
      const cur = st.switches[sw.id] ?? 0
      h += `<div class="sw"><span>${esc(sw.label)}</span>${sw.options
        .map((o, i) => `<b>${i === cur ? `[${esc(o)}]` : esc(o)}</b>`)
        .join(' · ')}</div>`
    }
  }

  if (d.margin.length) {
    h += '<h3>Ваши числа</h3>'
    h += `<div class="hand">${d.margin.map((m) => esc(m.text)).join('<br>')}</div>`
  }

  if (d.actions.length) {
    h += '<h3>Действия</h3>'
    h += d.actions.map((a, i) => `<button type="button" data-action="${i}">${esc(a.label)}</button>`).join('')
  }
  return h
}

function titleHTML(): string {
  return `<h2>Механика. Инженеры будущего</h2>
  <p>Электронное приложение к учебнику для 9 класса. Каждый параграф — разворот: слева текст и формула, справа рисунок, который поднимается со страницы.</p>
  <h3>Как читать</h3>
  <ol>
    <li>Отметьте ответ на вопрос «Подумайте».</li>
    <li>Посмотрите, как рисунок поднимается со страницы.</li>
    <li>Попробуйте сами: двигайте грузы, лифт и брусок.</li>
    <li>Поднимите клапан, чтобы узнать почему.</li>
    <li>Пройдите испытание и получите штамп.</li>
  </ol>
  <h3>Открытые параграфы</h3>
  <p><a href="#" data-goto="2">§ 23. Сила упругости. Закон Гука</a><br>
  <a href="#" data-goto="3">§ 24. Вес тела</a><br>
  <a href="#" data-goto="4">§ 25. Сила трения</a></p>`
}

function summaryHTML(d: PanelData): string {
  let h = `<h2>Итог. Три силы</h2>
  <p><b>Сила упругости</b> F = k·|Δl| — направлена против деформации, приложена к телу.<br>
  <b>Вес тела</b> P = mg — направлен вниз, приложен к опоре или подвесу.<br>
  <b>Сила трения</b> F = μN — направлена против движения, приложена к телу.</p>
  <p>Все три силы измеряют в ньютонах. Вблизи поверхности Земли g ≈ 9,8 Н/кг.</p>
  <h3>Проверьте себя</h3>`
  QUIZ.forEach((q, i) => {
    const open = !!d.state.quiz.open[i]
    const pick = d.state.quiz.picks[i]
    h += `<p><b>${i + 1}. ${esc(q.q)}</b></p><div class="opts">`
    q.options.forEach((o, oi) => {
      const right = open && oi === q.answer
      h += `<div>${pick === oi ? '☑' : '☐'} <span style="${right ? 'color:#9a3b2a;font-weight:650' : ''}">${esc(o)}</span></div>`
    })
    h += '</div>'
    h += open ? `<p><em>${esc(q.explain)}</em></p>` : '<p><em>Ответ скрыт.</em></p>'
  })
  if (d.actions.length) {
    h += '<h3>Действия</h3>'
    h += d.actions.map((a, i) => `<button type="button" data-action="${i}">${esc(a.label)}</button>`).join('')
  }
  return h
}

export function spreadHTML(d: PanelData): string {
  if (d.spread.kind === 'title') return titleHTML()
  if (d.spread.kind === 'lesson') return lessonHTML(d.spread.lesson, d)
  return summaryHTML(d)
}

export function plainText(d: PanelData): string {
  const h = spreadHTML(d)
  const div = document.createElement('div')
  div.innerHTML = h
  return div.textContent ?? ''
}
