# 截屏翻译主流程重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `截屏 -> 翻译 -> 钉图 -> 保存` 主流程重写成一条清晰、单一路径、低耦合的业务链，截图统一改回 `utools.screenCapture(callback)`，默认钉图改为屏幕右上角。

**Architecture:** 保留记录页、设置页、结果页与现有配置模型，只重写主流程业务实现。`App.vue` 只负责触发 `runCaptureTranslationPin()` 和承载失败结果；`workflow.cjs` 只负责编排截图、翻译、钉图、保存四步；`services.js` 只做桥接与最小窗口生命周期控制；主路径不再依赖自定义截图 overlay。

**Tech Stack:** Vue 3、Vite 6、uTools API、CommonJS preload、Node `node:test`

---

## 文件结构与职责锁定

**保留并修改：**
- `public/preload/services.js`
  负责暴露 `runCaptureTranslationPin()`，并提供最小窗口生命周期控制。
- `public/preload/workflow.cjs`
  负责主流程四步编排，不承担 UI 逻辑。
- `public/preload/baiduPictureTranslate.cjs`
  负责百度图片翻译 `V2` 调用与“最终可展示图片”返回。
- `public/preload/pinWindowManager.cjs`
  负责默认右上角钉图、拖动、关闭和重钉位置回写。
- `src/App.vue`
  负责 `run` 入口触发主流程、失败结果页承载和记录/设置页面切换。
- `tests/preload/localState.test.mjs`
  补桥接契约变化测试。
- `tests/preload/workflow.test.mjs`
  重写主流程编排测试。
- `tests/preload/baiduPictureTranslate.test.mjs`
  收口为纯 `V2` 主路径测试。
- `tests/preload/pinWindowManager.test.mjs`
  补默认右上角钉图测试。

**保留但退出主路径：**
- `public/preload/customCapture.cjs`
  不再被主流程调用。
- `public/preload/baiduPictureCompose.cjs`
  如仍存在，仅作为翻译模块内部细节，不能参与截图或窗口控制。

**文档需要同步：**
- `AGENTS.md`
- `README.md`

---

### Task 1: 用失败测试锁定新的主流程契约

**Files:**
- Modify: `tests/preload/workflow.test.mjs`
- Modify: `tests/preload/localState.test.mjs`
- Modify: `tests/preload/pinWindowManager.test.mjs`

- [ ] **Step 1: 写主流程编排失败测试，明确 capture 只走官方 screenCapture**

```js
test('runMainWorkflow uses official screenCapture capture result and never requests custom bounds', async () => {
  const events = []

  const result = await runMainWorkflow({
    settings: { saveTranslatedImage: false },
    captureImage: async () => {
      events.push('capture')
      return { ok: true, image: 'data:image/png;base64,captured' }
    },
    translateImage: async (captureResult) => {
      events.push(['translate', captureResult.image])
      return { ok: true, translatedImageDataUrl: 'data:image/png;base64,translated' }
    },
    pinImage: async (_translationResult) => {
      events.push('pin')
      return { ok: true, bounds: { x: 100, y: 24, width: 240, height: 120 } }
    },
    saveImage: async () => {
      events.push('save')
      return { ok: true }
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(events, [
    'capture',
    ['translate', 'data:image/png;base64,captured'],
    'pin',
    'save',
  ])
})
```

- [ ] **Step 2: 写 bridge 契约测试，明确 `runCaptureTranslationPin()` 不再依赖 `customCapture.cjs`**

```js
test('runCaptureTranslationPin captures via utools.screenCapture bridge and not custom overlay', async () => {
  let usedOfficialCapture = false

  global.window = {
    utools: {
      screenCapture(callback) {
        usedOfficialCapture = true
        callback('data:image/png;base64,captured')
      },
      dbStorage: fakeDbStorage(),
      db: fakeDb(),
    },
  }

  const services = require('../../public/preload/services.js')
  const result = await services.runCaptureTranslationPin()

  assert.equal(usedOfficialCapture, true)
  assert.equal(typeof result.ok, 'boolean')
})
```

