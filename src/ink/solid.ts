import * as THREE from 'three'
import { INK, SERIF, HAND } from './canvas'

export const PAPER_SURFACE = '#f7f0df'
export const PAPER_EDGE = '#fbf6ea'

export function surfaceMat(color = PAPER_SURFACE, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0,
    flatShading: false,
    ...opts,
  })
}

export function inkMesh(geometry: THREE.BufferGeometry, opts: { color?: string; edge?: string; threshold?: number } = {}) {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, surfaceMat(opts.color))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, opts.threshold ?? 24),
    new THREE.LineBasicMaterial({ color: opts.edge ?? INK, transparent: true, opacity: 0.85 }),
  )
  group.add(edges)
  return { group, mesh, edges }
}

export function lineMesh(points: THREE.Vector3[], color = INK, opacity = 0.85, closed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  return closed ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat)
}

export function spriteLabel(
  text: string,
  opts: { color?: string; size?: number; family?: string; weight?: number; italic?: boolean; pad?: number } = {},
) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const fontPx = 96
  const family = opts.family ?? SERIF
  const weight = opts.weight ?? 560
  ctx.font = `${opts.italic ? 'italic ' : ''}${weight} ${fontPx}px ${family}`
  const w = Math.ceil(ctx.measureText(text).width) + 40
  const h = fontPx * 1.5
  c.width = w
  c.height = h
  ctx.font = `${opts.italic ? 'italic ' : ''}${weight} ${fontPx}px ${family}`
  ctx.fillStyle = opts.color ?? INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sp = new THREE.Sprite(mat)
  const scale = opts.size ?? 0.1
  sp.scale.set((w / h) * scale, scale, 1)
  sp.renderOrder = 5
  return sp
}

export function setSpriteText(sp: THREE.Sprite, text: string, opts: Parameters<typeof spriteLabel>[1] = {}) {
  const next = spriteLabel(text, opts)
  const old = sp.material as THREE.SpriteMaterial
  old.map?.dispose()
  old.dispose()
  sp.material = next.material
  sp.scale.copy(next.scale)
}

export function makeArrow(color = '#9a3b2a', shaft = 0.014) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 })
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(shaft * 0.4, shaft * 0.4, 1, 8), mat)
  const head = new THREE.Mesh(new THREE.ConeGeometry(shaft * 1.15, shaft * 3.2, 14), mat)
  group.add(cyl, head)
  const up = new THREE.Vector3(0, 1, 0)

  function set(from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from)
    const len = Math.max(0.0001, dir.length())
    const headLen = Math.min(len * 0.38, shaft * 3.2)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize())

    cyl.position.copy(from).addScaledVector(dir.clone().normalize(), (len - headLen) / 2)
    cyl.quaternion.copy(q)
    cyl.scale.set(1, Math.max(0.0001, len - headLen), 1)

    head.position.copy(from).addScaledVector(dir.clone().normalize(), len - headLen / 2)
    head.quaternion.copy(q)
    head.scale.set(1, headLen / (shaft * 3.2), 1)
  }

  const visible = (v: boolean) => {
    group.visible = v
  }

  return { group, set, visible, mat }
}

export function groundShadow(w: number, d: number, opacity = 0.28) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 126)
  g.addColorStop(0, `rgba(28,24,18,${opacity})`)
  g.addColorStop(0.55, `rgba(28,24,18,${opacity * 0.45})`)
  g.addColorStop(1, 'rgba(28,24,18,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 1
  return mesh
}

export function helixPoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  coils: number,
  steps = 220,
): THREE.Vector3[] {
  const axis = to.clone().sub(from)
  const len = axis.length()
  const dir = axis.clone().normalize()
  const side = new THREE.Vector3(1, 0, 0)
  if (Math.abs(dir.dot(side)) > 0.9) side.set(0, 0, 1)
  const u = new THREE.Vector3().crossVectors(dir, side).normalize()
  const v = new THREE.Vector3().crossVectors(dir, u).normalize()
  const pts: THREE.Vector3[] = []
  const turns = coils * Math.PI * 2
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * turns
    const r = radius * (t < 0.04 ? t / 0.04 : 1)
    pts.push(
      from
        .clone()
        .addScaledVector(dir, t * len)
        .addScaledVector(u, Math.cos(a) * r)
        .addScaledVector(v, Math.sin(a) * r),
    )
  }
  return pts
}

export { HAND, SERIF }
