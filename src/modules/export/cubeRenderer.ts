/**
 * Draws the cube off-screen, frame by frame, for the video and PDF exports.
 * Same look, turn directions and arrows as the on-screen 3D cube, but driven
 * directly (any step, any point in its turn) instead of by the page.
 */
import * as THREE from 'three'
import { STICKER_HEX } from '@/components/cube/colors'
import type { TurnAnimation } from '@/components/cube3d/animation'
import { STICKERS, type Face, type StickerColor, type Vec3 } from '@/modules/cube'

const CUBIE_SIZE = 0.96
const STICKER_SIZE = 0.84
const ARROW_COLOR = 0x38bdf8
const WHOLE_ARROW_COLOR = 0xf59e0b

type Cubie = { group: THREE.Group; position: Vec3 }

function stickerRotation(n: Vec3): THREE.Euler {
  if (n[0] !== 0) return new THREE.Euler(0, Math.PI / 2, 0)
  if (n[1] !== 0) return new THREE.Euler(Math.PI / 2, 0, 0)
  return new THREE.Euler(0, 0, 0)
}

export class CubeRenderer {
  readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly whole = new THREE.Group()
  private readonly layer = new THREE.Group()
  private readonly arrow = new THREE.Group()
  private readonly cubies: Cubie[] = []
  private readonly stickerMaterials: THREE.MeshStandardMaterial[] = []

  constructor(size: number, background: string | null = null) {
    this.canvas = document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: background === null,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(size, size, false)
    if (background) this.scene.background = new THREE.Color(background)

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    this.camera.position.set(5.3, 4.45, 6.7)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(4, 6, 5)
    const fill = new THREE.DirectionalLight(0xffffff, 0.4)
    fill.position.set(-5, -2, -4)
    this.scene.add(key, fill, this.whole, this.arrow)
    this.whole.add(this.layer)

    const body = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 })
    const stickerGeo = new THREE.BoxGeometry(STICKER_SIZE, STICKER_SIZE, 0.02)
    STICKERS.forEach(() =>
      this.stickerMaterials.push(new THREE.MeshStandardMaterial({ roughness: 0.45 })),
    )

    for (const x of [-1, 0, 1])
      for (const y of [-1, 0, 1])
        for (const z of [-1, 0, 1]) {
          if (x === 0 && y === 0 && z === 0) continue
          const group = new THREE.Group()
          group.position.set(x, y, z)
          group.add(new THREE.Mesh(body, bodyMat))
          STICKERS.forEach((s, i) => {
            if (s.position[0] !== x || s.position[1] !== y || s.position[2] !== z) return
            const m = new THREE.Mesh(stickerGeo, this.stickerMaterials[i])
            m.position.set(s.normal[0] * 0.485, s.normal[1] * 0.485, s.normal[2] * 0.485)
            m.rotation.copy(stickerRotation(s.normal))
            group.add(m)
          })
          this.whole.add(group)
          this.cubies.push({ group, position: [x, y, z] })
        }
  }

  /** Sets the sticker colors from a facelet string (as the user sees the cube). */
  setStickers(view: string, colorOf: Record<Face, StickerColor>): void {
    this.stickerMaterials.forEach((m, i) => m.color.set(STICKER_HEX[colorOf[view[i] as Face]]))
  }

  /** Puts the cube at `progress` (0-1) through a turn, or at rest when `turn` is null. */
  setTurn(turn: TurnAnimation | null, progress: number): void {
    this.layer.quaternion.identity()
    this.whole.quaternion.identity()
    // Every piece back on the cube, then the turning layer into its own group.
    for (const c of this.cubies) if (c.group.parent !== this.whole) this.whole.add(c.group)
    if (!turn) return
    const axis = new THREE.Vector3(...turn.axis)
    if (turn.kind === 'layer') {
      for (const c of this.cubies)
        if (
          c.position[0] * turn.axis[0] +
            c.position[1] * turn.axis[1] +
            c.position[2] * turn.axis[2] >
          0.5
        )
          this.layer.add(c.group)
      this.layer.quaternion.setFromAxisAngle(axis, turn.angle * progress)
    } else {
      this.whole.quaternion.setFromAxisAngle(axis, turn.angle * progress)
    }
  }

  /** Shows the arrow for the next turn (or none). */
  setArrow(turn: TurnAnimation | null): void {
    this.arrow.clear()
    if (!turn) return
    const whole = turn.kind === 'whole'
    const radius = whole ? 2.35 : 1.0
    const offset = whole ? 0 : 1.7
    const half = Math.abs(turn.angle) > Math.PI / 2 + 0.01
    const arc = half ? Math.PI * 1.3 : Math.PI * 0.75
    const material = new THREE.MeshBasicMaterial({
      color: whole ? WHOLE_ARROW_COLOR : ARROW_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.92,
    })
    const inner = new THREE.Group()
    inner.rotation.z = Math.PI / 2 - arc / 2
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 10, 48, arc), material)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 16), material)
    if (turn.angle < 0) {
      head.position.set(radius, 0, 0)
      head.rotation.z = Math.PI
    } else {
      head.position.set(radius * Math.cos(arc), radius * Math.sin(arc), 0)
      head.rotation.z = arc
    }
    ring.renderOrder = head.renderOrder = 10
    inner.add(ring, head)
    const outer = new THREE.Group()
    outer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...turn.axis))
    outer.position.set(turn.axis[0] * offset, turn.axis[1] * offset, turn.axis[2] * offset)
    outer.add(inner)
    this.arrow.add(outer)
  }

  /** Spins the whole view around the vertical axis (for intro/outro shots). */
  setSpin(angle: number): void {
    this.scene.rotation.y = angle
  }

  render(): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera)
    return this.canvas
  }

  dispose(): void {
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
