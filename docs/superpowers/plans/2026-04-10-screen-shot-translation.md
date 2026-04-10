# Screen Shot Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前骨架插件实现成可用的第一版：支持 `截屏翻译钉住` 无页面主流程、`钉住记录` 瀑布流主页、`设置` 直达页，以及保存目录总清单、重钉、删除和失败结果页。

**Architecture:** 保持当前单 `App.vue` + `window.services` 的结构不变，把真实能力继续收口在 `public/preload/`。前端只负责入口视图切换、记录渲染和设置编辑；主流程编排、总清单 JSON、文件保存和失败归因全部放在 preload 纯函数模块里，并用 Node `--test` 覆盖。

**Tech Stack:** Vue 3, Vite 6, uTools plugin manifest, CommonJS preload bridge, Node `--test`, uTools `dbStorage`

---

## File Map

- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json`
  定义 3 个 feature 入口：`截屏翻译钉住`、`钉住记录`、`设置`。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/localState.cjs`
  归一化新的插件设置：翻译方向、保存开关、保存目录、删除确认开关。
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/recordStore.cjs`
  负责总清单 JSON 的读取、排序、修复、写入和删除。
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/workflow.cjs`
  负责主流程状态编排，把截屏、翻译、钉住、保存和失败原因收口成单一接口。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
  通过 `window.services` 暴露设置、记录、主流程、重钉和删除接口。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/types.ts`
  定义新的视图类型、结果页状态和插件设置类型。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`
  按 feature code 进入 `records / settings / result`，主流程入口失败时切到结果页。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
  改造成 `钉住记录` 瀑布流主页。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
  改成真实设置项。
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/ResultView.vue`
  展示失败结果页。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`
  增加瀑布流、记录卡片、失败页和设置页样式。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
  更新当前真实能力说明。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`
  同步入口结构、设置模型、preload 边界和验证方式。
- Modify/Create Tests:
  - `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`
  - `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/recordStore.test.mjs`
  - `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/workflow.test.mjs`

### Task 1: 切换入口模型和前端视图骨架

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/types.ts`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`

- [ ] **Step 1: 先把 feature 入口写成 3 个明确指令**

Use this `features` shape:

```json
[
  {
    "code": "screen-shot-translation-run",
    "explain": "截屏、翻译并把翻译结果钉住到原位置",
    "cmds": ["截屏翻译钉住"]
  },
  {
    "code": "screen-shot-translation-records",
    "explain": "查看已保存的钉住记录",
    "cmds": ["钉住记录"]
  },
  {
    "code": "screen-shot-translation-settings",
    "explain": "打开截屏翻译设置",
    "cmds": ["设置"]
  }
]
```

- [ ] **Step 2: 在 `types.ts` 里先定义新的视图和结果状态类型**

Add the minimal type layer:

```ts
export type ScreenTranslationFeatureCode =
  | 'screen-shot-translation-run'
  | 'screen-shot-translation-records'
  | 'screen-shot-translation-settings'

export type ScreenTranslationView = 'records' | 'settings' | 'result'

export type TranslationMode = 'auto' | 'en-to-zh' | 'zh-to-en'

export type WorkflowFailureCode =
  | 'capture-cancelled'
  | 'translation-failed'
  | 'save-config-invalid'
  | 'save-failed'
  | 'pin-failed'
  | 'repin-failed'
```

- [ ] **Step 3: 在 `App.vue` 里先写最小 feature 分发逻辑**

Add a handler like:

```ts
function handlePluginEnter({ code }) {
  if (code === 'screen-shot-translation-settings') {
    currentView.value = 'settings'
    return
  }

  if (code === 'screen-shot-translation-records') {
    currentView.value = 'records'
    void refreshRecords()
    return
  }

  void runMainWorkflow()
}
```

- [ ] **Step 4: 为主流程失败预留统一结果态**

Keep one result state instead of scattered strings:

```ts
const workflowResult = ref({
  visible: false,
  code: '' as WorkflowFailureCode | '',
  title: '',
  message: '',
})
```

- [ ] **Step 5: 跑构建确认入口切换没有破前端编译**

Run:

```bash
npm run build
```

Expected: `vite build` 成功，说明 manifest 和类型改动没有破坏现有编译。

- [ ] **Step 6: 提交入口模型切换**

Run:

```bash
git add public/plugin.json src/screenTranslation/types.ts src/App.vue
git commit -m "feat: add run records and settings entry points"
```

Expected: 提交成功，后续任务可基于新入口继续实现。

### Task 2: 先把设置模型落稳并补测试

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/localState.cjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`

