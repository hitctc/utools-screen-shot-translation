import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const scriptSource = fs.readFileSync(
  path.resolve('public/dev-entry-fallback.js'),
  'utf8',
)

function runFallbackScript({ search = '', fetchImpl } = {}) {
  const nodes = new Map()
  const documentStub = {
    documentElement: {
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value
      },
    },
    getElementById(id) {
      return nodes.get(id) || null
    },
  }

  nodes.set('dev-entry-status', { textContent: '' })
  nodes.set('dev-entry-link', { href: '', textContent: '' })

  const locationStub = {
    search,
    replacedTo: '',
    replace(url) {
      this.replacedTo = url
    },
  }

  const context = {
    window: {
      location: locationStub,
    },
    document: documentStub,
    URLSearchParams,
    fetch: fetchImpl,
    console,
    setTimeout,
    clearTimeout,
  }
  context.window.window = context.window
  context.window.document = documentStub
  context.window.fetch = fetchImpl
  context.window.URLSearchParams = URLSearchParams

  vm.runInNewContext(scriptSource, context)

  return {
    api: context.window.__SCREEN_TRANSLATION_DEV_ENTRY__,
    documentStub,
    locationStub,
    statusNode: nodes.get('dev-entry-status'),
    linkNode: nodes.get('dev-entry-link'),
  }
}

test('dev entry fallback keeps the default dev server url when query is empty', () => {
  const result = runFallbackScript({
    fetchImpl: async () => ({ ok: true }),
  })

  assert.equal(
    result.api.resolveDevEntryUrl({ search: '' }),
    'http://127.0.0.1:5173/index.html',
  )
})

test('dev entry fallback accepts a devMain query override', () => {
  const result = runFallbackScript({
    search: '?devMain=http%3A%2F%2Flocalhost%3A3000%2Findex.html',
    fetchImpl: async () => ({ ok: true }),
  })

  assert.equal(
    result.api.resolveDevEntryUrl(result.locationStub),
    'http://localhost:3000/index.html',
  )
})

test('dev entry fallback shows a visible hint when the dev server is unavailable', async () => {
  const result = runFallbackScript({
    fetchImpl: async () => {
      throw new Error('connect refused')
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(
    result.documentStub.documentElement.attributes['data-dev-fallback-ready'],
    'true',
  )
  assert.match(result.statusNode.textContent, /开发服务器没有响应/)
  assert.equal(result.linkNode.href, 'http://127.0.0.1:5173/index.html')
})
