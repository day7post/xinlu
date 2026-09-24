import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'

beforeEach(() => {
  window.history.replaceState({}, '', '/xinlu/')
})

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

Object.defineProperty(window, 'scrollTo', {
  value: () => undefined,
  writable: true,
})

globalThis.ResizeObserver = ResizeObserverMock
globalThis.URL.createObjectURL = () => 'blob:test'
globalThis.URL.revokeObjectURL = () => {}
