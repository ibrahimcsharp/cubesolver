/**
 * 3D cube that plays a solution. The cube is drawn as the user is holding it
 * (x = right, y = up, z = toward the user). When `index` moves by one step,
 * the turn is animated; bigger jumps snap straight to the new state.
 *
 * Loaded on demand (React.lazy) so three.js is only downloaded when needed.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STICKER_HEX } from '@/components/cube/colors'
import { STICKERS, type Face, type StickerColor, type Vec3 } from '@/modules/cube'
import type { Step } from '@/modules/solution'
import { easeInOut, reverse, stepAnimation, turnDuration, type TurnAnimation } from './animation'

export type CubePlayer3DProps = {
  /** Facelet string as the user sees the cube, for every index 0..steps.length. */
  views: readonly string[]
  steps: readonly Step[]
  /** The step about to be done (the cube shows the state before it). */
  index: number
  colorOf: Record<Face, StickerColor>
  /** Milliseconds for a quarter turn. */
  quarterMs: number
  label: string
}

type Running = { anim: TurnAnimation; to: number; start: number; duration: number }

const STICKER_SIZE = 0.84
const CUBIE_SIZE = 0.96
const ARROW_COLOR = '#38bdf8'

/** The 26 visible pieces and the stickers on each. */
const CUBIES: { key: string; position: Vec3; stickers: number[] }[] = (() => {
  const out: { key: string; position: Vec3; stickers: number[] }[] = []
  for (const x of [-1, 0, 1])
    for (const y of [-1, 0, 1])
      for (const z of [-1, 0, 1]) {
        if (x === 0 && y === 0 && z === 0) continue
        const stickers = STICKERS.flatMap((s, i) =>
          s.position[0] === x && s.position[1] === y && s.position[2] === z ? [i] : [],
        )
        out.push({ key: `${x},${y},${z}`, position: [x, y, z], stickers })
      }
  return out
})()

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Turns a flat sticker so it faces along its normal. */
function stickerRotation(n: Vec3): [number, number, number] {
  if (n[0] !== 0) return [0, Math.PI / 2, 0]
  if (n[1] !== 0) return [Math.PI / 2, 0, 0]
  return [0, 0, 0]
}

