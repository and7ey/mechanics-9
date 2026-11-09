import * as THREE from 'three'
import type { GraphSpec, MarginLine } from '../types'
import type { A11yAction, Scene } from './types'
import { inkMesh, makeArrow, spriteLabel, groundShadow, helixPoints, setSpriteText, PAPER_SURFACE } from '../ink/solid'
import { INK, ACCENT } from '../ink/canvas'
import { clamp, num } from '../core/fmt'
import { springDelta, stiffness, springChallengeMet } from '../physics'

const K = 60 // Н/м
const LIMIT = 4.5 // Н
const VIS = 2.0 // визуальный масштаб удлинения
const TOP = 0.74
const NATURAL = 0.24
const WEIGHTS = [1, 2, 3, 5]

export class SpringScene implements Scene {
  group = new THREE.Group()
  scale = 0.8
  private shadow: THREE.Mesh
  private springMesh: THREE.Mesh | null = null
  private springGroup = new THREE.Group()
  private hook: THREE.Object3D
  private hanging = new THREE.Group()
  private onHook = new Set<number>()
  private rack: THREE.Object3D[] = []
  private picks: THREE.Mesh[] = []
  private labels: THREE.Sprite[] = []
  private dL = 0
  private plastic = false
  private plasticOffset = 0
  private points: { x: number; y: number }[] = []
  private lift = 0
  private enterT = 0
  private time = 0
  private loadLabel: THREE.Sprite

