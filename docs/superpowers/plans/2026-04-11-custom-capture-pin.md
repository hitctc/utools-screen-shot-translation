# Custom Capture Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feature/custom-capture-pin` 分支上实现“单屏自定义截图 -> 百度翻译 -> 原位钉住”，并让记录页支持按 `lastPinBounds` 真实重钉。

**Architecture:** 保持当前主窗口和设置/记录页稳定不动，把实验性能力集中在 `public/preload/customCapture.cjs`、`public/preload/pinWindowManager.cjs` 和两个本地 HTML 子窗口里。`services.js` 只做桥接与编排切换，`workflow.cjs` 继续负责失败归因，`recordStore.cjs` 只负责记录和位置回写。

**Tech Stack:** Vue 3, Vite 6, uTools plugin API, CommonJS preload bridge, local HTML browser windows, Node `--test`

---

## File Map

- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
  把当前稳定主线切回自定义截图与真实钉住分支链路，但不改动设置桥接和记录桥接接口名。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/workflow.cjs`
  确认 `pinImage` 和 `saveImage` 的参数传递适配真实钉住窗口与记录保存。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/customCapture.cjs`
  只支持鼠标所在屏幕的 overlay 截图，返回 `image + bounds`。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/capture-overlay.html`
  实现本地相对 HTML 的截图 overlay，不再依赖 dev server URL。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/pinWindowManager.cjs`
  创建真实钉住窗口、拖动、双击关闭、重复钉住拦截、记录位置回写。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/pin-window.html`
  实现图片渲染、拖动消息、双击关闭消息。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/recordStore.cjs`
  适配保存翻译结果时写入 `lastPinBounds`，以及重钉时读取单条记录。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/customCapture.test.mjs`
  补单屏截图与坐标返回测试。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`
  补 `services.js` 自定义截图和真实重钉的桥接测试。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/recordStore.test.mjs`
  确认位置回写和保存翻译记录契约。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/workflow.test.mjs`
  确认 `capture -> translate -> pin -> save` 参数传递与失败码不回退。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
  说明这条分支已恢复自定义截图与真实钉住。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`
  同步当前分支的截图和钉住边界、验证方式。

### Task 1: 单屏自定义截图 overlay

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/customCapture.cjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/capture-overlay.html`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/customCapture.test.mjs`

- [ ] **Step 1: 先写失败测试，约束单屏截图成功时必须返回 `image + bounds`**

```js
test('captureImageWithCustomOverlay injects the screen thumbnail into the overlay and resolves submit payload', async () => {
  const result = await captureImageWithCustomOverlay({
    utools: runtime,
    electron: { ipcRenderer },
  })

  assert.deepEqual(result, {
    ok: true,
    image: 'data:image/png;base64,overlay-result',
    bounds: { x: 120, y: 80, width: 640, height: 320 },
  })
})
```

- [ ] **Step 2: 运行局部测试，确认当前实现先失败或未完整覆盖**

Run:

```bash
node --test tests/preload/customCapture.test.mjs
```

Expected: 现有截图链路至少有一条断言失败，说明测试能约束到这次改动。

- [ ] **Step 3: 在 `customCapture.cjs` 写最小单屏截图实现**

```js
const display = normalizeDisplay(runtime.getDisplayNearestPoint(runtime.getCursorScreenPoint()))
const sources = await runtime.desktopCaptureSources({
  types: ['screen'],
  thumbnailSize: {
    width: Math.round(display.bounds.width * display.scaleFactor),
    height: Math.round(display.bounds.height * display.scaleFactor),
  },
})

captureWindow = runtime.createBrowserWindow('capture-overlay.html', { ... }, async () => {
  await captureWindow.webContents.executeJavaScript(
    `window.__SCREEN_TRANSLATION_CAPTURE_INIT__(${JSON.stringify({
      channel,
      displayBounds: display.bounds,
      imageDataUrl,
    })})`,
    true,
  )
})
```

- [ ] **Step 4: 在 `capture-overlay.html` 实现最小选区交互**

```js
window.__SCREEN_TRANSLATION_CAPTURE_INIT__ = function ({ channel, displayBounds, imageDataUrl }) {
  state.channel = channel
  state.displayBounds = displayBounds
  screenshotImage.src = imageDataUrl
}

overlay.addEventListener('mousedown', startSelection)
overlay.addEventListener('mousemove', updateSelection)
overlay.addEventListener('mouseup', finishSelection)
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    ipcRenderer.send(state.channel, { type: 'cancel' })
  }
})
```

- [ ] **Step 5: 再跑截图测试确认通过**

Run:

```bash
node --test tests/preload/customCapture.test.mjs
```

Expected: `capture-cancelled` 和 `submit payload` 两条用例通过。

- [ ] **Step 6: 提交截图 overlay**

```bash
git add public/preload/customCapture.cjs public/capture-overlay.html tests/preload/customCapture.test.mjs
git commit -m "feat: 增加单屏自定义截图选区"
```

### Task 2: 真实钉住窗口与位置回写

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/pinWindowManager.cjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/pin-window.html`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/recordStore.cjs`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/recordStore.test.mjs`

