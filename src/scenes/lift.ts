import * as THREE from 'three'
import type { MarginLine } from '../types'
import type { A11yAction, Scene } from './types'
import { inkMesh, makeArrow, spriteLabel, groundShadow, setSpriteText } from '../ink/solid'
import { ACCENT, INK } from '../ink/canvas'
import { num } from '../core/fmt'
import { weightForce } from '../physics'

const G = 9.8
const M = 1
const A = 4.9

const MODES = [
  { id: 0, a: 0, label: 'покой' },
  { id: 1, a: A, label: 'вверх' },
  { id: 2, a: -A, label: 'вниз' },
  { id: 3, a: -G, label: 'падение' },
]

export class LiftScene implements Scene {
  group = new THREE.Group()
  scale = 0.78
  private shadow: THREE.Mesh
  private cabin = new THREE.Group()
  private crate: THREE.Object3D
  private mgArrow = makeArrow('#9a3b2a', 0.013)
  private nArrow = makeArrow('#273463', 0.013)
  private mode = 0
  private lastMode = -1
  private enterT = 0
  private t = 0

  constructor() {
    this.shadow = groundShadow(0.56, 0.42, 0.3)
    this.shadow.position.set(0, 0.001, 0.1)
    this.group.add(this.shadow)

    // шахта лифта
    const railL = inkMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.66, 8))
    railL.group.position.set(-0.27, 0.33, 0.1)
    const railR = railL.group.clone()
    railR.position.x = 0.27
    this.group.add(railL.group, railR)

    this.group.add(this.cabin)

    // каркас кабины
    const frame = new THREE.BoxGeometry(0.46, 0.5, 0.32)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(frame),
      new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }),
    )
    edges.position.set(0, 0.31, 0)
    this.cabin.add(edges)

    // пол
    const floor = inkMesh(new THREE.BoxGeometry(0.46, 0.03, 0.32), { color: '#f3ecda' })
    floor.group.position.set(0, 0.075, 0)
    this.cabin.add(floor.group)

    // весы
    const scale = inkMesh(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 28), { color: '#fbf6e8' })
    scale.group.position.set(0, 0.105, 0)
    this.cabin.add(scale.group)

    // груз
    const box = inkMesh(new THREE.BoxGeometry(0.16, 0.13, 0.14), { color: '#f8f1de' })
    box.group.position.set(0, 0.185, 0)
    this.crate = box.group
    this.cabin.add(box.group)

    // стрелки
    this.group.add(this.mgArrow.group, this.nArrow.group)


    this.layout(0)
  }

  enter() {
    this.enterT = 0
  }

  setSwitch(id: string, index: number) {
    if (id === 'lift') {
      this.mode = index
      this.refresh()
    }
  }

  private weight(): number {
    const m = MODES[this.mode]
    return weightForce(M, G, m.a)
  }

  private refresh() {
    if (this.mode === this.lastMode) return
    this.lastMode = this.mode
    const P = this.weight()
    const ratio = P / (M * G)

    // стрелки рядом с грузом
    const mgFrom = new THREE.Vector3(0.2, 0.23, 0.06)
    const mgTo = new THREE.Vector3(0.2, 0.06, 0.06)
    this.mgArrow.set(mgFrom, mgTo)

    const nLen = 0.16 * ratio
    const nFrom = new THREE.Vector3(-0.15, 0.05, 0.06)
    this.nArrow.set(nFrom, new THREE.Vector3(-0.15, 0.05 + nLen, 0.06))
    this.nArrow.group.visible = P > 0.01

  }

  private layout(dt: number) {
    const m = MODES[this.mode]
    if (m.id === 3) {
      this.cabin.position.y += (0.14 - this.cabin.position.y) * Math.min(1, dt * 3)
    } else {
      this.cabin.position.y += (0 - this.cabin.position.y) * Math.min(1, dt * 4)
    }
    const P = this.weight()
    this.mgArrow.group.visible = true
    this.nArrow.group.visible = P > 0.01
  }

  update(dt: number, time: number, live: boolean) {
    this.t = time
    this.enterT = Math.min(1, this.enterT + dt / 0.7)
    const e = 1 - Math.pow(1 - this.enterT, 3)
    this.group.position.y = (live ? 0 : -0.03) + (1 - e) * -0.05
    this.group.visible = live || this.enterT < 0.98
    const sh = this.shadow.material as THREE.MeshBasicMaterial
    sh.opacity = 0.9 * e
    this.layout(dt)
    // лёгкое покачивание кабины
    if (this.mode === 1) this.cabin.position.y = Math.max(this.cabin.position.y, 0.012 + Math.sin(time * 3) * 0.006)
    if (this.mode === 2) this.cabin.position.y = Math.min(this.cabin.position.y, -0.012 + Math.sin(time * 3) * 0.006)
  }

  margin(): MarginLine[] {
    const m = MODES[this.mode]
    const P = this.weight()
    const lines: MarginLine[] = [
      { text: `m = ${num(M, 1)} кг` },
      { text: `g = ${num(G, 1)} Н/кг` },
      { text: `a = ${num(Math.abs(m.a), 1)} м/с²` },
    ]
    if (m.a === 0) lines.push({ text: `P = m g = ${num(P, 1)} Н`, gap: 0.008 })
    else if (m.id === 3) lines.push({ text: 'P = 0', gap: 0.008 }, { text: 'невесомость' })
    else {
      const sign = m.a > 0 ? '+' : '−'
      lines.push({ text: `P = m(g ${sign} a) = ${num(P, 1)} Н`, gap: 0.008 })
      if (P > M * G) lines.push({ text: 'перегрузка' })
      if (P < M * G) lines.push({ text: 'вес меньше mg' })
    }
    return lines
  }

  graph() {
    return null
  }

  challenge() {
    return { met: this.mode === 1 }
  }

  a11y(): A11yAction[] {
    return MODES.map((m) => ({
      label: `Лифт: ${m.label}`,
      run: () => {
        this.mode = m.id
        this.refresh()
      },
    }))
  }

  pickables(): THREE.Object3D[] {
    return []
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
  }
}
