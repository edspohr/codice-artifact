import { beforeEach, describe, expect, it } from 'vitest'
import { config, resetConfig, setConfig } from '../src/gestures/config'
import { Camera } from '../src/world/camera'
import { MarPhysics } from '../src/world/physics'
import type { Hold } from '../src/world/holds'
import { regionScale } from '../src/world/scale'
import { buildWorld } from '../src/world/world'
import { windAt } from '../src/world/wind'

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

  /** A Cordillera hold off any ledge, with the camera placed so the hold sits at a screen point. */
  function offLedgeHold(world: ReturnType<typeof buildWorld>, camera: Camera, physics: MarPhysics, screen = { x: 200, y: 300 }) {
    for (const h of world.holds) {
      camera.x = h.x - (screen.x - camera.viewW / 2) / camera.scale
      camera.y = h.y - (screen.y - camera.viewH / 2) / camera.scale
      camera.clamp()
      const at = camera.toScreen(h.x, h.y)
      if (Math.hypot(at.x - screen.x, at.y - screen.y) > 2) continue
      if (physics.onLedge()) continue
      // Room above for a full pull.
      if (camera.y - camera.worldH < world.regions.find((r) => r.id === 'cordillera')!.rect.y) continue
      return h
    }
    throw new Error('no hold off a ledge')
  }

  it('Cordillera: a hold grips, the world follows the finger with weight; bare rock barely gives', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('CORDILLERA_GRIP_LAG_MS', 0)
    const { world, camera, physics } = inRegion('cordillera')
    expect(world.holds.length).toBeGreaterThan(20)
    const h = offLedgeHold(world, camera, physics)
    physics.secure()
    physics.touchStart(0, 200, 300)
    expect(physics.holding).toBe(h)
    const y0 = camera.y
    physics.drag(200, 340, 0, 40, 16, 16) // pull the hold down: you rise
    expect(y0 - camera.y).toBeCloseTo(40 / camera.scale, 0)
    physics.touchEnd(32)
    // Let go of a hold: you hang where it left you.
    const hung = camera.y
    for (let t = 48; t < 600; t += 16) physics.step(16, t, null)
    expect(camera.y).toBeCloseTo(hung, 0)
    // Bare rock: a touch away from any hold slides.
    let bare = { x: 0, y: 0 }
    search: for (let sy = 40; sy < 800; sy += 20) {
      for (let sx = 40; sx < 360; sx += 20) {
        const p = camera.toWorld(sx, sy)
        if (world.holds.every((x) => Math.hypot(x.x - p.x, x.y - p.y) > (config.CORDILLERA_GRIP_RADIUS * world.short * 2) / camera.scale)) {
          bare = { x: sx, y: sy }
          break search
        }
      }
    }
    physics.touchStart(1000, bare.x, bare.y)
    expect(physics.holding).toBeNull()
    const y1 = camera.y
    physics.drag(bare.x, bare.y + 40, 0, 40, 16, 1016)
    expect(y1 - camera.y).toBeCloseTo((40 * config.CORDILLERA_TRACTION) / camera.scale, 0)
  })

  it('Cordillera: off a hold you slip back to the last one; grabbing the rock catches the slide', () => {
    setConfig('MAR_LAG_MS', 0)
    const { world, camera, physics } = inRegion('cordillera')
    offLedgeHold(world, camera, physics)
    physics.secure()
    const anchor = camera.y
    physics.touchStart(0, 5, 5)
    physics.drag(5, 85, 0, 80, 16, 16)
    expect(camera.y).toBeLessThan(anchor - 5)
    physics.touchEnd(32)
    expect(physics.slipping).toBe('slide')
    for (let t = 48; t < 2000; t += 16) physics.step(16, t, null)
    expect(camera.y).toBeCloseTo(anchor, 0)
    expect(physics.slipping).toBeNull()
  })

  it('Cordillera: one pull reaches only so far; beyond, the rock barely gives', () => {
    setConfig('MAR_LAG_MS', 0)
    setConfig('CORDILLERA_GRIP_LAG_MS', 0)
    const { world, camera, physics } = inRegion('cordillera')
    offLedgeHold(world, camera, physics, { x: 200, y: 120 })
    physics.secure()
    physics.touchStart(0, 200, 120)
    expect(physics.holding).not.toBeNull()
    const y0 = camera.y
    let t = 0
    for (let i = 0; i < 40; i++) {
      t += 16
      physics.drag(200, 120 + i * 20, 0, 20, 16, t)
    }
    const rise = y0 - camera.y
    expect(rise).toBeGreaterThan(config.CORDILLERA_REACH_SCREENS * camera.worldH * 0.95)
    expect(rise).toBeLessThan(config.CORDILLERA_REACH_SCREENS * camera.worldH * 1.6)
  })

  it('Cordillera: hanging and lifting wear the grip; spent, you slip down to the last ledge; a ledge recovers it', () => {
    const { world, camera, physics } = inRegion('cordillera')
    // Stand on a ledge (a place), then hang from a hold above it.
    const place = world.places.find((p) => p.region === 'cordillera')!
    camera.x = place.x
    camera.y = place.y
    camera.clamp()
    physics.secure()
    expect(physics.onLedge()).toBe(true)
    const ledge = { x: camera.x, y: camera.y }
    camera.y -= camera.worldH * 0.7
    camera.clamp()
    physics.secure()
    expect(physics.onLedge()).toBe(false)
    physics.grip = 0.5
    let t = 0
    let fell = false
    for (let i = 0; i < 20_000 && !fell; i++) {
      t += 16
      physics.step(16, t, null)
      if (physics.slipping === 'fall') fell = true
    }
    expect(fell).toBe(true)
    for (let i = 0; i < 200; i++) {
      t += 16
      physics.step(16, t, null)
    }
    expect(Math.hypot(camera.x - ledge.x, camera.y - ledge.y)).toBeLessThan(2)
    const g = physics.grip
    for (let i = 0; i < 200; i++) {
      t += 16
      physics.step(16, t, null)
    }
    expect(physics.grip).toBeGreaterThan(g)
  })

  it('Cordillera: holds form routes from the entry to the threshold, and every place is within reach of one', () => {
    for (const [w, h] of [
      [390, 844],
      [360, 740],
      [1280, 800],
    ] as const) {
      for (const cycle of [1, 2, 5, 9]) {
        const world = buildWorld(w, h, cycle)
        const s = regionScale('cordillera')
        const vw = w / s
        const vh = h / s
        const rect = world.regions.find((r) => r.id === 'cordillera')!.rect
        // Two holds connect if both fit on screen while hanging from the lower one.
        const linked = (a: Hold, b: Hold) => Math.abs(a.y - b.y) <= vh * 0.5 && Math.abs(a.x - b.x) <= vw * 0.8
        const start = world.holds.filter((x) => x.y > rect.y + rect.h - vh * 0.6)
        expect(start.length, `${w}x${h} cycle ${cycle}`).toBeGreaterThan(0)
        const seen = new Set<Hold>(start)
        const queue = [...start]
        while (queue.length) {
          const a = queue.shift()!
          for (const b of world.holds) if (!seen.has(b) && linked(a, b)) {
            seen.add(b)
            queue.push(b)
          }
        }
        expect([...seen].some((x) => x.y < rect.y + vh * 0.3), `${w}x${h} cycle ${cycle}: a route to the top`).toBe(true)
        for (const p of world.places.filter((x) => x.region === 'cordillera')) {
          expect([...seen].some((x) => Math.abs(x.y - p.y) <= vh * 0.5 && Math.abs(x.x - p.x) <= vw * 0.8), `place ${p.n}`).toBe(true)
        }
      }
    }
  })

  it('Cielo: the main air carries a still visitor past every place to the exit', () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 800],
    ] as const) {
      for (const cycle of [1, 2, 5]) {
        const world = buildWorld(w, h, cycle)
        const camera = new Camera(world)
        camera.setViewport(w, h)
        const physics = new MarPhysics(world, camera)
        const rect = world.regions.find((r) => r.id === 'cielo')!.rect
        camera.x = rect.x + rect.w / 2
        camera.y = rect.y + rect.h - (h / regionScale('cielo')) * 0.15
        camera.clamp()
        const cielo = world.places.filter((p) => p.region === 'cielo')
        const closest = new Map<number, number>()
        let t = 0
        for (let i = 0; i < 60 * 60 * 4; i++) {
          t += 16
          physics.step(16, t, null)
          for (const p of cielo) closest.set(p.n, Math.min(closest.get(p.n) ?? Infinity, Math.hypot(p.x - camera.x, p.y - camera.y)))
          if ((closest.get(22) ?? Infinity) < (config.ARRIVE_DISTANCE * world.short) / camera.scale) break
        }
        for (const p of cielo) {
          const limit = ((p.n === 22 ? config.ARRIVE_DISTANCE : config.EMERGE_DISTANCE) * world.short) / regionScale('cielo')
          expect(closest.get(p.n)!, `${w}x${h} cycle ${cycle}: place ${p.n}`).toBeLessThan(limit)
          // Beside the text, not through it: the visitor arrives with a small drag of their own.
          if (p.n !== 22) expect(closest.get(p.n)!, `${w}x${h} cycle ${cycle}: beside ${p.n}`).toBeGreaterThan((config.ARRIVE_DISTANCE * world.short) / regionScale('cielo'))
        }
      }
    }
  })

  it('Cielo: little traction; a flick sustains a drift that slows to a minimum and only a touch stops; outside the air, stillness', () => {
    setConfig('MAR_LAG_MS', 0)
    const { world, camera, physics } = inRegion('cielo')
    // Find still air.
    const rect = world.regions.find((r) => r.id === 'cielo')!.rect
    let found = false
    for (let fy = 0.3; fy < 0.9 && !found; fy += 0.05) {
      for (let fx = 0.05; fx < 0.95 && !found; fx += 0.05) {
        camera.x = rect.x + rect.w * fx
        camera.y = rect.y + rect.h * fy
        camera.clamp()
        const w = windAt(world.wind, camera.x, camera.y)
        if (Math.hypot(w.x, w.y) < 0.0005) found = true
      }
    }
    expect(found).toBe(true)
    const still = { x: camera.x, y: camera.y }
    for (let t = 0; t < 1000; t += 16) physics.step(16, t, null)
    expect(Math.hypot(camera.x - still.x, camera.y - still.y)).toBeLessThan(2)
    physics.touchStart(2000)
    const x0 = camera.x
    // Drag toward the open sky (the world moves against the finger).
    const fdx = camera.x < rect.x + rect.w / 2 ? -40 : 40
    physics.drag(200, 400, fdx, 0, 16, 2016)
    expect(Math.abs(camera.x - x0)).toBeCloseTo((40 * config.CIELO_TRACTION) / camera.scale, 3)
    physics.drag(200, 400, 0, 30, 16, 2032)
    physics.touchEnd(2048)
    let t = 2048
    for (let i = 0; i < 2000; i++) {
      t += 16
      if (!physics.step(16, t, null)) break
    }
    const speed = Math.hypot(camera.vx, camera.vy) * 1000
    // Either still drifting at least at the minimum speed, or stopped by the edge of the sky.
    const atEdge = camera.y <= camera.worldH / 2 + 1
    if (!atEdge) expect(speed).toBeGreaterThanOrEqual(config.CIELO_MIN_SPEED - 1e-6)
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
