# Pin Window Shadow Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让钉住窗口改为依赖系统窗口阴影表达悬浮感，并移除图片层和容器层的圆角、描边与自定义阴影，保持截图内容原样显示。

**Architecture:** `public/preload/pinWindowManager.cjs` 负责把 pin window 的原生窗口参数切到“系统阴影优先”，不改变重钉、拖拽和记录持久化逻辑。`public/pin-window.html` 只保留最小渲染结构，让图片直接显示原图，不再承担装饰性视觉；测试分别覆盖样式约束和 pin manager 行为不回归。

**Tech Stack:** uTools `createBrowserWindow`, Electron-style BrowserWindow options, plain HTML/CSS, Node built-in `node:test`

---

### Task 1: Reset Pin Window Markup To Minimal Presentation

**Files:**
- Modify: `public/pin-window.html`
- Test: `tests/pinWindowHtml.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('pin window keeps the screenshot image undecorated', () => {
  const html = fs.readFileSync(path.resolve('public/pin-window.html'), 'utf8')

  assert.match(html, /#image\s*\{/)
  assert.doesNotMatch(html, /border-radius:\s*16px;/)
  assert.doesNotMatch(html, /box-shadow:/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pinWindowHtml.test.mjs`
Expected: FAIL because `public/pin-window.html` still contains `border-radius: 16px;` and `box-shadow`.

- [ ] **Step 3: Write minimal implementation**

```html
<style>
  html,
  body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    user-select: none;
  }

  #root {
    width: 100%;
    height: 100%;
    cursor: move;
  }

  #image {
    width: 100%;
    height: 100%;
    object-fit: fill;
    display: block;
    pointer-events: none;
  }
</style>
```

- [ ] **Step 4: Update the static test to match the new contract**

```js
test('pin window keeps the screenshot image undecorated', () => {
  const html = fs.readFileSync(path.resolve('public/pin-window.html'), 'utf8')

  assert.match(html, /#image\s*\{/)
  assert.doesNotMatch(html, /border-radius:/)
  assert.doesNotMatch(html, /box-shadow:/)
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/pinWindowHtml.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/pin-window.html tests/pinWindowHtml.test.mjs
git commit -m "style: 调整钉住窗口图片展示策略"
```

### Task 2: Enable Native Window Shadow For Pin Windows

**Files:**
- Modify: `public/preload/pinWindowManager.cjs:201-222`
- Test: `tests/preload/pinWindowManager.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('pinTranslatedImage creates the pin window with native window shadow enabled', async () => {
  const { pinTranslatedImage } = loadPinWindowManager()
  let capturedOptions = null
  const utools = {
    createBrowserWindow: (_url, options, callback) => {
      capturedOptions = options
      queueMicrotask(() => callback?.())
      return {
        id: 1002,
        webContents: {
          executeJavaScript: async () => true,
        },
        isDestroyed: () => false,
      }
    },
  }
  const electron = {
    ipcRenderer: {
      on: () => {},
      off: () => {},
    },
  }

  const result = await pinTranslatedImage({
    utools,
    electron,
    imageSrc: 'data:image/png;base64,abc123',
    bounds: { x: 10, y: 20, width: 120, height: 90 },
  })

  assert.equal(result.ok, true)
  assert.equal(capturedOptions.hasShadow, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/preload/pinWindowManager.test.mjs`
Expected: FAIL because `capturedOptions.hasShadow` is currently `undefined`.

- [ ] **Step 3: Write minimal implementation**

```js
pinWindow = runtime.createBrowserWindow(
  resolveAssetUrl('pin-window.html'),
  {
    x: normalizedBounds.x,
    y: normalizedBounds.y,
    width: normalizedBounds.width,
    height: normalizedBounds.height,
    frame: false,
    resizable: false,
    movable: false,
    closable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    transparent: true,
    show: true,
    webPreferences: {
      zoomFactor: 1,
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true,
    },
  },
```

- [ ] **Step 4: Keep the existing already-pinned focus test green**

Run: `node --test tests/preload/pinWindowManager.test.mjs`
Expected: PASS for both:
- `pinTranslatedImage creates the pin window with native window shadow enabled`
- `repinSavedRecordImage restores and focuses an already pinned window`

- [ ] **Step 5: Commit**

```bash
git add public/preload/pinWindowManager.cjs tests/preload/pinWindowManager.test.mjs
git commit -m "style: 启用钉住窗口原生阴影"
```

### Task 3: Run Full Verification For The Pin Window Visual Strategy

**Files:**
- Verify only: `public/pin-window.html`
- Verify only: `public/preload/pinWindowManager.cjs`
- Verify only: `tests/pinWindowHtml.test.mjs`
- Verify only: `tests/preload/pinWindowManager.test.mjs`

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/pinWindowHtml.test.mjs tests/preload/pinWindowManager.test.mjs`
Expected: PASS

- [ ] **Step 2: Run full project tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS and emit `dist/index.html`, `dist/assets/*`, `dist/preload/*`

- [ ] **Step 4: Manual smoke checklist**

```text
1. 重新接入 uTools 开发插件并打开“截屏翻译钉住”生成一张钉住图。
2. 观察钉住图内容边缘，确认没有被圆角裁切。
3. 观察桌面背景，确认通过系统窗口阴影能看出图片钉住位置。
4. 从“钉住记录”点击“重新钉住”，确认已钉住窗口仍能被唤回前台。
```

- [ ] **Step 5: Commit**

```bash
git add public/pin-window.html public/preload/pinWindowManager.cjs tests/pinWindowHtml.test.mjs tests/preload/pinWindowManager.test.mjs
git commit -m "test: 验证钉住窗口阴影策略"
```
