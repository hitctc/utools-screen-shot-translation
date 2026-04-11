import test from 'node:test'
import assert from 'node:assert/strict'

import { installRuntimeDiagnostics, renderRuntimeDiagnostic } from '../src/runtimeDiagnostics.js'

test('renderRuntimeDiagnostic appends a visible runtime panel with context and message', () => {
  const appendedNodes = []
  const body = {
    appendChild(node) {
      appendedNodes.push(node)
    },
  }
  const documentStub = {
    body,
    createElement() {
      return {
        attributes: {},
        textContent: '',
        setAttribute(name, value) {
          this.attributes[name] = value
        },
      }
    },
    getElementById() {
      return null
    },
  }

  const panel = renderRuntimeDiagnostic(documentStub, new Error('boom'), 'app-mount')

  assert.equal(appendedNodes.length, 1)
  assert.equal(panel, appendedNodes[0])
  assert.match(panel.textContent, /context: app-mount/)
  assert.match(panel.textContent, /Error: boom/)
})

test('installRuntimeDiagnostics wires both window error channels to the renderer', () => {
  const listeners = new Map()
  const documentStub = {
    body: {
      appendChild() {},
    },
    createElement() {
      return {
        textContent: '',
        setAttribute() {},
      }
    },
    getElementById() {
      return null
    },
  }
  const windowStub = {
    addEventListener(name, handler) {
      listeners.set(name, handler)
    },
    removeEventListener(name) {
      listeners.delete(name)
    },
  }

  const detach = installRuntimeDiagnostics(windowStub, documentStub)

  assert.equal(typeof listeners.get('error'), 'function')
  assert.equal(typeof listeners.get('unhandledrejection'), 'function')

  detach()

  assert.equal(listeners.size, 0)
})
