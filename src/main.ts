import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/caveat/400.css'
import '@fontsource/caveat/600.css'
import './styles.css'

import { Book } from './core/book'
import { sound } from './core/sound'
import { spreadHTML, type PanelData } from './text/panel'
import type { Spread } from './types'

const canvas = document.getElementById('c') as HTMLCanvasElement
const boot = document.getElementById('boot')!
const nav = document.getElementById('nav')!
const numEl = document.getElementById('n-num')!
const titleEl = document.getElementById('n-title')!
const prevEl = document.getElementById('n-prev') as HTMLButtonElement
const nextEl = document.getElementById('n-next') as HTMLButtonElement
const soundEl = document.getElementById('n-sound') as HTMLButtonElement
const textEl = document.getElementById('n-text') as HTMLButtonElement
const panel = document.getElementById('panel')!
const panelTitle = document.getElementById('panel-title')!
const panelBody = document.getElementById('panel-body')!
const sr = document.getElementById('sr')!
const live = document.getElementById('a11y-live')!

let book: Book
let ready = false

function currentData(): PanelData {
  const k = book.k
  return {
    k,
    spread: book.spreadInfo(k),
    state: book.state(k),
    margin: book.pageState(k).margin,
    actions: book.actions(),
  }
}

function renderPanel() {
  const d = currentData()
  panelBody.innerHTML = spreadHTML(d)
  panelTitle.textContent = d.spread.kind === 'lesson' ? `§ ${d.spread.lesson.n} · ${d.spread.title}` : d.spread.title
}

function update(k: number, spread: Spread) {
  const label = spread.kind === 'lesson' ? `§ ${spread.lesson.n}` : spread.kind === 'summary' ? 'Итог' : ''
  numEl.textContent = label
  titleEl.textContent = spread.title
  prevEl.disabled = k <= 1
  nextEl.disabled = k >= book.spreads.length

  const d = currentData()
  sr.innerHTML = spreadHTML(d)
  live.textContent =
    spread.kind === 'lesson'
      ? `Открыт параграф ${spread.lesson.n}: ${spread.title}`
      : spread.kind === 'summary'
        ? 'Открыт итоговый разворот'
        : 'Открыто содержание'

  if (!panel.hidden) renderPanel()
  canvas.setAttribute(
    'aria-label',
    spread.kind === 'lesson'
      ? `Интерактивная книга, параграф ${spread.lesson.n}: ${spread.title}`
      : `Интерактивная книга: ${spread.title}`,
  )
}

async function start() {
  try {
    await Promise.all([
      document.fonts.load('400 40px "Source Serif 4"', 'Энергия Ёё'),
      document.fonts.load('600 40px "Source Serif 4"', 'Энергия Ёё'),
      document.fonts.load('italic 400 40px "Source Serif 4"', 'Энергия Ёё'),
      document.fonts.load('560 40px "Caveat"', 'Энергия Ёё'),
    ])
  } catch {
    /* шрифты не критичны */
  }

  book = new Book({
    canvas,
    onSpread: (k, s) => {
      if (ready) update(k, s)
    },
  })
  ready = true
  update(book.k, book.spreadInfo())

  document.getElementById('n-contents')!.addEventListener('click', () => book.goTo(1))
  prevEl.addEventListener('click', () => book.prev())
  nextEl.addEventListener('click', () => book.next())

  soundEl.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled)
    soundEl.setAttribute('aria-pressed', String(sound.enabled))
    if (sound.enabled) sound.play('click')
  })

  textEl.addEventListener('click', () => {
    if (panel.hidden) {
      renderPanel()
      panel.hidden = false
      textEl.setAttribute('aria-pressed', 'true')
      ;(panel.querySelector('#panel-close') as HTMLButtonElement)?.focus()
    } else {
      panel.hidden = true
      textEl.setAttribute('aria-pressed', 'false')
    }
  })

  document.getElementById('panel-close')!.addEventListener('click', () => {
    panel.hidden = true
    textEl.setAttribute('aria-pressed', 'false')
  })

  panelBody.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    const action = t.closest('[data-action]') as HTMLElement | null
    if (action) {
      book.runAction(Number(action.dataset.action))
      renderPanel()
      return
    }
    const link = t.closest('[data-goto]') as HTMLElement | null
    if (link) {
      e.preventDefault()
      book.goTo(Number(link.dataset.goto))
      renderPanel()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true
      textEl.setAttribute('aria-pressed', 'false')
    }
  })

  // прячем загрузчик сразу после первого кадра
  boot.classList.add('done')
  setTimeout(() => boot.remove(), 900)
}

start().catch((e) => {
  console.error(e)
  const msg = boot.querySelector('.s')
  if (msg) msg.textContent = 'Ошибка: ' + (e instanceof Error ? e.message : String(e))
})