- [ ] **Step 3: 写钉图默认位置测试，明确新窗口默认右上角**

```js
test('pinTranslatedImage defaults to top-right when no historical bounds exist', async () => {
  const openCalls = []
  const result = await pinTranslatedImage({
    utools: {
      getCursorScreenPoint: () => ({ x: 10, y: 10 }),
      getDisplayNearestPoint: () => ({
        bounds: { x: 0, y: 0, width: 1440, height: 900 },
      }),
      createBrowserWindow(_url, options) {
        openCalls.push(options)
        return fakePinWindow()
      },
    },
    imageSrc: 'data:image/png;base64,translated',
    bounds: null,
    persistRecordPinState: async () => null,
  })

  assert.equal(result.ok, true)
  assert.equal(openCalls[0].y, 24)
})
```

- [ ] **Step 4: 运行相关测试，确认当前实现先失败**

Run:
```bash
node --test tests/preload/workflow.test.mjs tests/preload/localState.test.mjs tests/preload/pinWindowManager.test.mjs
```

Expected:
- 至少有 1 条失败
- 失败点应集中在仍走自定义截图、仍依赖旧 pin 位置逻辑

---

### Task 2: 重写 services 主路径，切回官方 screenCapture

**Files:**
- Modify: `public/preload/services.js`
- Test: `tests/preload/localState.test.mjs`

- [ ] **Step 1: 写最小截图桥接实现，只包一层 Promise**

```js
function captureImageViaOfficialApi(runtime = window.utools) {
  return new Promise((resolve) => {
    if (typeof runtime?.screenCapture !== 'function') {
      resolve({ ok: false, code: 'capture-cancelled' })
      return
    }

    runtime.screenCapture((image) => {
      const nextImage = typeof image === 'string' ? image.trim() : ''

      if (!nextImage.startsWith('data:image/')) {
        resolve({ ok: false, code: 'capture-cancelled' })
        return
      }

      resolve({ ok: true, image: nextImage })
    })
  })
}
```

- [ ] **Step 2: 在 `runCaptureTranslationPin()` 里替换掉 `customCapture.cjs` 主路径**

```js
function runCaptureTranslationPin() {
  const settings = getPluginSettings()
  const credentials = readTranslationCredentials()
  const persistRecordPinState = createPersistPinnedRecordBounds(settings)

  return runMainWorkflow({
    settings,
    captureImage: async () => captureImageViaOfficialApi(window.utools),
    translateImage: async (captureResult) =>
      translateCapturedImage({ captureResult, settings, credentials }),
    pinImage: async (translationResult) =>
      pinTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult?.translatedImageDataUrl,
        bounds: null,
        persistRecordPinState,
      }),
    saveImage: async (translationResult, pinResult) => {
      // 复用现有 recordStore 保存逻辑
    },
  })
}
```

- [ ] **Step 3: 删掉主路径里与自定义截图相关的显式依赖**

```js
// remove
const { captureImageWithCustomOverlay } = require('./customCapture.cjs')

// keep customCapture.cjs on disk, but do not call it from runCaptureTranslationPin()
```

- [ ] **Step 4: 运行 bridge 相关测试，确认只剩官方截图路径**

Run:
```bash
node --test tests/preload/localState.test.mjs
```

Expected:
- PASS
- `runCaptureTranslationPin()` 的 capture 契约不再依赖 overlay bounds

- [ ] **Step 5: Commit**

```bash
git add public/preload/services.js tests/preload/localState.test.mjs tests/preload/workflow.test.mjs tests/preload/pinWindowManager.test.mjs
git commit -m "refactor: 重写主流程截图入口"
```

---

### Task 3: 收薄 workflow，只保留四步顺序编排

**Files:**
- Modify: `public/preload/workflow.cjs`
- Test: `tests/preload/workflow.test.mjs`

