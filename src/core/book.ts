import * as THREE from 'three'
import type { GraphSpec, Hit, Lesson, MarginLine, Spread } from '../types'
import type { A11yAction, Scene } from '../scenes/types'
import { SpringScene } from '../scenes/spring'
import { LiftScene } from '../scenes/lift'
import { FrictionScene } from '../scenes/friction'
import { CHAPTERS, paragraphTitle, SPREADS } from '../content/book'
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
  PAPER,
  clearPage,
  makeCanvas,
} from '../ink/canvas'
import {
  FLAP,
  QUIZ,
  drawFlapBack,
  drawFlapFace,
  drawLessonLeft,
  drawLessonRight,
  drawSummaryLeft,
  drawSummaryRight,
  drawTitleLeft,
  drawTitleRight,
  type PageState,
} from '../layout/pages'
import { sound } from './sound'
import { store } from './progress'

interface Page {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  mesh: THREE.Mesh
  hits: Hit[]
}

interface SpreadState {
  predict: number | null
  flapOpen: boolean
  switches: Record<string, number>
  quiz: { picks: Record<number, number>; open: Record<number, boolean> }
}

const PAGE_W = 1.1
const PAGE_H = 1.45
const FLAP_ANGLE = 1.95

function pageTexture(canvas: HTMLCanvasElement, aniso = 8) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = aniso
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return tex
}

function bendMaterial(tex: THREE.Texture, uniforms: { uBend: { value: number } }, side: THREE.Side) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.95,
    metalness: 0,
    side,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = uniforms.uBend
    shader.vertexShader =
      'uniform float uBend;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.y += uBend * sin(3.14159265 * clamp(transformed.x / 1.1, 0.0, 1.0));',
      )
  }
  return mat
}

export interface BookOptions {
  canvas: HTMLCanvasElement
  onSpread?: (k: number, spread: Spread) => void
}

export class Book {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly spreads = SPREADS
  k = 1
  private opts: BookOptions
  private left!: Page
  private right!: Page
  private sheetFrontCanvas = makeCanvas()
  private sheetBackCanvas = makeCanvas()
  private sheetFrontTex = pageTexture(this.sheetFrontCanvas, 8)
  private sheetBackTex = pageTexture(this.sheetBackCanvas, 8)
  private sheet = new THREE.Group()
  private bend = { uBend: { value: 0 } }
  private sheetAngle = 0
  private turning: { from: number; to: number; dir: 1 | -1; t: number; dur: number } | null = null
  private states = new Map<number, SpreadState>()
  private scenes = new Map<number, Scene>()
  private currentScene: Scene | null = null
  private flapGroup = new THREE.Group()
  private flapAmount = 0
  private flapTarget = 0
  private flapMeshes: THREE.Mesh[] = []
  private raycaster = new THREE.Raycaster()

  private pointer = new THREE.Vector2()
  private drag: Scene | null = null
  private lastMargin = ''
  private lastGraph = ''
  private redrawAt = 0
  private clock = new THREE.Clock()
  private time = 0
  private target = new THREE.Vector3(0, 0.02, -0.03)
  private dir = new THREE.Vector3(0, 1.02, 1.0).normalize()
  private baseDist = 3
  private maxAniso = 8
  private parallax = new THREE.Vector2()
  private needsFit = true
  private sheetVisible = false
  private disposed = false
  private stampAt = 0

  constructor(opts: BookOptions) {
    this.opts = opts
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.maxAniso = Math.min(16, this.renderer.capabilities.getMaxAnisotropy())
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.raycaster.params.Line = { threshold: 0.015 }
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
    this.camera.position.set(0, 2.4, 2.4)

    this.buildStage()
    this.buildPages()
    this.buildSheet()
    this.buildFlap()

    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.bindPointer()
    this.bindKeys()

    this.k = clampSpread(initialSpread(), this.spreads.length)
    this.drawAll()
    this.arrive(this.k, true)
    this.loop()
    if (import.meta.env.DEV) (window as unknown as { __book: Book }).__book = this
  }

  /* ------------------------------ сцена ------------------------------ */

