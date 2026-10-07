// A fake engine context to drive recognizers deterministically.
import type { RecognizerContext, Sample } from '../../src/gestures/types'

export interface FakeContext extends RecognizerContext {
  commits: number
  snaps: number
  _progress: number
  _pointerDown: boolean
  _keyboardUser: boolean
  width: number
  height: number
}

export function fakeContext(width = 390, height = 844): FakeContext {
  const ctx: FakeContext = {
    width,
    height,
    commits: 0,
    snaps: 0,
    _progress: 0,
    _pointerDown: false,
    _keyboardUser: false,
    overlay: null,
    reducedMotion: false,
    get progress() {
      return this._progress
    },
    get settling() {
      return false
    },
    get pointerDown() {
      return this._pointerDown
    },
    get keyboardUser() {
      return this._keyboardUser
    },
    setProgress(p: number) {
      this._progress = Math.max(0, Math.min(1, p))
    },
    commit() {
      this.commits += 1
      this._progress = 0
    },
    snapBack() {
      this.snaps += 1
      this._progress = 0
    },
  }
  return ctx
}

export function s(x: number, y: number, t: number): Sample {
  return { x, y, t }
}
