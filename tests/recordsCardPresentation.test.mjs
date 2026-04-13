import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const appJsPath = path.resolve('public/app.js')
const appCssPath = path.resolve('public/app.css')
const appJsSource = fs.readFileSync(appJsPath, 'utf8')
const appCssSource = fs.readFileSync(appCssPath, 'utf8')

test('records card uses preview action on image and keeps delete/repeg as overlay text actions', () => {
  assert.match(appJsSource, /class="record-card__preview"[\s\S]*?data-action="preview-record"/)
  assert.match(appJsSource, /class="record-card__overlay-actions"/)
  assert.match(appJsSource, /data-action="delete-record"[\s\S]*?>\s*删除\s*</)
  assert.match(appJsSource, /data-action="repeg-record"[\s\S]*?>\s*重钉图\s*</)
  assert.doesNotMatch(appJsSource, /<div class="record-card__actions">/)
})

test('records page includes an in-page preview modal with close controls', () => {
  assert.match(appJsSource, /class="record-preview-modal/)
  assert.match(appJsSource, /id="record-preview-close"/)
  assert.match(appJsSource, /data-action="close-record-preview"/)
  assert.match(appCssSource, /\.record-preview-modal/)
  assert.match(appCssSource, /\.record-preview-modal__close[\s\S]*border: 1px solid var\(--border-strong\)/)
  assert.match(appCssSource, /\.record-preview-modal__close[\s\S]*border-radius: 999px/)
})

test('records thumbnails and preview modal use a checkerboard background when the image does not fill the media area', () => {
  assert.match(appCssSource, /--preview-checker-light:/)
  assert.match(appCssSource, /--preview-checker-dark:/)
  assert.match(appCssSource, /\.record-card__preview[\s\S]*background-color: var\(--preview-checker-light\)/)
  assert.match(appCssSource, /\.record-card__preview[\s\S]*background-image: conic-gradient\(/)
  assert.match(appCssSource, /\.record-card__preview[\s\S]*background-size: 20px 20px/)
  assert.match(appCssSource, /\.record-card__preview[\s\S]*background-position: 0 0;/)
  assert.match(appCssSource, /\.record-preview-modal__media[\s\S]*background-color: var\(--preview-checker-light\)/)
  assert.match(appCssSource, /\.record-preview-modal__media[\s\S]*background-image: conic-gradient\(/)
  assert.match(appCssSource, /\.record-preview-modal__media[\s\S]*background-size: 20px 20px/)
  assert.match(appCssSource, /\.record-preview-modal__media[\s\S]*background-position: 0 0;/)
})

test('records refresh keeps scroll position during in-page actions like repeg', () => {
  assert.match(appJsSource, /function captureRecordsScrollTop\(/)
  assert.match(appJsSource, /function restoreRecordsScrollTop\(/)
  assert.match(appJsSource, /async function refreshRecords\(options = \{\}\)/)
  assert.match(appJsSource, /const preservedScrollTop = preserveScroll \? captureRecordsScrollTop\(\) : 0/)
  assert.match(appJsSource, /await renderRecords\(\)\s+if \(preserveScroll\) \{\s+restoreRecordsScrollTop\(preservedScrollTop\)/)
  assert.match(appJsSource, /await refreshRecords\(\{ preserveScroll: true \}\)/)
})
