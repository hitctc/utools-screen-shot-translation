import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const panelCssPath = path.resolve('public/app.css')
const panelCssSource = fs.readFileSync(panelCssPath, 'utf8')

function stripCssLiterals(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
}

test('app.css keeps balanced rule braces', () => {
  const sanitizedSource = stripCssLiterals(panelCssSource)
  let balance = 0

  for (const character of sanitizedSource) {
    if (character === '{') {
      balance += 1
      continue
    }

    if (character === '}') {
      balance -= 1
    }

    assert.ok(balance >= 0, 'CSS 在某处提前出现了多余的右花括号')
  }

  assert.equal(balance, 0, 'CSS 存在未闭合的规则块，可能导致后续样式整体失效')
})