  constructor() {
    this.shadow = groundShadow(0.62, 0.5, 0.32)
    this.shadow.position.set(0, 0.001, 0.14)
    this.group.add(this.shadow)

    // основание
    const base = inkMesh(new THREE.BoxGeometry(0.4, 0.024, 0.26))
    base.group.position.set(0, 0.012, 0.16)
    base.group.userData.pick = 'base'
    this.group.add(base.group)

    // стойка
    const rod = inkMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.76, 10))
    rod.group.position.set(-0.185, 0.4, 0.15)
    this.group.add(rod.group)
    const arm = inkMesh(new THREE.BoxGeometry(0.22, 0.02, 0.024))
    arm.group.position.set(-0.08, 0.772, 0.15)
    this.group.add(arm.group)
    // кронштейн
    const brace = inkMesh(new THREE.BoxGeometry(0.02, 0.16, 0.02))
    brace.group.position.set(-0.09, 0.7, 0.165)
    this.group.add(brace.group)
    const hookMount = inkMesh(new THREE.TorusGeometry(0.018, 0.005, 8, 20))
    hookMount.group.position.set(0.015, 0.75, 0.15)
    hookMount.group.rotation.x = Math.PI / 2
    this.group.add(hookMount.group)

    this.group.add(this.springGroup)

    // крюк и грузы
    this.hook = new THREE.Group()
    const hook = inkMesh(new THREE.TorusGeometry(0.014, 0.005, 8, 20))
    hook.group.rotation.y = Math.PI / 2
    this.hook.add(hook.group)
    this.hook.position.set(0.015, TOP - NATURAL, 0.15)
    this.group.add(this.hook)
    this.hanging.position.copy(this.hook.position)
    this.group.add(this.hanging)

    // полка с грузами
    const rackZ = 0.34
    WEIGHTS.forEach((w, i) => {
      const x = 0.18 + i * 0.085
      const disc = inkMesh(new THREE.CylinderGeometry(0.052, 0.052, 0.028, 24), {
        color: '#f9f3e4',
      })
      disc.group.position.set(x, 0.018, rackZ)
      disc.group.userData.pick = i
      this.rack.push(disc.group)
      this.group.add(disc.group)

      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.08, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      )
      proxy.position.set(x, 0.045, rackZ)
      proxy.userData.pick = i
      this.picks.push(proxy)
      this.group.add(proxy)
      const label = spriteLabel(`${w} Н`, { size: 0.055, family: '"Caveat", cursive', weight: 560, color: INK })
      label.position.set(x, 0.075, rackZ)
      this.labels.push(label)
      this.group.add(label)
    })

    this.loadLabel = spriteLabel('', { size: 0.06, family: '"Caveat", cursive', weight: 560, color: ACCENT })
    this.loadLabel.position.set(0.1, 0.63, 0.15)
    this.group.add(this.loadLabel)

    this.rebuild()
    this.syncWeights()
  }

  enter() {
    this.enterT = 0
    this.lift = 0
  }

  private totalF(): number {
    let f = 0
    for (const i of this.onHook) f += WEIGHTS[i]
    return f
  }

  private computeDL(): number {
    return clamp(springDelta(this.totalF(), K), 0, 0.12)
  }

  private rebuild() {
    const f = this.totalF()
    this.dL = this.computeDL()
    if (f > LIMIT && !this.plastic) {
      this.plastic = true
      this.plasticOffset = clamp((f - LIMIT) / K, 0, 0.04)
    }
    const rest = NATURAL + this.plasticOffset * VIS
    const len = rest + this.dL * VIS
    const from = new THREE.Vector3(0.015, TOP, 0.15)
    const to = new THREE.Vector3(0.015, TOP - len, 0.15)
    const pts = helixPoints(from, to, 0.05, 9, 240)
    const curve = new THREE.CatmullRomCurve3(pts)
    const geo = new THREE.TubeGeometry(curve, 260, 0.0055, 6, false)
    if (this.springMesh) {
      this.springGroup.remove(this.springMesh)
      this.springMesh.geometry.dispose()
      ;(this.springMesh.material as THREE.Material).dispose()
    }
    const mat = new THREE.MeshStandardMaterial({ color: '#3a4463', roughness: 0.7, metalness: 0.1 })
    this.springMesh = new THREE.Mesh(geo, mat)
    this.springMesh.castShadow = true
    this.springGroup.add(this.springMesh)
    this.hook.position.y = TOP - len
    this.hanging.position.copy(this.hook.position)

    setSpriteText(this.loadLabel, f > 0 ? `${num(f, 0)} Н` : '', {
      size: 0.05,
      family: '"Caveat", cursive',
      weight: 560,
      color: ACCENT,
    })

    const cm = this.dL * 100
    const key = Math.round(cm * 10) / 10
    if (f > 0 && !this.points.some((p) => p.x === key)) {
      this.points.push({ x: key, y: f })
      this.points.sort((a, b) => a.x - b.x)
    }
  }

  private syncWeights() {
    this.hanging.clear()
    let i = 0
    for (const idx of [...this.onHook].sort((a, b) => b - a)) {
      const w = WEIGHTS[idx]
      const disc = inkMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 24), { color: '#f9f3e4' })
      disc.group.position.set(0, -0.03 - i * 0.034, 0)
      this.hanging.add(disc.group)
      i++
    }
    // обновить вид полки
    this.rack.forEach((g, idx) => {
      g.visible = !this.onHook.has(idx)
    })
    this.labels.forEach((l, idx) => {
      l.visible = !this.onHook.has(idx)
    })
    this.rebuild()
  }

  onPick(obj: THREE.Object3D) {
    if (obj.userData.pick === 'base') {
      if (this.plastic) {
        this.plastic = false
        this.plasticOffset = 0
        this.onHook.clear()
        this.syncWeights()
      }
      return
    }
    const idx = obj.userData.pick
    if (typeof idx !== 'number') return
    if (this.onHook.has(idx)) this.onHook.delete(idx)
    else this.onHook.add(idx)
    this.syncWeights()
  }

  update(dt: number, time: number, live: boolean) {
    this.time = time
    this.enterT = Math.min(1, this.enterT + dt / 0.7)
    const e = 1 - Math.pow(1 - this.enterT, 3)
    this.group.position.y = (live ? 0 : -0.03) + (1 - e) * -0.05
    this.group.visible = live || this.enterT < 0.98
    const sh = this.shadow.material as THREE.MeshBasicMaterial
    sh.opacity = 0.9 * e
  }

  margin(): MarginLine[] {
    const f = this.totalF()
    const k = f > 0 ? stiffness(f, this.dL) : K
    const lines: MarginLine[] = [
      { text: `F = ${num(f, 1)} Н` },
      { text: `Δl = ${num(this.dL * 100, 1)} см` },
    ]
    if (f > 0) lines.push({ text: `k = F / Δl = ${num(k, 0)} Н/м` })
    if (this.plastic) {
      lines.push({ text: 'предел пропорциональности пройден', gap: 0.006 })
      lines.push({ text: 'пружина осталась растянутой' })
    } else if (f > 0) {
      lines.push({ text: 'закон Гука выполняется' })
    }
    return lines
  }

  graph(): GraphSpec {
    return {
      points: this.points,
      xMax: 10,
      yMax: 6,
      xLabel: 'Δl, см',
      yLabel: 'F, Н',
      slope: K / 100,
      xStep: 2,
      yStep: 1,
    }
  }

  challenge() {
    return { met: springChallengeMet(this.dL, this.plastic) }
  }

  a11y(): A11yAction[] {
    return [
      ...WEIGHTS.map((w, i) => ({
        label: `Подвесить груз ${w} Н`,
        run: () => {
          if (this.onHook.has(i)) this.onHook.delete(i)
          else this.onHook.add(i)
          this.syncWeights()
        },
      })),
      { label: 'Сбросить пружину', run: () => {
        this.plastic = false
        this.plasticOffset = 0
        this.onHook.clear()
        this.syncWeights()
      } },
    ]
  }

  pickables(): THREE.Object3D[] {
    return this.picks
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