- [ ] **Step 1: 先写失败测试，覆盖新的插件设置默认值和归一化**

Add tests like:

```js
test('normalizePluginSettings returns the new screen translation defaults', () => {
  assert.deepEqual(normalizePluginSettings({}), {
    translationMode: 'auto',
    saveTranslatedImage: false,
    saveDirectory: '',
    confirmBeforeDelete: true,
  })
})

test('normalizePluginSettings sanitizes invalid values', () => {
  assert.deepEqual(
    normalizePluginSettings({
      translationMode: 'ja-to-en',
      saveTranslatedImage: 'yes',
      saveDirectory: 42,
      confirmBeforeDelete: 'no',
    }),
    {
      translationMode: 'auto',
      saveTranslatedImage: false,
      saveDirectory: '',
      confirmBeforeDelete: true,
    },
  )
})
```

- [ ] **Step 2: 先运行单测，确认新增断言会失败**

Run:

```bash
npm test
```

Expected: `localState` 相关测试失败，因为现有设置模型还没有这些字段。

- [ ] **Step 3: 在 `localState.cjs` 里写最小实现**

Use this shape:

```js
const DEFAULT_PLUGIN_SETTINGS = {
  translationMode: 'auto',
  saveTranslatedImage: false,
  saveDirectory: '',
  confirmBeforeDelete: true,
}

const VALID_TRANSLATION_MODES = new Set(['auto', 'en-to-zh', 'zh-to-en'])

function normalizePluginSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  return {
    translationMode: VALID_TRANSLATION_MODES.has(data.translationMode)
      ? data.translationMode
      : DEFAULT_PLUGIN_SETTINGS.translationMode,
    saveTranslatedImage: Boolean(data.saveTranslatedImage),
    saveDirectory: typeof data.saveDirectory === 'string' ? data.saveDirectory.trim() : '',
    confirmBeforeDelete:
      typeof data.confirmBeforeDelete === 'boolean'
        ? data.confirmBeforeDelete
        : DEFAULT_PLUGIN_SETTINGS.confirmBeforeDelete,
  }
}
```

- [ ] **Step 4: 在 `services.js` 中保持现有接口名不变，只升级返回值**

Keep the bridge stable:

```js
window.services = {
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
}
```

The change here is that `getPluginSettings()` / `savePluginSettings()` now return the new fields above.

- [ ] **Step 5: 再跑单测，确认设置归一化通过**

Run:

```bash
npm test
```

Expected: `tests/preload/localState.test.mjs` 通过，旧字段断言已全部替换为新模型。

- [ ] **Step 6: 提交设置模型更新**

Run:

```bash
git add public/preload/localState.cjs public/preload/services.js tests/preload/localState.test.mjs
git commit -m "feat: add persistent translation and delete settings"
```

Expected: 提交成功，后续记录页和主流程可以依赖统一设置结构。

### Task 3: 实现保存目录总清单和记录清理逻辑

**Files:**
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/recordStore.cjs`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/recordStore.test.mjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`

- [ ] **Step 1: 先写记录清单测试，锁定 JSON 结构和排序行为**

Add tests like:

```js
test('sortRecordsByCreatedAtDesc keeps newest record first', () => {
  const sorted = sortRecordsByCreatedAtDesc([
    { id: 'a', createdAt: '2026-04-10T10:00:00.000Z' },
    { id: 'b', createdAt: '2026-04-10T12:00:00.000Z' },
  ])

  assert.deepEqual(sorted.map((item) => item.id), ['b', 'a'])
})

test('reconcileRecords drops entries whose image file is missing', async () => {
  const result = await reconcileRecords({
    records: [{ id: 'a', imageFilename: 'missing.png', createdAt: '2026-04-10T12:00:00.000Z' }],
    fileExists: async () => false,
  })

  assert.deepEqual(result.records, [])
})
```

- [ ] **Step 2: 先实现不依赖 uTools 的纯函数**

Start with helpers like:

```js
function getManifestFilename() {
  return '.screen-translation-records.json'
}

function sortRecordsByCreatedAtDesc(records) {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

async function reconcileRecords({ records, fileExists }) {
  const validRecords = []

  for (const record of records) {
    if (await fileExists(record.imageFilename)) {
      validRecords.push(record)
    }
  }

  return { records: sortRecordsByCreatedAtDesc(validRecords) }
}
```

- [ ] **Step 3: 再补文件读写接口，保持单文件总清单模型**

Implement the file API:

