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
    const region = world.regions.find((r) => r.id === 'mar')!.rect
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
    physics.helpBias = 1
    const biased = physics.currentDirection(camera.x, camera.y, target)
    expect(biased.x).toBeCloseTo(1, 5)
    expect(Math.abs(biased.y)).toBeLessThan(1e-6)
    physics.helpBias = 0.45
    const bent = physics.currentDirection(camera.x, camera.y, target)
    expect(bent.x).toBeGreaterThan(0.3)
    expect(bent.y).toBeLessThan(-0.3)
    physics.helpBias = 0
    const free = physics.currentAt(camera.x, camera.y, 0, target)
    const freeNoTarget = physics.currentAt(camera.x, camera.y, 0, null)
    expect(free).toEqual(freeNoTarget)
    expect(free.y).toBeLessThan(0)
  })

  it('at rest the help is faint and the current runs up; the passive bias is the default', () => {
    const { physics } = setup()
    expect(physics.helpBias).toBe(config.MAR_HELP_BIAS)
    expect(config.MAR_HELP_BIAS).toBeLessThan(0.15)
    expect(config.MAR_HELP_ACTIVE_BIAS).toBeGreaterThan(0.7)
  })

  it('the threshold is a colossus: the current at its fastest and less traction inside the band', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('BANK_RETURN', 0)
    setConfig('MAR_CURRENT_FADE_S', 0)
    const { world, camera, physics } = setup()
    const band = world.thresholds[0]!.band
    const mar = world.regions.find((r) => r.id === 'mar')!.rect
    const centreX = mar.x + mar.w / 2
    physics.helpBias = 0
    const inside = physics.currentAt(centreX, band.y + band.h * 0.75, 0, null)
    const below = physics.currentAt(centreX, band.y + band.h + 400, 0, null)
    expect(Math.hypot(inside.x, inside.y)).toBeCloseTo(Math.hypot(below.x, below.y) * config.THRESHOLD_CURRENT_MULT, 6)
    // Same finger motion, less world motion inside the band.
    camera.x = centreX
    camera.y = band.y + band.h + 400
    physics.touchStart(0)
    const y0 = camera.y
    physics.drag(200, 600, 0, -40, 16, 16)
    const freeMove = Math.abs(camera.y - y0)
    camera.y = band.y + band.h * 0.75
    camera.vy = 0
    const y1 = camera.y
    physics.drag(200, 560, 0, -40, 16, 32)
    const bandMove = Math.abs(camera.y - y1)
    expect(bandMove).toBeCloseTo(freeMove * (config.THRESHOLD_TRACTION / config.MAR_TRACTION), 3)
  })
})

describe('physics per region', () => {
  function inRegion(id: 'cordillera' | 'cielo' | 'tierra') {
    const world = buildWorld(390, 844, 1)
    const camera = new Camera(world)
    camera.setViewport(390, 844)
    const r = world.regions.find((x) => x.id === id)!.rect
    camera.x = r.x + r.w / 2
    camera.y = r.y + r.h / 2
    const physics = new MarPhysics(world, camera)
    return { world, camera, physics }
  }

  it('Cordillera: no inertia, no current; up costs more than sideways', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('BANK_RESISTANCE', 0)
    const { camera, physics } = inRegion('cordillera')
    physics.touchStart(0)
    const x0 = camera.x
    physics.drag(200, 400, 40, 0, 16, 16)
    const sideways = Math.abs(camera.x - x0)
    const y0 = camera.y
    physics.drag(200, 400, 0, 40, 16, 32) // finger down: the world is pulled up
    const up = Math.abs(camera.y - y0)
    expect(up).toBeLessThan(sideways * 0.6)
    physics.touchEnd(48)
    expect(camera.vx).toBe(0)
    expect(camera.vy).toBe(0)
    const y1 = camera.y
    physics.step(16, 64, null)
    expect(camera.y).toBe(y1)
  })

  it('Cordillera: pulling up without pause tires, rest recovers', () => {
    setConfig('MAR_LAG_MS', 0)
    const { camera, physics } = inRegion('cordillera')
    physics.touchStart(0)
    const pull = () => {
      const y = camera.y
      physics.drag(200, 400, 0, 20, 16, 0)
      return Math.abs(camera.y - y)
    }
    const fresh = pull()
    for (let i = 0; i < 80; i++) pull()
    const tired = pull()
    expect(physics.fatigue).toBeGreaterThan(0.8)
    expect(tired).toBeLessThan(fresh * 0.4)
    physics.touchEnd(0)
    for (let t = 0; t < 4000; t += 16) physics.step(16, t, null)
    expect(physics.fatigue).toBe(0)
    physics.touchStart(5000)
    expect(pull()).toBeCloseTo(fresh, 3)
  })

  it('Cielo: little traction, a flick sustains a drift that slows to a minimum and only a touch stops', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('BANK_RESISTANCE', 0)
    const { camera, physics } = inRegion('cielo')
    physics.touchStart(0)
    const x0 = camera.x
    physics.drag(200, 400, 40, 0, 16, 16)
    expect(Math.abs(camera.x - x0)).toBeCloseTo(40 * config.CIELO_TRACTION, 3)
    physics.drag(200, 400, 0, 30, 16, 32)
    physics.touchEnd(48)
    let t = 48
    for (let i = 0; i < 2000; i++) {
      t += 16
      const moving = physics.step(16, t, null)
      // The drift only ends at the top edge of the world (or with a touch).
      if (!moving) {
        expect(camera.y).toBeLessThanOrEqual(camera.viewH / 2 + 1)
        break
      }
    }
    const speed = Math.hypot(camera.vx, camera.vy) * 1000
    // Either still drifting at least at the minimum speed, or stopped by the top edge of the world.
    if (camera.y > camera.viewH / 2 + 1) expect(speed).toBeGreaterThanOrEqual(config.CIELO_MIN_SPEED - 1e-6)
    physics.touchStart(t)
    expect(camera.vx).toBe(0)
    expect(camera.vy).toBe(0)
  })

  it('Tierra and the regions above Mar have no current', () => {
    for (const id of ['tierra', 'cordillera', 'cielo'] as const) {
      const { camera, physics } = inRegion(id)
      expect(physics.currentSpeed(0, camera.y)).toBe(0)
    }
  })
})