function Cubie({
  position,
  stickers,
  colors,
}: {
  position: Vec3
  stickers: number[]
  colors: string[]
}) {
  return (
    <group position={position as unknown as [number, number, number]}>
      <mesh>
        <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
        <meshStandardMaterial color="#111114" roughness={0.6} />
      </mesh>
      {stickers.map((i) => {
        const n = STICKERS[i]!.normal
        return (
          <mesh
            key={i}
            position={[n[0] * 0.485, n[1] * 0.485, n[2] * 0.485]}
            rotation={stickerRotation(n)}
          >
            <boxGeometry args={[STICKER_SIZE, STICKER_SIZE, 0.02]} />
            <meshStandardMaterial color={colors[i]} roughness={0.45} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Curved arrow around `axis`; a negative angle points clockwise seen from outside. */
function TurnArrow({
  axis,
  offset,
  radius,
  angle,
}: {
  axis: Vec3
  offset: number
  radius: number
  angle: number
}) {
  const quaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(...axis),
      ),
    [axis],
  )
  const half = Math.abs(angle) > Math.PI / 2 + 0.01
  const arc = half ? Math.PI * 1.3 : Math.PI * 0.75
  const clockwise = angle < 0
  const head = clockwise
    ? { position: [radius, 0, 0] as const, rotation: Math.PI }
    : { position: [radius * Math.cos(arc), radius * Math.sin(arc), 0] as const, rotation: arc }
  const material = (
    <meshBasicMaterial color={ARROW_COLOR} depthTest={false} transparent opacity={0.92} />
  )
  return (
    <group
      quaternion={quaternion}
      position={[axis[0] * offset, axis[1] * offset, axis[2] * offset]}
    >
      <group rotation={[0, 0, Math.PI / 2 - arc / 2]}>
        <mesh renderOrder={10}>
          <torusGeometry args={[radius, 0.06, 10, 48, arc]} />
          {material}
        </mesh>
        <mesh
          renderOrder={10}
          position={head.position as unknown as [number, number, number]}
          rotation={[0, 0, head.rotation]}
        >
          <coneGeometry args={[0.17, 0.4, 16]} />
          {material}
        </mesh>
      </group>
    </group>
  )
}

function Controls() {
  const { camera, gl } = useThree()
  const ref = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enablePan = false
    c.enableZoom = false // keep the page scroll working
    c.enableDamping = true
    c.rotateSpeed = 0.8
    ref.current = c
    return () => c.dispose()
  }, [camera, gl])
  useFrame(() => ref.current?.update())
  return null
}

function Scene({ views, steps, index, colorOf, quarterMs }: Omit<CubePlayer3DProps, 'label'>) {
  const [shown, setShown] = useState(index)
  const [running, setRunning] = useState<Running | null>(null)
  const shownRef = useRef(index)
  const runRef = useRef<Running | null>(null)
  const layerRef = useRef<THREE.Group>(null)
  const wholeRef = useRef<THREE.Group>(null)
  const axis = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const now = performance.now()
    const run = runRef.current
    if (run) {
      const t = Math.min(1, (now - run.start) / run.duration)
      axis.set(...run.anim.axis)
      const target = run.anim.kind === 'layer' ? layerRef.current : wholeRef.current
      target?.quaternion.setFromAxisAngle(axis, run.anim.angle * easeInOut(t))
      if (t >= 1) {
        // Keep the final rotation until React shows the new state (no flicker).
        runRef.current = null
        shownRef.current = run.to
        setShown(run.to)
        setRunning(null)
      }
      return
    }
    const from = shownRef.current
    if (from === index) return
    if (Math.abs(index - from) === 1 && quarterMs > 0) {
      const forward = index > from
      const step = steps[forward ? from : from - 1]!
      const base = stepAnimation(step)
      const anim = forward ? base : reverse(base)
      const next = { anim, to: index, start: now, duration: turnDuration(anim, quarterMs) }
      runRef.current = next
      setRunning(next)
    } else {
      shownRef.current = index
      setShown(index)
    }
  })

  // Once the new state is on screen, put the turning parts back to rest.
  useLayoutEffect(() => {
    if (running) return
    layerRef.current?.quaternion.identity()
    wholeRef.current?.quaternion.identity()
  }, [shown, running])

  const view = views[shown] ?? views[0]!
  const colors = useMemo(
    () => [...view].map((ch) => STICKER_HEX[colorOf[ch as Face]]),
    [view, colorOf],
  )
  const layerAxis = running?.anim.kind === 'layer' ? running.anim.axis : null
  const moving = CUBIES.filter((c) => layerAxis && dot(c.position, layerAxis) > 0.5)
  const still = CUBIES.filter((c) => !(layerAxis && dot(c.position, layerAxis) > 0.5))

  const next = !running && shown === index ? steps[index] : undefined
  const arrow = next ? stepAnimation(next) : null

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <directionalLight position={[-5, -2, -4]} intensity={0.4} />
      <group ref={wholeRef}>
        <group ref={layerRef}>
          {moving.map((c) => (
            <Cubie key={c.key} position={c.position} stickers={c.stickers} colors={colors} />
          ))}
        </group>
        {still.map((c) => (
          <Cubie key={c.key} position={c.position} stickers={c.stickers} colors={colors} />
        ))}
      </group>
      {arrow &&
        (arrow.kind === 'layer' ? (
          <TurnArrow axis={arrow.axis} offset={1.7} radius={1.0} angle={arrow.angle} />
        ) : (
          <TurnArrow axis={arrow.axis} offset={0} radius={2.35} angle={arrow.angle} />
        ))}
      <Controls />
    </>
  )
}

export default function CubePlayer3D({ label, ...props }: CubePlayer3DProps) {
  return (
    <div role="img" aria-label={label} className="aspect-square w-full touch-none">
      <Canvas camera={{ position: [4.4, 3.7, 5.6], fov: 34 }} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}