```js
async function readRecordManifest({ fs, path, directoryPath }) {
  const manifestPath = path.join(directoryPath, getManifestFilename())

  if (!fs.existsSync(manifestPath)) {
    return { version: 1, updatedAt: '', records: [] }
  }

  return JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
}

async function writeRecordManifest({ fs, path, directoryPath, manifest }) {
  const manifestPath = path.join(directoryPath, getManifestFilename())
  const nextManifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: sortRecordsByCreatedAtDesc(manifest.records),
  }

  await fs.promises.writeFile(manifestPath, JSON.stringify(nextManifest, null, 2), 'utf8')
  return nextManifest
}
```

- [ ] **Step 4: 在 `services.js` 中暴露记录读取和删除入口**

Expose methods like:

```js
window.services = {
  ...window.services,
  listSavedRecords: () => listSavedRecords({ fs, path, settings: getPluginSettings() }),
  deleteSavedRecord: (recordId) => deleteSavedRecord({ fs, path, settings: getPluginSettings(), recordId }),
}
```

- [ ] **Step 5: 跑新增测试，确认总清单逻辑稳定**

Run:

```bash
node --test tests/preload/recordStore.test.mjs
```

Expected: 新测试通过，记录清单排序和脏数据清理行为稳定。

- [ ] **Step 6: 提交记录清单模块**

Run:

```bash
git add public/preload/recordStore.cjs public/preload/services.js tests/preload/recordStore.test.mjs
git commit -m "feat: add saved record manifest store"
```

Expected: 提交成功，记录页已经有稳定的数据源。

### Task 4: 实现主流程编排和失败归因

**Files:**
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/workflow.cjs`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/workflow.test.mjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`

- [ ] **Step 1: 先写失败归因测试，锁定成功和失败返回形状**

Add tests like:

```js
test('runMainWorkflow returns save-config-invalid when saving is enabled without directory', async () => {
  const result = await runMainWorkflow({
    settings: { saveTranslatedImage: true, saveDirectory: '' },
    captureImage: async () => ({ ok: true }),
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'save-config-invalid',
  })
})

test('runMainWorkflow returns capture-cancelled when screenshot is cancelled', async () => {
  const result = await runMainWorkflow({
    settings: { saveTranslatedImage: false, saveDirectory: '' },
    captureImage: async () => ({ ok: false, code: 'cancelled' }),
  })

  assert.equal(result.code, 'capture-cancelled')
})
```

- [ ] **Step 2: 先实现纯编排函数，不直接把 uTools 写死到逻辑里**

Use dependency injection:

```js
async function runMainWorkflow({
  settings,
  captureImage,
  translateImage,
  pinImage,
  saveImage,
}) {
  if (settings.saveTranslatedImage && !settings.saveDirectory) {
    return { ok: false, code: 'save-config-invalid' }
  }

  const captureResult = await captureImage()
  if (!captureResult.ok) {
    return { ok: false, code: 'capture-cancelled' }
  }

  const translationResult = await translateImage(captureResult)
  if (!translationResult.ok) {
    return { ok: false, code: 'translation-failed' }
  }

  const pinResult = await pinImage(translationResult)
  if (!pinResult.ok) {
    return { ok: false, code: 'pin-failed' }
  }

  if (settings.saveTranslatedImage) {
    const saveResult = await saveImage(translationResult, pinResult.bounds)
    if (!saveResult.ok) {
      return { ok: false, code: 'save-failed' }
    }
  }

  return { ok: true }
}
```

- [ ] **Step 3: 在 `services.js` 中做真实依赖装配**

Add a bridge like:

```js
window.services.runCaptureTranslationPin = async () => {
  const settings = getPluginSettings()
  return runMainWorkflow({
    settings,
    captureImage: () => captureWithUtools(window.utools),
    translateImage: (captureResult) => translateWithBaidu(captureResult),
    pinImage: (translationResult) => pinTranslatedImage(window.utools, translationResult),
    saveImage: (translationResult, bounds) =>
      saveTranslatedRecord({ fs, path, settings, translationResult, bounds }),
  })
}
```

- [ ] **Step 4: 再补重钉入口，让主页复用同一失败码体系**

Use the same result shape:

```js
window.services.repinSavedRecord = async (recordId) => {
  return repinSavedRecord({
    fs,
    path,
    settings: getPluginSettings(),
    recordId,
    pinImage: (record) => pinSavedImage(window.utools, record),
  })
}
```

- [ ] **Step 5: 跑主流程测试**

Run:

```bash
node --test tests/preload/workflow.test.mjs
```

Expected: 成功路径和失败归因测试全部通过。

- [ ] **Step 6: 提交流程编排模块**

Run:

```bash
git add public/preload/workflow.cjs public/preload/services.js tests/preload/workflow.test.mjs
git commit -m "feat: add capture translate pin workflow service"
```

