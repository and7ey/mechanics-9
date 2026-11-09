import * as THREE from 'three'
import type { MarginLine, GraphSpec } from '../types'

export interface A11yAction {
  label: string
  run: () => void
}

export interface Scene {
  group: THREE.Group
  scale?: number
  /** Сцена стала видимой на развороте */
  enter(): void
  leave?(): void
  update(dt: number, time: number, live: boolean): void
  margin(): MarginLine[]
  graph(): GraphSpec | null
  challenge(): { met: boolean }
  setSwitch?(id: string, index: number): void
  a11y(): A11yAction[]
  pickables(): THREE.Object3D[]
  onPick?(obj: THREE.Object3D): void
  onDown?(point: THREE.Vector3 | null, obj?: THREE.Object3D | null): boolean
  onMove?(point: THREE.Vector3 | null): void
  onUp?(point: THREE.Vector3 | null): void
  reset?(): void
  dispose(): void
}
