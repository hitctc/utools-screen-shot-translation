import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const panelHtmlPath = path.resolve('public/panel.html')
const indexHtmlPath = path.resolve('public/index.html')
const panelHtmlSource = fs.readFileSync(panelHtmlPath, 'utf8')

test('panel.html does not reference remote js or css resources', () => {
  assert.doesNotMatch(panelHtmlSource, /https:\/\/fonts\.googleapis\.com/i)
  assert.doesNotMatch(panelHtmlSource, /https:\/\/fonts\.gstatic\.com/i)
  assert.doesNotMatch(panelHtmlSource, /<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*rel=["']stylesheet["']/i)
  assert.doesNotMatch(panelHtmlSource, /<script[^>]+src=["']https?:\/\/[^"']/i)
})

test('public root no longer exposes index.html as a panel shell', () => {
  assert.equal(fs.existsSync(indexHtmlPath), false)
})