Expected: 提交成功，前端已经可以只依赖一层业务接口。

### Task 5: 重写设置页、记录页和失败结果页

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/ResultView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 先把 `HomeView.vue` 改成只接收记录页所需 props**

Use a prop contract like:

```ts
const props = defineProps<{
  records: Array<{
    id: string
    imagePath: string
    createdAtLabel: string
    orderLabel: string
  }>
  loading: boolean
  emptyStateTitle: string
  emptyStateCopy: string
}>()
```

- [ ] **Step 2: 在 `HomeView.vue` 中先实现瀑布流卡片和删除按钮**

Use a DOM shape like:

```vue
<section class="records-grid">
  <article v-for="record in records" :key="record.id" class="record-card">
    <button class="record-card__preview" @click="$emit('repin-record', record.id)">
      <img :src="record.imagePath" :alt="record.orderLabel" />
    </button>
    <div class="record-card__meta">
      <span>{{ record.orderLabel }}</span>
      <span>{{ record.createdAtLabel }}</span>
    </div>
    <button class="secondary-button secondary-button--danger" @click="$emit('delete-record', record.id)">
      删除
    </button>
  </article>
</section>
```

- [ ] **Step 3: 把 `SettingsView.vue` 收缩成真实字段**

Render only:

```vue
<select :value="pluginSettings.translationMode" @change="emitTranslationModeChange(...)">
  <option value="auto">自动</option>
  <option value="en-to-zh">英 -> 中</option>
  <option value="zh-to-en">中 -> 英</option>
</select>

<input
  type="checkbox"
  :checked="pluginSettings.saveTranslatedImage"
  @change="emitSaveTranslatedImageChange(...)"
>

<input
  type="checkbox"
  :checked="pluginSettings.confirmBeforeDelete"
  @change="emitConfirmBeforeDeleteChange(...)"
>
```

- [ ] **Step 4: 新建 `ResultView.vue`，统一展示失败结果**

Start with:

```vue
<template>
  <section class="page-shell page-shell--result">
    <p class="section-label">Workflow Result</p>
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <div class="actions-row">
      <button type="button" class="primary-button" v-if="showRetry" @click="$emit('retry')">重试</button>
      <button type="button" class="secondary-button" v-if="showSettings" @click="$emit('open-settings')">前往设置</button>
      <button type="button" class="secondary-button" @click="$emit('close')">关闭</button>
    </div>
  </section>
</template>
```

- [ ] **Step 5: 在 `App.vue` 里把服务层结果映射成页面文案**

Add a mapper:

```ts
function mapFailureToResult(code: WorkflowFailureCode) {
  if (code === 'save-config-invalid') {
    return {
      title: '这次没有完成钉住',
      message: '保存结果已开启，但还没有设置保存目录。',
      showRetry: false,
      showSettings: true,
    }
  }

  return {
    title: '这次没有完成钉住',
    message: '流程执行失败，请重试。',
    showRetry: true,
    showSettings: false,
  }
}
```

- [ ] **Step 6: 在 `main.css` 里加瀑布流和结果页样式，不重做整套主题**

Use CSS like:

```css
.records-grid {
  column-count: 3;
  column-gap: 16px;
}

.record-card {
  break-inside: avoid;
  margin-bottom: 16px;
}

.record-card__preview img {
  width: 100%;
  display: block;
  border-radius: 16px;
}
```

- [ ] **Step 7: 跑构建，确认页面层通过**

Run:

```bash
npm run build
```

Expected: 构建通过，说明新增结果页和记录页 props 没有类型或模板错误。

- [ ] **Step 8: 提交页面重写**

Run:

```bash
git add src/App.vue src/screenTranslation/HomeView.vue src/screenTranslation/SettingsView.vue src/screenTranslation/ResultView.vue src/main.css
git commit -m "feat: add records settings and failure views"
```

Expected: 提交成功，插件页面结构已和 spec 对齐。

### Task 6: 接通目录选择、删除确认和记录交互

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`

- [ ] **Step 1: 在 preload 中暴露目录选择接口**

Add a bridge like:

```js
window.services.pickSaveDirectory = async () => {
  const result = await window.utools.showOpenDialog({
    properties: ['openDirectory'],
  })

  if (Array.isArray(result) && result[0]) {
    return result[0]
  }

  return ''
}
```

- [ ] **Step 2: 在设置页加“选择目录”按钮，并即时回写到设置**

Use an event like:

```vue
<button type="button" class="secondary-button" @click="$emit('pick-save-directory')">
  选择保存目录
