import * as THREE from 'three'
import type { MarginLine } from '../types'
import type { A11yAction, Scene } from './types'
import { inkMesh, makeArrow, spriteLabel, groundShadow, setSpriteText } from '../ink/solid'
import { ACCENT, INK } from '../ink/canvas'
import { clamp, num } from '../core/fmt'
import { frictionMax, iceChallengeMet } from '../physics'

const M = 2
const G = 9.8
const N = M * G
const HOME = -0.1
const LIMIT = 0.32

const SURFACES = [
  { name: 'дерево', mu: 0.4, color: '#f4ead4' },
  { name: 'лёд', mu: 0.05, color: '#eaf2f4' },
  { name: 'резина', mu: 0.8, color: '#e9e2d5' },
]

export class FrictionScene implements Scene {
  group = new THREE.Group()
  scale = 0.88
  private shadow: THREE.Mesh
  private block: THREE.Group
  private board: THREE.Group
  private rollers = new THREE.Group()
  private rope: THREE.Line
  private handle: THREE.Object3D
  private surf = 0
  private roll = 0
  private x = HOME
  private v = 0
  private applied = 0
  private dragging = false
  private grab = 0
  private maxApplied = 0
  private peakIce = 0
  private homeX = HOME
  private forceArrow = makeArrow('#9a3b2a', 0.016)
  private fricArrow = makeArrow('#273463', 0.016)
  private forceLabel: THREE.Sprite
  private fricLabel: THREE.Sprite
  private enterT = 0
  private time = 0

