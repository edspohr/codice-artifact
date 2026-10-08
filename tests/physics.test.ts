import { beforeEach, describe, expect, it } from 'vitest'
import { config, resetConfig, setConfig } from '../src/gestures/config'
import { Camera } from '../src/world/camera'
import { MarPhysics } from '../src/world/physics'
import { buildWorld } from '../src/world/world'

beforeEach(() => resetConfig())

function setup() {
  const world = buildWorld(390, 844, 1)
  const camera = new Camera(world)
  camera.setViewport(390, 844)
  // Move away from the clamped bottom so vertical motion is free both ways.
  camera.y -= 600
  const physics = new MarPhysics(world, camera)
  return { world, camera, physics }
}

describe('Mar physics: traction', () => {
  it('the world follows the finger by the traction fraction, the rest is slip', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('MAR_TRACTION', 0.7)
    const { camera, physics } = setup()
    const x0 = camera.x
    physics.touchStart(0)
    const slip = physics.drag(200, 400, 100, 0, 16, 16)
    expect(camera.x - x0).toBeCloseTo(-70, 5)
    // The finger moved 100 px on screen; the ink moved 70 under it: 30 px of slip, in the finger's direction.
    expect(slip.dx).toBeCloseTo(30, 5)
    expect(slip.dy).toBeCloseTo(0, 5)
  })

  it('with full traction and no lag there is no slip, and nothing smears', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('MAR_TRACTION', 1)
    const { physics } = setup()
    physics.touchStart(0)
    const slip = physics.drag(200, 400, 60, -40, 16, 16)
    expect(Math.hypot(slip.dx, slip.dy)).toBeLessThan(1e-6)
  })

  it('lag makes a steady drag carry and a reversal slip', () => {
    setConfig('MAR_LAG_MS', 200)
    setConfig('MAR_TRACTION', 1)
    setConfig('BANK_RESISTANCE', 0)
    const { physics } = setup()
    physics.touchStart(0)
    let t = 0
    let slipSteady = 0
    // Drag along the channel (vertical), where there is room to carry.
    for (let i = 0; i < 60; i++) {
      t += 16
      const s = physics.drag(200, 700 - i * 5, 0, -5, 16, t)
      if (i > 40) slipSteady += Math.abs(s.dy)
    }
    // Reverse direction: the lagging world keeps going the old way for a while.
    const s = physics.drag(200, 700 - 60 * 5 + 5, 0, 5, 16, t + 16)
    expect(slipSteady / 19).toBeLessThan(1)
    expect(Math.abs(s.dy)).toBeGreaterThan(1)
  })

  it('inertia decays after release and the current takes over slowly, carrying the visitor up', () => {
    setConfig('MAR_CURRENT_FADE_S', 0)
    setConfig('BANK_RETURN', 0)
    const { camera, physics } = setup()
    physics.touchStart(0)
    for (let i = 1; i <= 10; i++) physics.drag(200 - i * 20, 400, -20, 0, 16, i * 16)
    physics.touchEnd(160)
    const v0 = Math.hypot(camera.vx, camera.vy)
    expect(v0).toBeGreaterThan(0.2)
    let t = 160
    for (let i = 0; i < 120; i++) {
      t += 16
      physics.step(16, t, null)
    }
    const v1 = Math.hypot(camera.vx, camera.vy)
    expect(v1).toBeLessThan(v0 * 0.5)
    // A steady slow speed remains, bounded by the configured current speed, and it points up the channel.
    expect(v1).toBeLessThanOrEqual(config.MAR_CURRENT_SPEED / 1000 + 1e-6)
    for (let i = 0; i < 300; i++) {
      t += 16
      physics.step(16, t, null)
    }
    expect(camera.vy).toBeLessThan(0)
    expect(Math.abs(camera.vy)).toBeGreaterThan(Math.abs(camera.vx))
  })

  it('banks: lateral traction fades toward the edge and a return current points to the centre', () => {
    setConfig('MAR_LAG_MS', 0)
    const { world, camera, physics } = setup()
    const region = world.regions[0]!.rect
    const centre = region.x + region.w / 2
    const halfRange = region.w / 2 - camera.viewW / 2
    camera.x = centre
    expect(physics.bankFactor(centre)).toBe(0)
    expect(physics.bankFactor(centre + halfRange)).toBeCloseTo(1, 5)
    // Same finger motion, less world motion at the bank.
    physics.touchStart(0)
    const x0 = camera.x
    physics.drag(200, 400, 40, 0, 16, 16)
    const centreMove = Math.abs(camera.x - x0)
    camera.x = centre + halfRange * 0.97
    camera.vx = 0
    const x1 = camera.x
    physics.drag(200, 400, -40, 0, 16, 32)
    const bankMove = Math.abs(camera.x - x1)
    expect(bankMove).toBeLessThan(centreMove * 0.5)
    // The current at the right bank has a leftward component.
    setConfig('MAR_HELP_BIAS', 0)
    const c = physics.currentAt(centre + halfRange * 0.97, camera.y, 0, null)
    expect(c.x).toBeLessThan(0)
  })

  it('currents fade to nothing after the configured time, and the view comes to rest', () => {
    setConfig('MAR_CURRENT_FADE_S', 2)
    const { camera, physics } = setup()
    physics.touchStart(0)
    physics.drag(200, 400, -30, 0, 16, 16)
    physics.touchEnd(32)
    let t = 32
    let moving = true
    for (let i = 0; i < 400 && moving; i++) {
      t += 16
      moving = physics.step(16, t, null)
    }
    expect(moving).toBe(false)
    expect(Math.hypot(camera.vx, camera.vy)).toBe(0)
  })

  it('the help bias bends the current toward the nearest unfound place; zero disables it', () => {
    setConfig('MAR_CURRENT_FADE_S', 0)
    setConfig('BANK_RETURN', 0)
    const { camera, physics } = setup()
    const target = { x: camera.x + 1000, y: camera.y }
    setConfig('MAR_HELP_BIAS', 1)
    const biased = physics.currentDirection(camera.x, camera.y, target)
    expect(biased.x).toBeCloseTo(1, 5)
    expect(Math.abs(biased.y)).toBeLessThan(1e-6)
    setConfig('MAR_HELP_BIAS', 0.45)
    const bent = physics.currentDirection(camera.x, camera.y, target)
    expect(bent.x).toBeGreaterThan(0.3)
    expect(bent.y).toBeLessThan(-0.3)
    setConfig('MAR_HELP_BIAS', 0)
    const free = physics.currentAt(camera.x, camera.y, 0, target)
    const freeNoTarget = physics.currentAt(camera.x, camera.y, 0, null)
    expect(free).toEqual(freeNoTarget)
    expect(free.y).toBeLessThan(0)
  })
})