- [ ] **Step 1: 先写失败测试，约束重钉重复拦截和位置回写**

```js
test('repinSavedRecordImage returns already-pinned when the record is already active', async () => {
  const result = await repinSavedRecordImage({ utools, record, imageSrc, persistRecordPinState })
  assert.deepEqual(result, { ok: true, code: 'already-pinned' })
})
```

```js
test('updateSavedRecordPinState rewrites last pin metadata for the target record', async () => {
  const manifest = await updateSavedRecordPinState({ fs, path, settings, recordId: 'record-1', bounds })
  assert.deepEqual(manifest.records[0].lastPinBounds, bounds)
})
```

- [ ] **Step 2: 运行相关测试，确认当前位置回写链路受约束**

Run:

```bash
node --test tests/preload/recordStore.test.mjs
```

Expected: 至少新增断言尚未满足。

- [ ] **Step 3: 在 `pinWindowManager.cjs` 写最小活动窗口管理**

```js
const activePinWindowsById = new Map()
const activePinWindowIdByRecordId = new Map()

function getActiveEntryByRecordId(recordId) {
  const windowId = activePinWindowIdByRecordId.get(recordId)
  return windowId ? activePinWindowsById.get(windowId) ?? null : null
}
```

```js
async function repinSavedRecordImage({ utools, record, imageSrc, persistRecordPinState }) {
  const activeEntry = getActiveEntryByRecordId(record.id)
  if (activeEntry) {
    utools?.showNotification?.('该图片已经钉住，不能重复钉住。')
    return { ok: true, code: 'already-pinned' }
  }

  return openPinWindow({ utools, imageSrc, bounds: record.lastPinBounds, persistRecordPinState })
}
```

- [ ] **Step 4: 在 `pin-window.html` 实现拖动和双击关闭消息**

```js
window.__SCREEN_TRANSLATION_PIN_INIT__ = function ({ channel, imageSrc }) {
  state.channel = channel
  previewImage.src = imageSrc
}

window.addEventListener('dblclick', () => {
  ipcRenderer.send(state.channel, { type: 'close' })
})
```

- [ ] **Step 5: 在 `recordStore.cjs` 保持 `lastPinBounds` 更新纯函数化**

```js
async function updateSavedRecordPinState({ fs, path, settings, recordId, bounds }) {
  const manifest = await readRecordManifest({ fs, path, directoryPath })
  const nextRecords = manifest.records.map((record) =>
    record.id === recordId
      ? { ...record, lastPinBounds: normalizePinBounds(bounds), lastPinnedAt: new Date().toISOString() }
      : record,
  )

  return writeRecordManifest({ fs, path, directoryPath, manifest: { ...manifest, records: nextRecords } })
}
```

- [ ] **Step 6: 再跑记录与钉住相关测试**

Run:

```bash
node --test tests/preload/recordStore.test.mjs
```

Expected: 记录位置回写相关用例通过。

- [ ] **Step 7: 提交钉住窗口能力**

```bash
git add public/preload/pinWindowManager.cjs public/pin-window.html public/preload/recordStore.cjs tests/preload/recordStore.test.mjs
git commit -m "feat: 增加原位钉住窗口与位置回写"
```

### Task 3: 主流程接入自定义截图和真实钉住

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/workflow.cjs`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/workflow.test.mjs`

- [ ] **Step 1: 先写失败测试，约束 `services.js` 走自定义截图链路**

```js
test('runCaptureTranslationPin starts the workflow after the custom capture bridge returns an image', async () => {
  const result = await services.runCaptureTranslationPin()
  assert.deepEqual(result, { ok: false, code: 'translation-config-invalid' })
})
```

```js
test('runCaptureTranslationPin keeps capture-cancelled when the custom capture bridge is cancelled', async () => {
  const result = await services.runCaptureTranslationPin()
  assert.deepEqual(result, { ok: false, code: 'capture-cancelled' })
})
```

- [ ] **Step 2: 运行桥接和 workflow 相关测试，确认当前稳定主线与目标不一致**

Run:

```bash
node --test tests/preload/localState.test.mjs tests/preload/workflow.test.mjs
```

Expected: 至少自定义截图相关断言失败。

- [ ] **Step 3: 在 `services.js` 重新接通自定义截图和真实钉住**

```js
function runCaptureTranslationPin() {
  const settings = getPluginSettings()
  const credentials = readTranslationCredentials()
  const persistRecordPinState = createPersistPinnedRecordBounds(settings)

  return runMainWorkflow({
    settings,
    captureImage: async () =>
      customCapture.captureImageWithCustomOverlay({
        utools: window.utools,
      }),
    translateImage: async (captureResult) =>
      translateCapturedImage({ captureResult, settings, credentials }),
    pinImage: async (translationResult, captureResult) =>
      pinWindowManager.pinTranslatedImage({
        utools: window.utools,
        imageSrc: translationResult.translatedImageDataUrl,
        bounds: captureResult.bounds,
        persistRecordPinState,
      }),
    saveImage: async (translationResult, pinResult) => {
      const savedRecordResult = await recordStore.saveTranslatedRecord({
        fs,
        path,
        settings,
        translationResult,
        bounds: pinResult.bounds,
      })

      return pinWindowManager.attachPinnedRecord({
        windowId: pinResult.windowId,
        recordId: savedRecordResult.record.id,
        persistRecordPinState,
      })
    },
  })
}
```