- [ ] **Step 1: 写最小主流程实现，明确四步顺序和失败码**

```js
async function runMainWorkflow({
  settings,
  captureImage,
  translateImage,
  pinImage,
  saveImage,
}) {
  const captureResult = await captureImage()
  if (!captureResult?.ok) return captureResult

  const translationResult = await translateImage(captureResult)
  if (!translationResult?.ok) return translationResult

  const pinResult = await pinImage(translationResult, captureResult)
  if (!pinResult?.ok) return pinResult

  if (!settings?.saveTranslatedImage || !settings?.saveDirectory) {
    return { ok: true, code: 'workflow-completed', pinResult }
  }

  const saveResult = await saveImage(translationResult, pinResult)
  if (!saveResult?.ok) return saveResult

  return { ok: true, code: 'workflow-completed', pinResult, saveResult }
}
```

- [ ] **Step 2: 删掉 workflow 里和旧链路耦合的额外分支**

```js
// remove patterns like:
// - custom capture specific bounds assumptions
// - window lifecycle side effects
// - compose-specific branching
// - duplicated translation fallback control
```

- [ ] **Step 3: 用测试覆盖新的失败面**

```js
test('runMainWorkflow returns translation-failed when translateImage fails', async () => {
  const result = await runMainWorkflow({
    settings: {},
    captureImage: async () => ({ ok: true, image: 'data:image/png;base64,a' }),
    translateImage: async () => ({ ok: false, code: 'translation-failed' }),
    pinImage: async () => ({ ok: true }),
    saveImage: async () => ({ ok: true }),
  })

  assert.deepEqual(result, { ok: false, code: 'translation-failed' })
})
```

- [ ] **Step 4: 运行 workflow 测试**

Run:
```bash
node --test tests/preload/workflow.test.mjs
```

Expected:
- PASS
- 测试只围绕四步顺序和失败码，不再依赖自定义截图细节

- [ ] **Step 5: Commit**

```bash
git add public/preload/workflow.cjs tests/preload/workflow.test.mjs
git commit -m "refactor: 收薄主流程编排逻辑"
```

---

### Task 4: 收口百度 V2 翻译模块的对外职责

**Files:**
- Modify: `public/preload/baiduPictureTranslate.cjs`
- Test: `tests/preload/baiduPictureTranslate.test.mjs`

- [ ] **Step 1: 明确翻译模块对外只返回“最终可展示图片”**

```js
async function translateCapturedImage({ captureResult, settings, credentials }) {
  if (!credentials?.appId || !credentials?.accessToken) {
    return { ok: false, code: 'translation-config-invalid' }
  }

  const image = captureResult?.image
  if (!image) {
    return { ok: false, code: 'translation-failed' }
  }

  const translatedImageDataUrl = await requestBaiduPictureTranslateV2({
    image,
    translationMode: settings?.translationMode,
    credentials,
  })

  if (!translatedImageDataUrl) {
    return { ok: false, code: 'translation-failed' }
  }

  return { ok: true, translatedImageDataUrl }
}
```

- [ ] **Step 2: 把模块内仍然穿透主流程的调试和窗口依赖移出对外返回**

```js
// keep internal request diagnostics if needed
// but public return shape remains:
// { ok: true, translatedImageDataUrl }
// or
// { ok: false, code: 'translation-failed' }
```

- [ ] **Step 3: 跑翻译模块测试**

Run:
```bash
node --test tests/preload/baiduPictureTranslate.test.mjs
```

Expected:
- PASS
- 对外契约只围绕 `translatedImageDataUrl` 和统一失败码

- [ ] **Step 4: Commit**

```bash
git add public/preload/baiduPictureTranslate.cjs tests/preload/baiduPictureTranslate.test.mjs
git commit -m "refactor: 收口百度翻译主路径返回"
```

---

### Task 5: 重写默认钉图位置规则

**Files:**
- Modify: `public/preload/pinWindowManager.cjs`
- Test: `tests/preload/pinWindowManager.test.mjs`