  private buildStage() {
    const hemi = new THREE.HemisphereLight(0xfffaf0, 0x8a8172, 1.15)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xfff0d6, 2.2)
    key.position.set(1.7, 3.4, 2.1)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 12
    key.shadow.camera.left = -2.4
    key.shadow.camera.right = 2.4
    key.shadow.camera.top = 2.4
    key.shadow.camera.bottom = -2.4
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.012
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0xdde6ff, 0.55)
    this.scene.add(new THREE.AmbientLight(0xfff8ec, 0.85))
    fill.position.set(-2.2, 1.6, -1.4)
    this.scene.add(fill)

    // стол
    const desk = makeCanvas(512, 512)
    const dctx = desk.getContext('2d')!
    dctx.fillStyle = '#5d6a5e'
    dctx.fillRect(0, 0, 512, 512)
    let seed = 77
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < 9000; i++) {
      const a = rnd() * 0.06
      dctx.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a * 0.5})` : `rgba(20,30,20,${a})`
      dctx.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2)
    }
    const deskTex = new THREE.CanvasTexture(desk)
    deskTex.colorSpace = THREE.SRGBColorSpace
    deskTex.wrapS = deskTex.wrapT = THREE.RepeatWrapping
    deskTex.repeat.set(3, 3)
    const deskMat = new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.96, metalness: 0 })
    const deskMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), deskMat)
    deskMesh.rotation.x = -Math.PI / 2
    deskMesh.position.y = -0.055
    deskMesh.receiveShadow = true
    this.scene.add(deskMesh)

    // обложка и блок страниц
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(2.34, 0.05, 1.61),
      new THREE.MeshStandardMaterial({ color: '#6b3a2c', roughness: 0.85, metalness: 0 }),
    )
    cover.position.y = -0.045
    cover.receiveShadow = true
    cover.castShadow = true
    this.scene.add(cover)

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.035, 1.56),
      new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.95 }),
    )
    block.position.y = -0.03
    block.receiveShadow = true
    this.scene.add(block)

    // корешок
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.028, 1.56),
      new THREE.MeshStandardMaterial({ color: '#4f2b22', roughness: 0.9 }),
    )
    spine.position.y = -0.028
    this.scene.add(spine)
  }

  private makePage(side: 'left' | 'right'): Page {
    const canvas = makeCanvas()
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    const texture = pageTexture(canvas, this.maxAniso)
    const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 6)
    geo.rotateX(-Math.PI / 2)
    const inner = side === 'left' ? PAGE_W / 2 : -PAGE_W / 2
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const d = (x - inner) / 0.13
      pos.setY(i, -0.014 * Math.exp(-d * d))
    }
    geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.96, metalness: 0 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(side === 'left' ? -PAGE_W / 2 : PAGE_W / 2, 0, 0)
    mesh.receiveShadow = true
    mesh.userData.side = side
    this.scene.add(mesh)
    return { canvas, ctx, texture, mesh, hits: [] }
  }

  private buildPages() {
    this.left = this.makePage('left')
    this.right = this.makePage('right')
  }

  private buildSheet() {
    const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 48, 6)
    geo.rotateX(-Math.PI / 2)
    geo.translate(PAGE_W / 2, 0, 0)
    const front = new THREE.Mesh(geo, bendMaterial(this.sheetFrontTex, this.bend, THREE.FrontSide))
    front.position.y = 0.001
    const back = new THREE.Mesh(geo, bendMaterial(this.sheetBackTex, this.bend, THREE.BackSide))
    back.position.y = -0.0005
    this.sheet.add(front, back)
    this.sheet.visible = false
    this.scene.add(this.sheet)
  }

  private buildFlap() {
    const w = (FLAP.u1 - FLAP.u0) * PAGE_W
    const h = (FLAP.v1 - FLAP.v0) * PAGE_H
    const fc = makeCanvas(900, Math.round((900 * h) / w))
    const bc = makeCanvas(900, Math.round((900 * h) / w))
    drawFlapFace(fc.getContext('2d')!, fc.width, fc.height)
    drawFlapBack(bc.getContext('2d')!, bc.width, bc.height)
    const ft = pageTexture(fc, this.maxAniso)
    const bt = pageTexture(bc, this.maxAniso)

    const geo = new THREE.PlaneGeometry(w, h, 8, 4)
    geo.translate(0, h / 2, 0)
    geo.rotateX(-Math.PI / 2)

    const front = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95, side: THREE.FrontSide }),
    )
    front.position.y = 0.0015
    front.castShadow = true
    const back = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95, side: THREE.BackSide }),
    )
    back.position.y = 0.0005
    this.flapMeshes = [front, back]
    this.flapGroup.add(front, back)
    const cx = (FLAP.u0 + FLAP.u1) / 2 - PAGE_W
    this.flapGroup.position.set(cx, 0.004, FLAP.v1 - PAGE_H / 2)
    front.userData.flap = true
    back.userData.flap = true
    this.scene.add(this.flapGroup)
  }

  /* ------------------------------ состояние ------------------------------ */

  state(k = this.k): SpreadState {
    let st = this.states.get(k)
    if (!st) {
      st = {
        predict: store.data.predicts[k] ?? null,
        flapOpen: !!store.data.flaps[k],
        switches: {},
        quiz: { picks: {}, open: {} },
      }
      this.states.set(k, st)
    }
    return st
  }

  pageState(k = this.k): PageState {
    const st = this.state(k)
    const scene = this.scenes.get(k)
    const margin: MarginLine[] = scene ? scene.margin() : []
    const graph: GraphSpec | null = scene ? scene.graph() : null
    return {
      predict: st.predict,
      flapOpen: st.flapOpen,
      switches: st.switches,
      margin,
      graph,
      stamped: !!store.data.stamps[k],
      quiz: st.quiz,
      challengeMet: !!scene?.challenge().met,
    }
  }

  /* ------------------------------ отрисовка ------------------------------ */

  private renderLeft(k: number, ctx: CanvasRenderingContext2D): Hit[] {
    const sp = this.spreads[k - 1]
    clearPage(ctx)
    const st = this.pageState(k)
    if (sp.kind === 'title') {
      drawTitleLeft(ctx)
      return []
    }
    if (sp.kind === 'lesson') return drawLessonLeft(ctx, sp.lesson, st, (k - 1) * 2 + 1)
    drawSummaryLeft(ctx, (k - 1) * 2 + 1)
    return []
  }

  private renderRight(k: number, ctx: CanvasRenderingContext2D): Hit[] {
    const sp = this.spreads[k - 1]
    clearPage(ctx)
    const st = this.pageState(k)
    if (sp.kind === 'title') {
      return drawTitleRight(
        ctx,
        CHAPTERS.map((c) => ({
          n: c.n,
          title: c.title,
          paragraphs: c.paragraphs.map((n) => ({
            n,
            title: paragraphTitle(n),
            ready: !!store.data && spreadOfParagraph(n) > 0,
          })),
        })),
        (n) => spreadOfParagraph(n),
      )
    }
    if (sp.kind === 'lesson') return drawLessonRight(ctx, sp.lesson, st, (k - 1) * 2 + 2)
    return drawSummaryRight(ctx, st, (k - 1) * 2 + 2)
  }

  private drawAll() {
    this.left.hits = this.renderLeft(this.k, this.left.ctx)
    this.right.hits = this.renderRight(this.k, this.right.ctx)
    this.left.texture.needsUpdate = true
    this.right.texture.needsUpdate = true
    this.lastMargin = this.pageState().margin.map((m) => m.text).join('|')
    this.lastGraph = JSON.stringify(this.pageState().graph?.points ?? [])
  }

  private redrawLeft() {
    this.left.hits = this.renderLeft(this.k, this.left.ctx)
    this.left.texture.needsUpdate = true
  }

  private redrawRight() {
    this.right.hits = this.renderRight(this.k, this.right.ctx)
    this.right.texture.needsUpdate = true
  }

  /* ------------------------------ навигация ------------------------------ */

  private ensureScene(k: number): Scene | null {
    const sp = this.spreads[k - 1]
    if (sp.kind !== 'lesson') return null
    let s = this.scenes.get(k)
    if (!s) {
      if (sp.lesson.scene === 'spring') s = new SpringScene()
      else if (sp.lesson.scene === 'lift') s = new LiftScene()
      else s = new FrictionScene()
      const dx = sp.lesson.scene === 'spring' ? 0.12 : 0
      s.group.position.set(PAGE_W / 2 + dx, 0.004, -0.02)
      s.group.scale.setScalar(s.scale ?? 1)
      s.group.visible = false
      this.scene.add(s.group)
      this.scenes.set(k, s)
      const st = this.state(k)
      for (const sw of sp.lesson.switches) s.setSwitch?.(sw.id, st.switches[sw.id] ?? 0)
    }
    return s
  }

  arrive(k: number, instant = false) {
    this.currentScene?.leave?.()
    this.currentScene = this.ensureScene(k)
    if (this.currentScene) {
      this.currentScene.enter()
      this.currentScene.group.visible = true
      this.currentScene.group.position.y = 0.004
    }
    // спрятать сцены других разворотов
    for (const [kk, s] of this.scenes) {
      if (kk !== k) s.group.visible = false
    }
    const sp = this.spreads[k - 1]
    const isLesson = sp.kind === 'lesson'
    this.flapGroup.visible = isLesson
    const st = this.state(k)
    this.flapTarget = st.flapOpen ? 1 : 0
    this.flapAmount = this.flapTarget
    this.flapGroup.rotation.x = this.flapAmount * FLAP_ANGLE
    store.visit(k)
    store.bookmark(k)
    if (!instant) sound.play('page', { gain: 0.7 })
    this.opts.onSpread?.(k, sp)
    this.drawAll()
  }

  goTo(k: number, instant = false) {
    k = clampSpread(k, this.spreads.length)
    if (k === this.k || this.turning) return
    if (instant) {
      this.k = k
      this.arrive(k, true)
      return
    }
    this.turnTo(k)
  }

  next() {
    this.goTo(this.k + 1)
  }

  prev() {
    this.goTo(this.k - 1)
  }

  private turnTo(to: number) {
    const dir: 1 | -1 = to > this.k ? 1 : -1
    if (Math.abs(to - this.k) > 1) {
      this.goTo(to, true)
      return
    }
    const from = this.k
    const target = to
    this.turning = { from, to: target, dir, t: 0, dur: 0.95 }
    sound.play('page')

    if (dir === 1) {
      // уходящая правая страница — на лицевую сторону листа
      this.sheetFrontCanvas.getContext('2d')!.drawImage(this.right.canvas, 0, 0)
      this.sheetFrontTex.needsUpdate = true
      // приходящая левая — на оборот листа
      this.renderLeft(target, this.sheetBackCanvas.getContext('2d')!)
      this.sheetBackTex.needsUpdate = true
      // правая страница сразу становится новой
      this.right.hits = this.renderRight(target, this.right.ctx)
      this.right.texture.needsUpdate = true
      this.sheetAngle = 0
    } else {
      this.sheetBackCanvas.getContext('2d')!.drawImage(this.left.canvas, 0, 0)
      this.sheetBackTex.needsUpdate = true
      this.renderRight(target, this.sheetFrontCanvas.getContext('2d')!)
      this.sheetFrontTex.needsUpdate = true
      this.left.hits = this.renderLeft(target, this.left.ctx)
      this.left.texture.needsUpdate = true
      this.sheetAngle = Math.PI
    }
    this.sheet.rotation.z = this.sheetAngle
    this.sheet.visible = true
    this.sheetVisible = true
    this.flapGroup.visible = false
    this.currentScene?.leave?.()
  }

  private finishTurn() {
    if (!this.turning) return
    const { to, dir } = this.turning
    this.turning = null
    this.sheet.visible = false
    this.sheetVisible = false
    this.bend.uBend.value = 0
    this.k = to
    if (dir === 1) {
      // левая страница окончательно становится новой
      this.renderLeft(to, this.left.ctx)
      this.left.texture.needsUpdate = true
    } else {
      this.right.hits = this.renderRight(to, this.right.ctx)
      this.right.texture.needsUpdate = true
    }
    this.arrive(to, true)
  }

  /* ------------------------------ ввод ------------------------------ */

  private bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        this.next()
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        this.prev()
      }
      if (e.key === 'Home') this.goTo(1)
      if (e.key === 'End') this.goTo(this.spreads.length)
    })
  }

  private bindPointer() {
    const el = this.opts.canvas
    el.addEventListener('pointermove', (e) => {
      this.setPointer(e)
      this.parallax.set((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2)
      if (this.drag) {
        const p = this.pagePoint()
        this.drag.onMove?.(p)
        return
      }
      const hit = this.pickScene()
      el.style.cursor = hit ? 'grab' : 'default'
    })
    el.addEventListener('pointerdown', (e) => {
      if (this.turning) return
      this.setPointer(e)
      try { el.setPointerCapture?.(e.pointerId) } catch {}

      const scene = this.currentScene
      if (scene) {
        const hit = this.pickScene()
        if (hit) {
          const p = this.pagePoint()
          if (scene.onDown?.(p, hit.object)) {
            this.drag = scene
            el.style.cursor = 'grabbing'
            return
          }
          scene.onPick?.(hit.object)
          sound.play('click')
          return
        }
      }

      // клапан
      const flapHit = this.raycastObjects(this.flapMeshes)
      if (flapHit) {
        this.toggleFlap()
        return
      }

      // страницы
      const page = this.pickPage()
      if (!page) return
      this.execHit(page.hit)
    })
    const up = (e: PointerEvent) => {
      if (this.drag) {
        this.drag.onUp?.(this.pagePoint())
        this.drag = null
        el.style.cursor = 'grab'
      }
      try {
        el.releasePointerCapture?.(e.pointerId)
      } catch {}
    }
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', () => {
      this.parallax.set(0, 0)
    })
  }

  private setPointer(e: PointerEvent) {
    const r = this.opts.canvas.getBoundingClientRect()
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }

  private raycastObjects(objs: THREE.Object3D[]) {
    if (!objs.length) return null
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(objs, true)
    return hits[0] ?? null
  }

  private pickScene() {
    if (!this.currentScene) return null
    const h = this.raycastObjects(this.currentScene.pickables())
    if (!h) return null
    return { ...h, object: pickTarget(h.object) }
  }

  private pagePoint(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.002)
    const p = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null
  }

  debugAt(px: number, py: number) {
    this.pointer.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects([this.left.mesh, this.right.mesh], false)
    return hits.slice(0, 2).map((h) => ({
      side: h.object.userData.side,
      u: h.uv ? h.uv.x * PAGE_W : null,
      v: h.uv ? (1 - h.uv.y) * PAGE_H : null,
      point: h.point.toArray(),
    }))
  }

  debugHit(px: number, py: number) {
    this.pointer.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects([this.left.mesh, this.right.mesh], false)
    const h = hits[0]
    if (!h || !h.uv) return null
    const side = h.object.userData.side as 'left' | 'right'
    const u = h.uv.x * PAGE_W
    const v = (1 - h.uv.y) * PAGE_H
    const list = side === 'left' ? this.left.hits : this.right.hits
    return { side, u, v, hit: list.find((x) => u >= x.u0 && u <= x.u1 && v >= x.v0 && v <= x.v1) ?? null }
  }

  private pickPage(): { side: 'left' | 'right'; hit: Hit } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects([this.left.mesh, this.right.mesh], false)
    const h = hits[0]
    if (!h || !h.uv) return null
    const side = (h.object.userData.side as 'left' | 'right') ?? 'left'
    const u = h.uv.x * PAGE_W
    const v = (1 - h.uv.y) * PAGE_H
    const list = side === 'left' ? this.left.hits : this.right.hits
    const hit = list.find((x) => u >= x.u0 && u <= x.u1 && v >= x.v0 && v <= x.v1)
    return hit ? { side, hit } : null
  }

  private execHit(hit: Hit) {
    const st = this.state()
    switch (hit.kind) {
      case 'predict': {
        const i = hit.data as number
        st.predict = st.predict === i ? null : i
        store.predict(this.k, st.predict)
        sound.play('pen')
        this.redrawLeft()
        break
      }
      case 'switch': {
        const d = hit.data as { id: string; index: number }
        st.switches[d.id] = d.index
        this.currentScene?.setSwitch?.(d.id, d.index)
        sound.play('click')
        this.redrawRight()
        this.redrawLeft()
        break
      }
      case 'goto': {
        this.goTo(hit.data as number)
        break
      }
      case 'quiz-pick': {
        const d = hit.data as { q: number; o: number }
        st.quiz.picks[d.q] = d.o
        sound.play('pen')
        this.redrawRight()
        break
      }
      case 'quiz-open': {
        const q = hit.data as number
        st.quiz.open[q] = !st.quiz.open[q]
        sound.play('flap')
        this.redrawRight()
        break
      }
    }
  }

  private toggleFlap() {
    const st = this.state()
    st.flapOpen = !st.flapOpen
    this.flapTarget = st.flapOpen ? 1 : 0
    store.flap(this.k, st.flapOpen)
    sound.play('flap')
  }

  /* ------------------------------ цикл ------------------------------ */

  private resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.fit()
  }

  /** Подгоняем камеру под книгу с учётом пропорций экрана. */
  private fit() {
    const corners: THREE.Vector3[] = []
    for (const x of [-1.18, 1.18]) for (const y of [-0.06, 0.06]) for (const z of [-0.82, 0.82]) corners.push(new THREE.Vector3(x, y, z))
    let d = 3
    for (let it = 0; it < 5; it++) {
      this.camera.position.copy(this.target).addScaledVector(this.dir, d)
      this.camera.lookAt(this.target)
      this.camera.updateMatrixWorld()
      this.camera.updateProjectionMatrix()
      let maxX = 0
      let maxY = 0
      for (const c of corners) {
        const p = c.clone().project(this.camera)
        maxX = Math.max(maxX, Math.abs(p.x))
        maxY = Math.max(maxY, Math.abs(p.y))
      }
      const f = Math.max(maxX / 0.94, maxY / 0.9)
      d *= f
    }
    this.baseDist = d
    this.needsFit = false
  }

  private loop = () => {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    this.time += dt

    if (this.turning) {
      this.turning.t += dt
      const t = Math.min(1, this.turning.t / this.turning.dur)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const angle = this.turning.dir === 1 ? Math.PI * e : Math.PI * (1 - e)
      this.sheet.rotation.z = angle
      this.sheet.position.y = Math.sin(Math.PI * t) * 0.035
      this.bend.uBend.value = Math.sin(Math.PI * t) * 0.07
      if (t >= 1) this.finishTurn()
    }

    // сцена
    const scene = this.currentScene
    if (scene && !this.turning) {
      scene.update(dt, this.time, true)
      const ch = scene.challenge()
      if (ch.met && store.stamp(this.k)) {
        sound.play('stamp')
        this.redrawLeft()
      }
      // живые числа
      const margin = this.state()
      const mstr = scene.margin().map((m) => m.text).join('|')
      const gstr = JSON.stringify(scene.graph()?.points ?? [])
      if ((mstr !== this.lastMargin || gstr !== this.lastGraph) && this.time - this.redrawAt > 0.12) {
        this.redrawAt = this.time
        this.lastMargin = mstr
        this.lastGraph = gstr
        this.redrawLeft()
        this.redrawRight()
      }
    }

    // клапан
    this.flapAmount += (this.flapTarget - this.flapAmount) * Math.min(1, dt * 9)
    this.flapGroup.rotation.x = this.flapAmount * FLAP_ANGLE

    // параллакс камеры
    const px = this.parallax.x * 0.035
    const py = this.parallax.y * 0.02
    this.camera.position.copy(this.target).addScaledVector(this.dir, this.baseDist)
    this.camera.position.x += px
    this.camera.position.y += -py
    this.camera.lookAt(this.target.x + px * 0.25, this.target.y - py * 0.2, this.target.z)

    this.renderer.render(this.scene, this.camera)
  }

  /* ------------------------------ прочее ------------------------------ */

  actions(): A11yAction[] {
    const out: A11yAction[] = []
    if (this.currentScene) out.push(...this.currentScene.a11y())
    if (this.spreads[this.k - 1].kind === 'lesson') {
      out.push({
        label: this.state().flapOpen ? 'Закрыть клапан' : 'Поднять клапан',
        run: () => this.toggleFlap(),
      })
      out.push({ label: 'Сбросить опыт', run: () => { this.currentScene?.reset?.(); this.redrawLeft(); this.redrawRight() } })
    }
    return out
  }

  runAction(i: number) {
    const a = this.actions()[i]
    if (!a) return
    a.run()
    sound.play('click')
    this.redrawLeft()
    this.redrawRight()
  }

  spreadInfo(k = this.k) {
    return this.spreads[k - 1]
  }

  destroy() {
    this.disposed = true
    this.scenes.forEach((s) => s.dispose())
    this.renderer.dispose()
  }
}

function pickTarget(obj: THREE.Object3D): THREE.Object3D {
  let o: THREE.Object3D | null = obj
  while (o && o.userData.pick === undefined && o.userData.flap === undefined) o = o.parent
  return o ?? obj
}

function clampSpread(k: number, n: number) {
  if (!Number.isFinite(k)) return 1
  return Math.max(1, Math.min(n, Math.round(k)))
}

function initialSpread(): number {
  const m = /spread-(\d+)/.exec(location.hash)
  if (m) return Number(m[1])
  const q = new URLSearchParams(location.search)
  const k = Number(q.get('k'))
  if (Number.isFinite(k) && k > 0) return k
  const b = Number(store.data.bookmark)
  return Number.isFinite(b) && b > 1 ? b : 1
}

export function spreadOfParagraph(n: number): number {
  const idx = SPREADS.findIndex((s) => s.kind === 'lesson' && s.lesson.n === n)
  return idx >= 0 ? idx + 1 : 0
}
