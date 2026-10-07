import { beforeEach, describe, expect, it, vi } from 'vitest'
import { config, resetConfig } from '../src/gestures/config'
import { Places } from '../src/world/places'
import { buildWorld } from '../src/world/world'

beforeEach(() => resetConfig())

describe('places', () => {
  it('emerge on approach, disperse when left without arriving, and only a stamped place stays', () => {
    const world = buildWorld(390, 844, 1)
    const onStamp = vi.fn()
    const places = new Places(world, { onChange: () => {}, onStamp })
    const p = world.places[0]!
    const emergeD = config.EMERGE_DISTANCE * world.short
    const far = { x: p.x + emergeD * 3, y: p.y }
    const near = { x: p.x + emergeD * 0.8, y: p.y }

    places.update(far, 16, 0, false)
    expect(places.get(p.n).state).toBe('hidden')

    places.update(near, 16, 16, false)
    expect(places.get(p.n).state).toBe('emerging')
    for (let i = 0; i < 100; i++) places.update(near, 16, 32 + i * 16, false)
    expect(places.get(p.n).state).toBe('present')
    expect(places.get(p.n).reveal).toBe(1)
    expect(onStamp).not.toHaveBeenCalled()

    places.update(far, 16, 2000, false)
    expect(places.get(p.n).state).toBe('dispersing')
    for (let i = 0; i < 100; i++) places.update(far, 16, 2016 + i * 16, false)
    expect(places.get(p.n).state).toBe('hidden')
    expect(places.get(p.n).reveal).toBe(0)
    expect(places.get(p.n).found).toBe(false)
  })

  it('arrival stamps once and the place persists after leaving', () => {
    const world = buildWorld(390, 844, 1)
    const onStamp = vi.fn()
    const places = new Places(world, { onChange: () => {}, onStamp })
    const p = world.places[1]!
    const arriveD = config.ARRIVE_DISTANCE * world.short
    places.update({ x: p.x + arriveD * 0.5, y: p.y }, 16, 0, false)
    expect(places.get(p.n).found).toBe(true)
    expect(places.get(p.n).state).toBe('found')
    expect(onStamp).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 50; i++) places.update({ x: p.x + 5000, y: p.y }, 16, 16 + i * 16, false)
    expect(places.get(p.n).found).toBe(true)
    expect(places.get(p.n).reveal).toBe(1)
    expect(onStamp).toHaveBeenCalledTimes(1)
    expect(places.found()).toEqual(new Set([p.n]))
  })

  it('nearest unfound ignores stamped places', () => {
    const world = buildWorld(390, 844, 1)
    const places = new Places(world, { onChange: () => {}, onStamp: () => {} })
    const p = world.places[0]!
    expect(places.nearestUnfound({ x: p.x, y: p.y })).toEqual({ x: p.x, y: p.y })
    places.arrive(p.n, 0)
    const next = places.nearestUnfound({ x: p.x, y: p.y })
    expect(next).not.toEqual({ x: p.x, y: p.y })
  })
})