</button>
```

And in `App.vue`:

```ts
async function pickSaveDirectory() {
  const directory = await getServices()?.pickSaveDirectory?.()
  if (directory) {
    savePluginSettings({ saveDirectory: directory })
  }
}
```

- [ ] **Step 3: 在记录页删除入口加设置驱动的确认逻辑**

Keep the logic centralized in `App.vue`:

```ts
async function deleteRecord(recordId: string) {
  if (pluginSettings.value.confirmBeforeDelete) {
    const accepted = window.confirm('确认删除这张已保存的翻译结果吗？')
    if (!accepted) return
  }

  await getServices()?.deleteSavedRecord?.(recordId)
  await refreshRecords()
}
```

- [ ] **Step 4: 把重钉动作接到服务层，并在失败时切到结果页**

Use a flow like:

```ts
async function repinRecord(recordId: string) {
  const result = await getServices()?.repinSavedRecord?.(recordId)
  if (!result?.ok) {
    workflowResult.value = {
      visible: true,
      code: 'repin-failed',
      ...mapFailureToResult('repin-failed'),
    }
    currentView.value = 'result'
  }
}
```

- [ ] **Step 5: 跑测试和构建，确认目录选择与页面交互没有破现有逻辑**

Run:

```bash
npm test
npm run build
```

Expected: 所有 preload 测试通过，前端构建仍成功。

- [ ] **Step 6: 提交交互接线**

Run:

```bash
git add public/preload/services.js src/App.vue src/screenTranslation/SettingsView.vue src/screenTranslation/HomeView.vue
git commit -m "feat: wire record actions and directory picking"
```

Expected: 提交成功，记录页和设置页已经接通真实交互。

### Task 7: 更新文档并做完整 smoke test

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`

- [ ] **Step 1: 更新 README，避免继续描述为三步流骨架首页**

Replace the capability summary with:

```md
# uTools Screen Shot Translation

一个运行在 uTools 中的截屏图片翻译工具。

当前版本包含 3 个入口：

- `截屏翻译钉住`：直接执行截屏、翻译并钉住
- `钉住记录`：查看已保存的翻译结果并重新钉住
- `设置`：配置翻译方向、保存目录和删除确认
```

- [ ] **Step 2: 更新 AGENTS，明确新入口和验证顺序**

The updated sections must mention:

```md
- 当前 feature 已改为 3 个入口，不再是单一 `screen-shot-translation`
- `截屏翻译钉住` 成功不打开页面，失败进入结果页
- `钉住记录` 主页只读保存目录根目录中的总清单 JSON
- 设置项包括翻译方向、保存开关、保存目录、删除前二次确认
```

- [ ] **Step 3: 跑完整验证**

Run:

```bash
npm test
npm run build
```

Expected: 全部测试与构建通过。

- [ ] **Step 4: 做 uTools 手动 smoke test**

Run and verify:

```bash
npm run dev
```

Manual checklist:

```md
1. 在 uTools 开发者工具接入 `public/plugin.json`
2. 输入 `设置`，确认直接进入设置页
3. 打开“保存结果图片”但不选目录，执行 `截屏翻译钉住`，确认进入失败结果页
4. 选择保存目录后再执行 `截屏翻译钉住`，确认成功时不打开页面
5. 输入 `钉住记录`，确认能看到最新结果在最前的瀑布流
6. 点击一张记录图，确认会回到上次位置重新钉住
7. 切换“删除前二次确认”开关，确认删除行为随设置变化
```

- [ ] **Step 5: 提交文档与验证收口**

Run:

```bash
git add README.md AGENTS.md
git commit -m "docs: update runtime docs for translation records flow"
```

Expected: 文档与代码边界一致，后续协作者不会再按旧骨架理解这个项目。

## Self-Review

- Spec coverage:
  - 3 个入口 -> Task 1
  - 设置模型 -> Task 2
  - 总清单 JSON -> Task 3
  - 主流程成功/失败 -> Task 4
  - 记录页、设置页、失败页 -> Task 5
  - 删除确认和目录选择 -> Task 6
  - README / AGENTS / smoke -> Task 7
- Placeholder scan:
  - 已避免 `TODO`、`TBD`、`later` 这类占位词。
  - 对缺少现成测试框架的 Vue 页面，统一要求 `npm run build` + uTools smoke，而不是写模糊的“补 UI 测试”。
- Type consistency:
  - 统一使用 `translationMode`、`saveTranslatedImage`、`saveDirectory`、`confirmBeforeDelete`。
  - 统一使用失败码 `capture-cancelled / translation-failed / save-config-invalid / save-failed / pin-failed / repin-failed`。