  constructor() {
    this.shadow = groundShadow(0.62, 0.4, 0.28)
    this.shadow.position.set(0, 0.001, 0.08)
    this.group.add(this.shadow)

    this.board = inkMesh(new THREE.BoxGeometry(0.7, 0.028, 0.28), { color: '#f1e6cf' }).group
    this.board.position.set(0, 0.014, 0.08)
    this.group.add(this.board)

    // насечки на доске
    for (let i = -3; i <= 3; i++) {
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.002, 0.001, 0.02),
        new THREE.MeshBasicMaterial({ color: 'rgba(39,52,99,0.35)', transparent: true }),
      )
      tick.position.set(i * 0.09, 0.0285, 0.2)
      this.group.add(tick)
    }

    this.block = inkMesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), { color: '#f8f1de' }).group
    this.block.position.set(this.x, 0.086, 0.08)
    this.block.userData.pick = 'block'
    this.group.add(this.block)

    this.rollers.position.set(this.x, 0.02, 0.08)
    this.rollers.visible = false
    for (const dx of [-0.05, 0.05]) {
      for (const dz of [-0.035, 0.035]) {
        const wheel = inkMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 14), { color: '#f7f0df' })
        wheel.group.rotation.z = Math.PI / 2
        wheel.group.position.set(dx, 0, dz)
        this.rollers.add(wheel.group)
      }
    }
    this.group.add(this.rollers)

    this.handle = inkMesh(new THREE.TorusGeometry(0.02, 0.006, 8, 20), { color: '#f7f0df' }).group
    this.handle.userData.pick = 'handle'
    this.handle.position.set(this.x + 0.27, 0.045, 0.08)
    this.group.add(this.handle)

    const ropeGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    ])
    this.rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.6 }))
    this.group.add(this.rope)

    this.forceArrow.set(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.2, 0.1, 0))
    this.fricArrow.set(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(-0.12, 0.05, 0))
    this.group.add(this.forceArrow.group, this.fricArrow.group)

    this.forceLabel = spriteLabel('F', { size: 0.055, family: '"Caveat", cursive', weight: 560, color: ACCENT })
    this.fricLabel = spriteLabel('Fтр', { size: 0.05, family: '"Caveat", cursive', weight: 560, color: INK })
    this.group.add(this.forceLabel, this.fricLabel)

    this.refreshSurface()
    this.updateVisual()
  }

  enter() {
    this.enterT = 0
  }

  private mu(): number {
    if (this.roll) return 0.02
    return SURFACES[this.surf].mu
  }

  private fMax(): number {
    return frictionMax(this.mu(), M, G)
  }

  setSwitch(id: string, index: number) {
    if (id === 'surface') {
      this.surf = index
      this.refreshSurface()
    }
    if (id === 'rollers') {
      this.roll = index
      this.refreshSurface()
    }
  }

  private refreshSurface() {
    const s = SURFACES[this.surf]
    const b = this.board.children[0] as THREE.Mesh
    if (b) (b.material as THREE.MeshStandardMaterial).color.set(s.color)
    this.rollers.visible = !!this.roll
  }

  onDown(point: THREE.Vector3 | null): boolean {
    if (!point) return false
    this.dragging = true
    this.grab = point.x - this.x
    this.v = 0
    return true
  }

  onMove(point: THREE.Vector3 | null) {
    if (!this.dragging || !point) return
    const pull = point.x - this.grab - this.x
    this.applied = clamp(pull * 55, 0, 26)
    this.maxApplied = Math.max(this.maxApplied, this.applied)
    if (this.surf === 1) this.peakIce = Math.max(this.peakIce, this.applied)
  }

  onUp() {
    this.dragging = false
    this.applied = 0
  }

  private updateVisual() {
    this.block.position.x = this.x
    this.rollers.position.x = this.x
    this.handle.position.x = this.x + 0.27

    const ropePos = this.rope.geometry.attributes.position as THREE.BufferAttribute
    ropePos.setXYZ(0, this.x + 0.08, 0.08, 0.08)
    ropePos.setXYZ(1, this.handle.position.x, 0.05, 0.08)
    ropePos.needsUpdate = true

    const fLen = 0.03 + (this.applied / 26) * 0.22
    this.forceArrow.set(
      new THREE.Vector3(this.x + 0.09, 0.12, 0.08),
      new THREE.Vector3(this.x + 0.09 + fLen, 0.12, 0.08),
    )
    this.forceArrow.group.visible = this.applied > 0.05
    this.forceLabel.position.set(this.x + 0.11 + fLen, 0.16, 0.08)
    setSpriteText(this.forceLabel, `F = ${num(this.applied, 1)} Н`, {
      size: 0.045,
      family: '"Caveat", cursive',
      weight: 560,
      color: ACCENT,
    })

    const fr = Math.min(this.applied, this.fMax())
    const frLen = 0.02 + (fr / 20) * 0.18
    this.fricArrow.set(
      new THREE.Vector3(this.x - 0.09, 0.05, 0.08),
      new THREE.Vector3(this.x - 0.09 - frLen, 0.05, 0.08),
    )
    this.fricArrow.group.visible = fr > 0.05
    this.fricLabel.position.set(this.x - 0.11 - frLen, 0.09, 0.08)
    setSpriteText(this.fricLabel, `Fтр = ${num(fr, 1)} Н`, {
      size: 0.042,
      family: '"Caveat", cursive',
      weight: 560,
      color: INK,
    })
  }

  update(dt: number, time: number, live: boolean) {
    this.time = time
    this.enterT = Math.min(1, this.enterT + dt / 0.7)
    const e = 1 - Math.pow(1 - this.enterT, 3)
    this.group.position.y = (live ? 0 : -0.03) + (1 - e) * -0.05
    this.group.visible = live || this.enterT < 0.98
    const sh = this.shadow.material as THREE.MeshBasicMaterial
    sh.opacity = 0.9 * e

    const fMax = this.fMax()
    if (this.dragging) {
      if (this.applied > fMax) {
        const acc = (this.applied - fMax) / M
        this.v += acc * dt * 0.45
      } else {
        this.v = 0
      }
    } else {
      this.v *= Math.max(0, 1 - dt * 6)
    }
    if (Math.abs(this.v) > 1e-4) {
      this.x += this.v * dt
      if (this.x > LIMIT) {
        this.x = LIMIT
        this.v = 0
      }
      if (this.x < -LIMIT) {
        this.x = -LIMIT
        this.v = 0
      }
    }
    this.updateVisual()
  }

  margin(): MarginLine[] {
    const fMax = this.fMax()
    const fr = Math.min(this.applied, fMax)
    const sliding = this.applied > fMax + 0.05
    const lines: MarginLine[] = [
      { text: `m = ${num(M, 1)} кг` },
      { text: `N = m g = ${num(N, 1)} Н` },
      { text: `μ = ${num(this.mu(), 2)}` },
      { text: `F = ${num(this.applied, 1)} Н` },
      { text: `Fтр = ${num(fr, 1)} Н`, gap: 0.008 },
    ]
    lines.push({ text: sliding ? 'скольжение' : 'покой' })
    if (this.roll) lines.push({ text: 'катки: трение меньше' })
    return lines
  }

  graph() {
    return null
  }

  challenge() {
    return {
      met: this.surf === 1 && !this.roll && iceChallengeMet(this.peakIce, this.x - this.homeX),
    }
  }

  a11y(): A11yAction[] {
    return [
      ...SURFACES.map((s, i) => ({
        label: `Поверхность: ${s.name}`,
        run: () => {
          this.surf = i
          this.refreshSurface()
        },
      })),
      {
        label: this.roll ? 'Выключить катки' : 'Включить катки',
        run: () => {
          this.roll = this.roll ? 0 : 1
          this.refreshSurface()
        },
      },
      {
        label: 'Толкнуть брусок',
        run: () => {
          this.applied = this.fMax() + 2
          this.maxApplied = Math.max(this.maxApplied, this.applied)
          if (this.surf === 1) this.peakIce = Math.max(this.peakIce, this.applied)
          this.v = 0.4
          this.applied = 0
        },
      },
    ]
  }

  reset() {
    this.x = HOME
    this.v = 0
    this.applied = 0
    this.peakIce = 0
    this.maxApplied = 0
  }

  pickables(): THREE.Object3D[] {
    return [this.block, this.handle]
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
