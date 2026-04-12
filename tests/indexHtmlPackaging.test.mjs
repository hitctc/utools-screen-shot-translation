import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const indexHtmlSource = fs.readFileSync(path.resolve('index.html'), 'utf8')

test('index.html does not reference remote js or css resources', () => {
  assert.doesNotMatch(indexHtmlSource, /https:\/\/fonts\.googleapis\.com/i)
  assert.doesNotMatch(indexHtmlSource, /https:\/\/fonts\.gstatic\.com/i)
  assert.doesNotMatch(indexHtmlSource, /<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*rel=["']stylesheet["']/i)
  assert.doesNotMatch(indexHtmlSource, /<script[^>]+src=["']https?:\/\/[^"']+["']/i)
})