- [ ] **Step 4: 在 `workflow.cjs` 保持参数顺序稳定**

```js
const pinResult = await runWorkflowStep(pinImage, WORKFLOW_CODES.pinFailed, translationResult, captureResult)
const saveResult = await runWorkflowStep(saveImage, WORKFLOW_CODES.saveFailed, translationResult, pinResult)
```

- [ ] **Step 5: 再跑桥接与 workflow 测试**

Run:

```bash
node --test tests/preload/localState.test.mjs tests/preload/workflow.test.mjs
```

Expected: 自定义截图、失败码和参数传递用例通过。

- [ ] **Step 6: 提交主流程接线**

```bash
git add public/preload/services.js public/preload/workflow.cjs tests/preload/localState.test.mjs tests/preload/workflow.test.mjs
git commit -m "feat: 接通自定义截图主流程与原位钉住"
```

### Task 4: 记录页真实重钉桥接

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`

- [ ] **Step 1: 先写失败测试，约束 `repinSavedRecord` 走真实记录和真实钉住**

```js
test('repinSavedRecord keeps already pinned requests on the happy path and shows a notification', async () => {
  const result = await services.repinSavedRecord('record-1')
  assert.deepEqual(result, { ok: true, code: 'already-pinned' })
})
```

- [ ] **Step 2: 运行局部测试，确认重钉桥接还没接通**

Run:

```bash
node --test tests/preload/localState.test.mjs
```

Expected: 真实重钉相关用例失败。

- [ ] **Step 3: 在 `services.js` 恢复真实重钉路径**

```js
repinSavedRecord: async (recordId) => {
  const settings = getPluginSettings()
  const record = await recordStore.getSavedRecord({ fs, path, settings, recordId })
  if (!record) {
    return { ok: false, code: 'repin-failed' }
  }

  return pinWindowManager.repinSavedRecordImage({
    utools: window.utools,
    record,
    imageSrc: toFileUrl(path.resolve(settings.saveDirectory, record.imageFilename)),
    persistRecordPinState: createPersistPinnedRecordBounds(settings),
  })
}
```

- [ ] **Step 4: 在 `App.vue` 保持成功重钉不跳结果页**

```ts
async function repinRecord(recordId: string) {
  const result = await services?.repinSavedRecord?.(recordId)
  if (!result?.ok) {
    setWorkflowFailure(result?.code ?? 'repin-failed', undefined, 'repin', recordId)
  }
}
```

- [ ] **Step 5: 再跑重钉桥接测试**

Run:

```bash
node --test tests/preload/localState.test.mjs
```

Expected: `already-pinned` 和失败闭环相关断言通过。

- [ ] **Step 6: 提交重钉桥接**

```bash
git add public/preload/services.js src/App.vue tests/preload/localState.test.mjs
git commit -m "feat: 恢复记录页真实重钉桥接"
```

### Task 5: 文档、全量验证与手动 smoke checklist

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`

- [ ] **Step 1: 更新 README，明确当前分支能力**

```md
- `截屏翻译钉住`：自定义截图单屏选区 -> 百度翻译 -> 原位钉住
- `钉住记录`：按 `lastPinBounds` 重钉
- 当前仍不支持跨屏选区
```

- [ ] **Step 2: 更新 AGENTS，明确当前分支不是稳定主线**

```md
- 当前分支：`feature/custom-capture-pin`
- 第一版自定义截图只支持鼠标所在屏幕
- 子窗口一律使用本地相对 HTML 文件
```

- [ ] **Step 3: 跑全量测试**

Run:

```bash
npm test
```

Expected: 所有 Node `--test` 用例通过。

- [ ] **Step 4: 跑构建**

Run:

```bash
npm run build
```

Expected: `dist/index.html`、`dist/plugin.json` 和 preload 产物成功生成。

- [ ] **Step 5: 做手动 smoke checklist**

在 uTools 里按下面顺序验证：

```text
1. 设置页可正常进入
2. 钉住记录页可正常进入
3. 截屏翻译钉住可打开单屏 overlay
4. Esc 取消后进入 capture-cancelled 失败闭环
5. 选区完成后，凭证缺失进入 translation-config-invalid
6. 凭证完整且翻译成功后，结果图按原位置钉住
7. 拖动钉住图后双击关闭
8. 从钉住记录再次打开同一张图，回到最后位置
9. 已钉住状态下再次点同一条记录，只提示，不重复创建窗口
```

- [ ] **Step 6: 提交文档与验证更新**

```bash
git add README.md AGENTS.md
git commit -m "docs: 同步自定义截图分支说明"
```

