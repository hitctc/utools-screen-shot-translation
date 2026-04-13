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

test('panel.html loads the local panel state helper before the jQuery app shell', () => {
  assert.match(panelHtmlSource, /<script src="\.\/vendor\/jquery-3\.7\.1\.min\.js"><\/script>/)
  assert.match(panelHtmlSource, /<script src="\.\/panel-state\.js"><\/script>/)
  assert.match(panelHtmlSource, /<script src="\.\/app\.js"><\/script>/)
})