- [ ] **Step 1: 提供默认右上角定位函数**

```js
function resolveDefaultPinBounds({ runtime, imageSize, margin = 24 }) {
  const point =
    typeof runtime?.getCursorScreenPoint === 'function' ? runtime.getCursorScreenPoint() : { x: 0, y: 0 }
  const display =
    typeof runtime?.getDisplayNearestPoint === 'function'
      ? runtime.getDisplayNearestPoint(point)
      : { bounds: { x: 0, y: 0, width: 1440, height: 900 } }

  const displayBounds = display?.bounds || { x: 0, y: 0, width: 1440, height: 900 }
  return {
    x: displayBounds.x + displayBounds.width - imageSize.width - margin,
    y: displayBounds.y + margin,
    width: imageSize.width,
    height: imageSize.height,
  }
}
```

- [ ] **Step 2: `pinTranslatedImage()` 只在有历史位置时用历史位置，否则走默认右上角**

```js
const targetBounds = normalizedBounds || resolveDefaultPinBounds({
  runtime: utools,
  imageSize,
})
```

- [ ] **Step 3: 保持拖动、关闭、重钉位置回写不变**

```js
// do not rewrite:
// - drag sync
// - double click close
// - record attachment and persist callback
```

- [ ] **Step 4: 运行 pin window 测试**

Run:
```bash
node --test tests/preload/pinWindowManager.test.mjs
```

Expected:
- PASS
- 无历史位置时默认落到右上角

- [ ] **Step 5: Commit**

```bash
git add public/preload/pinWindowManager.cjs tests/preload/pinWindowManager.test.mjs
git commit -m "refactor: 收口默认钉图位置规则"
```

---

### Task 6: 收薄 App run 入口和结果页切换

**Files:**
- Modify: `src/App.vue`
- Test: `tests/entryFlow.test.mjs`

- [ ] **Step 1: 让 run 入口只做触发，不内嵌主流程细节**

```ts
async function runMainWorkflowEntry() {
  const services = getServices()
  const result = await services?.runCaptureTranslationPin?.()

  if (result?.ok) {
    workflowResult.value = createEmptyWorkflowResultState()
    currentView.value = 'idle'
    return
  }

  setWorkflowFailure(result?.code || 'translation-failed')
}
```

- [ ] **Step 2: 删掉 App 层与截图、自定义坐标、窗口控制耦合的旧逻辑**

```ts
// keep only:
// - run entry trigger
// - records/settings/result rendering
// - retry routing
```

- [ ] **Step 3: 运行入口相关测试**

Run:
```bash
node --test tests/entryFlow.test.mjs
```

Expected:
- PASS
- `run` 入口成功时不展示页面，失败时进入结果页

- [ ] **Step 4: Commit**

```bash
git add src/App.vue tests/entryFlow.test.mjs
git commit -m "refactor: 收口运行入口页面职责"
```

---

### Task 7: 同步协作文档并做全量验证

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: 更新文档中的当前主流程描述**

```md
- `截屏翻译钉住` 当前主路径已切回 `utools.screenCapture(callback)`
- 主流程默认钉图位置为当前屏幕右上角
- 自定义截图 overlay 已退出主路径
```

- [ ] **Step 2: 跑最相关全量验证**

Run:
```bash
npm test
npm run build
```

Expected:
- 所有测试通过
- 构建成功

- [ ] **Step 3: 手动 smoke test**

Run:
```text
1. 进入设置页，确认 AppID / Access Token 正常
2. 触发 截屏翻译钉住
3. 使用官方截图完成截图
4. 结果图默认出现在右上角
5. 拖动后关闭，再去钉住记录重钉
6. 若保存开启，确认记录页和目录同步更新
7. 若翻译失败，确认进入结果页
```

Expected:
- 主路径只围绕截图、翻译、钉图、保存四步
- 不再出现自定义截图 overlay 相关行为

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: 同步主流程重写后的运行说明"
```
