# Screen Shot Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前仓库迁移成一个结构完整的 uTools 截屏翻译插件工程，清除旧书签业务，并落下“截屏 -> 翻译 -> 钉住”的首页骨架和设置页骨架。

**Architecture:** 以 `utools-my-quick-bookmarks` 的现有工程壳为基础，保留单 `feature`、单 `App.vue` 和单 `preload/services.js` 的组织方式。删除书签读取、搜索、缓存和打开逻辑，用新的 `screenTranslation` 目录、设置状态和骨架页面替换旧业务语义，再用最小测试和构建验证迁移结果。

**Tech Stack:** Vue 3, Vite 6, uTools plugin manifest, CommonJS preload bridge, Node `--test`

---

### Task 1: 复制参考工程壳并清理无关产物

**Files:**
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/.gitignore`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/index.html`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/jsconfig.json`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package.json`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package-lock.json`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/**/*`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/**/*`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/**/*`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`

- [ ] **Step 1: 从参考仓库复制基础工程文件，不复制运行产物和依赖**

Run:

```bash
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-my-quick-bookmarks/ \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/
```

Expected: 目标仓库出现 `package.json`、`public/`、`src/`、`tests/` 等完整工程结构。

- [ ] **Step 2: 清理参考仓库的协作文档和无关模板残留**

Run:

```bash
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md
rm -rf /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/Hello
rm -rf /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/Read
rm -rf /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/Write
```

Expected: 目标仓库只保留当前插件需要的工程文件，不携带参考项目的协作文档和模板页。

- [ ] **Step 3: 检查复制后的根目录结构**

Run:

```bash
find /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation -maxdepth 2 -type f | sort
```

Expected: 能看到根目录、`public/`、`src/`、`tests/` 的文件列表，且没有 `dist/` 和 `node_modules/` 被复制进来。

- [ ] **Step 4: 提交结构迁移基础壳**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add .
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "chore: copy plugin scaffold from reference project"
```

Expected: 提交成功，后续替换可以基于这个完整工程壳继续推进。

### Task 2: 替换插件身份与文档入口

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package.json`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json`

- [ ] **Step 1: 先写一个失败检查，确认旧身份仍然存在**

Run:

```bash
rg -n "quick-bookmarks|bookmarks|chrome书签|快捷书签" \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package.json \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json
```

Expected: 命中旧插件身份，说明替换目标明确。

- [ ] **Step 2: 把 README 改成新插件说明**

Replace with:

```md
# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件骨架。

当前版本先完成工程迁移和页面骨架：

- 首页展示 `截屏 -> 翻译 -> 钉住` 三步流
- 保留设置页，用于承载翻译和显示相关配置
- 暂未接入真实截屏、翻译和钉住能力

后续开发会在这个工程骨架上逐步接入真实能力。
```

- [ ] **Step 3: 把 `package.json` 改成新插件身份**

Use this shape:

```json
{
  "name": "utools-screen-shot-translation",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "node --test tests/preload/*.test.mjs"
  },
  "dependencies": {
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "utools-api-types": "^7.5.1",
    "vite": "^6.0.11"
  }
}
```

- [ ] **Step 4: 把 `public/plugin.json` 改成新的 uTools 入口**

Use this content:

```json
{
  "main": "index.html",
  "preload": "preload/services.js",
  "logo": "logo.png",
  "development": {
    "main": "http://localhost:5173"
  },
  "pluginSetting": {
    "height": 640
  },
  "features": [
    {
      "code": "screen-shot-translation",
      "explain": "截屏、翻译并把翻译后的图片钉住在屏幕上",
      "cmds": ["截屏&翻译", "截屏&翻译&钉住"]
    }
  ]
}
```

- [ ] **Step 5: 重新搜索身份字段，确认入口层已切换**

Run:

```bash
rg -n "quick-bookmarks|chrome书签|快捷书签|bookmarks" \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package.json \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json
```

Expected: 三个文件里不再命中旧插件身份。

- [ ] **Step 6: 提交插件身份替换**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add README.md package.json public/plugin.json package-lock.json
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "chore: rename plugin identity to screen shot translation"
```

Expected: 提交成功，后续代码替换将基于新插件身份继续。

### Task 3: 重写 preload 状态与桥接边界

**Files:**
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/chromeBookmarks.cjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/localState.cjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`

- [ ] **Step 1: 先写本地状态测试，覆盖新 UI 设置和插件配置归一化**

Use test content like:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeUiSettings,
  normalizePluginSettings,
} from '../../public/preload/localState.cjs'

test('normalizeUiSettings falls back to default theme and window height', () => {
  assert.deepEqual(normalizeUiSettings({}), {
    themeMode: 'system',
    windowHeight: 640,
  })
})

test('normalizePluginSettings keeps language and pin defaults stable', () => {
  assert.deepEqual(normalizePluginSettings({}), {
    sourceLanguage: 'auto',
    targetLanguage: 'zh-CN',
    pinPreviewMode: 'overlay',
  })
})
```

- [ ] **Step 2: 运行新测试，确认它先失败**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
node --test tests/preload/localState.test.mjs
```

Expected: FAIL，报出 `normalizePluginSettings` 未定义或断言不匹配。

- [ ] **Step 3: 在 `localState.cjs` 中实现最小新状态模型**

Implement around this shape:

```js
const DEFAULT_UI_SETTINGS = {
  themeMode: 'system',
  windowHeight: 640,
}

const DEFAULT_PLUGIN_SETTINGS = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  pinPreviewMode: 'overlay',
}

function normalizeUiSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const themeMode = ['system', 'dark', 'light'].includes(data.themeMode) ? data.themeMode : DEFAULT_UI_SETTINGS.themeMode
  const windowHeight = Math.floor(Number(data.windowHeight))

  return {
    themeMode,
    windowHeight: Number.isFinite(windowHeight) && windowHeight > 0 ? Math.min(Math.max(windowHeight, 480), 960) : DEFAULT_UI_SETTINGS.windowHeight,
  }
}

function normalizePluginSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}

  return {
    sourceLanguage: typeof data.sourceLanguage === 'string' && data.sourceLanguage.trim() ? data.sourceLanguage.trim() : DEFAULT_PLUGIN_SETTINGS.sourceLanguage,
    targetLanguage: typeof data.targetLanguage === 'string' && data.targetLanguage.trim() ? data.targetLanguage.trim() : DEFAULT_PLUGIN_SETTINGS.targetLanguage,
    pinPreviewMode: ['overlay', 'side-by-side'].includes(data.pinPreviewMode) ? data.pinPreviewMode : DEFAULT_PLUGIN_SETTINGS.pinPreviewMode,
  }
}

module.exports = {
  DEFAULT_UI_SETTINGS,
  DEFAULT_PLUGIN_SETTINGS,
  normalizeUiSettings,
  normalizePluginSettings,
}
```

- [ ] **Step 4: 在 `services.js` 中以新插件桥接为主，并在 Task 4 前允许最小兼容层**

Implement around this shape:

```js
const {
  normalizeUiSettings,
  normalizePluginSettings,
} = require('./localState.cjs')

const UI_SETTINGS_KEY = 'screen-shot-translation-ui-settings'
const PLUGIN_SETTINGS_KEY = 'screen-shot-translation-settings'

function getUiSettings() {
  return normalizeUiSettings(window.utools.dbStorage.getItem(UI_SETTINGS_KEY))
}

function saveUiSettings(partial) {
  const next = normalizeUiSettings({
    ...getUiSettings(),
    ...(partial && typeof partial === 'object' ? partial : {}),
  })
  window.utools.dbStorage.setItem(UI_SETTINGS_KEY, next)
  return next
}

function getPluginSettings() {
  return normalizePluginSettings(window.utools.dbStorage.getItem(PLUGIN_SETTINGS_KEY))
}

function savePluginSettings(partial) {
  const next = normalizePluginSettings({
    ...getPluginSettings(),
    ...(partial && typeof partial === 'object' ? partial : {}),
  })
  window.utools.dbStorage.setItem(PLUGIN_SETTINGS_KEY, next)
  return next
}

window.services = {
  getUiSettings,
  saveUiSettings,
  getPluginSettings,
  savePluginSettings,
}
```

Compatibility note:

```text
如果此时旧的 src/App.vue 还没在 Task 4 替换掉，services.js 可以临时保留薄兼容层，
只保证旧页面不会因为 preload 方法缺失直接崩溃。兼容层必须满足：
1. 新 API 仍然是主桥接边界；
2. 旧方法只做空实现、受控错误或最小结构回填；
3. 不恢复旧书签业务逻辑；
4. 在 Task 4 完成后删除。
```

- [ ] **Step 5: 删除旧书签 preload 文件和无关测试**

Run:

```bash
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/chromeBookmarks.cjs
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/chromeBookmarks.test.mjs
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/itemOrder.test.mjs
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/keyboardNavigation.test.mjs
rm -f /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/search.test.mjs
```

Expected: 书签解析、搜索、排序和导航相关测试不再保留。

- [ ] **Step 6: 重新运行本地状态测试**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
node --test tests/preload/localState.test.mjs
```

Expected: PASS。

- [ ] **Step 7: 提交 preload 边界替换**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add public/preload tests/preload
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "refactor: replace bookmark preload state with plugin settings"
```

Expected: 提交成功，渲染层后续以新的设置接口为主；如果中间态需要兼容层，允许补碎片提交修正，但提交信息仍需使用“英文类型：中文正文”格式。

### Task 4: 用新页面骨架替换旧书签前端

**Files:**
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/components/BookmarkAvatar.vue`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/components/BookmarkCard.vue`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/components/BookmarkCover.vue`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/components/BookmarksSection.vue`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/itemOrder.js`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/keyboardNavigation.js`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/search.js`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/theme.js`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/types.ts`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/HomeView.vue`
- Delete: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks/SettingsView.vue`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/types.ts`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

Coupling note:

```text
如果前端骨架替换会立即影响现有 theme 相关测试或旧主题模块引用，
Task 4 允许顺手处理“和骨架替换直接耦合的最小测试或兼容层”，
以保证该任务单独提交后不会产生确定性回归。
这类处理必须满足：
1. 只覆盖与骨架替换直接耦合的点；
2. 不提前做 Task 5 的完整测试清理；
3. 不恢复旧书签页面逻辑。
```

- [ ] **Step 1: 先写一个最小页面骨架测试或 smoke 断言点**

Because the repo currently has no Vue unit test harness, define smoke assertions via string search:

```bash
rg -n "截屏|翻译|钉住|设置" \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
```

Expected: 初次运行前会失败，因为新目录和新文案还不存在。

- [ ] **Step 2: 新建三步流类型定义**

Create `src/screenTranslation/types.ts` with:

```ts
export type ScreenTranslationView = 'home' | 'settings'
export type ScreenTranslationStep = 'capture' | 'translate' | 'pin'
export type ScreenTranslationStepState = 'idle' | 'ready' | 'done'

export type ScreenTranslationUiSettings = {
  themeMode: 'system' | 'dark' | 'light'
  windowHeight: number
}

export type ScreenTranslationPluginSettings = {
  sourceLanguage: string
  targetLanguage: string
  pinPreviewMode: 'overlay' | 'side-by-side'
}
```

- [ ] **Step 3: 新建首页三步流骨架页**

Create `src/screenTranslation/HomeView.vue` around:

```vue
<script setup lang="ts">
import type { ScreenTranslationStep } from './types'

defineProps<{
  bootstrapped: boolean
  processing: boolean
  currentStep: ScreenTranslationStep
  captureStateText: string
  translationStateText: string
  pinStateText: string
  error: string
}>()

const emit = defineEmits<{
  (event: 'start-capture'): void
  (event: 'start-translate'): void
  (event: 'start-pin'): void
  (event: 'open-settings'): void
}>()
</script>

<template>
  <section class="page-shell page-shell--home">
    <header class="hero-card">
      <p class="section-label">Screen Translation</p>
      <h1>截屏 -> 翻译 -> 钉住</h1>
      <p class="hero-copy">当前版本先完成流程骨架，后续再接入真实能力。</p>
    </header>

    <p v-if="error" class="state-card state-error">{{ error }}</p>

    <section class="step-card">
      <h2>1. 截屏</h2>
      <p>{{ captureStateText }}</p>
      <button class="primary-button" :disabled="processing" @click="emit('start-capture')">开始截屏</button>
    </section>

    <section class="step-card">
      <h2>2. 翻译</h2>
      <p>{{ translationStateText }}</p>
      <button class="primary-button" :disabled="processing" @click="emit('start-translate')">开始翻译</button>
    </section>

    <section class="step-card">
      <h2>3. 钉住</h2>
      <p>{{ pinStateText }}</p>
      <button class="primary-button" :disabled="processing" @click="emit('start-pin')">钉住结果</button>
    </section>

    <div class="home-dock__actions">
      <button class="secondary-button" @click="emit('open-settings')">设置</button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: 新建设置页骨架**

Create `src/screenTranslation/SettingsView.vue` around:

```vue
<script setup lang="ts">
defineProps<{
  sourceLanguage: string
  targetLanguage: string
  pinPreviewMode: string
  themeMode: string
  windowHeight: number
}>()

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'save-plugin-settings', payload: { sourceLanguage: string; targetLanguage: string; pinPreviewMode: string }): void
  (event: 'save-ui-settings', payload: { themeMode?: string; windowHeight?: number }): void
}>()
</script>

<template>
  <section class="page-shell page-shell--settings">
    <button class="secondary-button" @click="emit('back')">返回首页</button>
    <section class="settings-card">
      <p class="section-label">Translation Settings</p>
      <h1>设置</h1>
      <p class="settings-copy">这里先保留翻译和钉住相关配置骨架，后续再接入真实服务。</p>
      <div class="settings-group">
        <h2>翻译方向</h2>
        <p>源语言：{{ sourceLanguage }}</p>
        <p>目标语言：{{ targetLanguage }}</p>
      </div>
      <div class="settings-group">
        <h2>钉住预览</h2>
        <p>当前模式：{{ pinPreviewMode }}</p>
      </div>
      <div class="settings-group">
        <h2>界面外观</h2>
        <p>主题：{{ themeMode }}</p>
        <p>窗口高度：{{ windowHeight }} px</p>
      </div>
    </section>
  </section>
```

- [ ] **Step 5: 重写 `App.vue` 为新的最小状态机**

Implement around:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import HomeView from './screenTranslation/HomeView.vue'
import SettingsView from './screenTranslation/SettingsView.vue'

const currentView = ref<'home' | 'settings'>('home')
const bootstrapped = ref(false)
const processing = ref(false)
const currentStep = ref<'capture' | 'translate' | 'pin'>('capture')
const homeError = ref('')
const uiSettings = ref(window.services.getUiSettings())
const pluginSettings = ref(window.services.getPluginSettings())

const captureStateText = computed(() => currentStep.value === 'capture' ? '尚未截屏' : '截屏骨架已完成')
const translationStateText = computed(() => currentStep.value === 'translate' || currentStep.value === 'pin' ? '翻译骨架已准备' : '等待截图后翻译')
const pinStateText = computed(() => currentStep.value === 'pin' ? '钉住骨架已准备' : '等待翻译结果后钉住')

function applyPluginWindowHeight(height: number) {
  if (window.utools?.setExpendHeight) {
    window.utools.setExpendHeight(height)
  }
}

function startCapture() {
  currentStep.value = 'translate'
}

function startTranslate() {
  currentStep.value = 'pin'
}

function startPin() {
  homeError.value = '当前版本还未接入真实钉住能力。'
}

onMounted(() => {
  applyPluginWindowHeight(uiSettings.value.windowHeight)
  bootstrapped.value = true
})
</script>
```

- [ ] **Step 6: 重写 `main.css` 以匹配新首页和设置页骨架**

Keep the existing neutral design direction, but ensure these selectors exist:

```css
.hero-card,
.step-card,
.settings-card,
.state-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.hero-card,
.step-card,
.settings-card {
  padding: 18px;
}

.step-card {
  display: grid;
  gap: 10px;
}
```

Also remove selectors that only target bookmark cards, search results, or bookmark sections.

- [ ] **Step 7: 删除旧书签前端目录和模块**

Run:

```bash
rm -rf /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/bookmarks
```

Expected: 旧书签模块整体移除，只保留 `screenTranslation` 目录。

- [ ] **Step 8: 运行首页骨架文本检查**

Run:

```bash
rg -n "截屏|翻译|钉住|设置" \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/App.vue \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue \
  /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
```

Expected: PASS，能命中新页面骨架文案。

- [ ] **Step 9: 提交前端骨架替换**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add src
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "feat: add screen translation skeleton views"
```

Expected: 提交成功，前端已切换到新插件骨架。

### Task 5: 清理 legacy 兼容层并对齐最终测试

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/preload/localState.test.mjs`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package.json`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/package-lock.json`

- [ ] **Step 1: 删除 Task 3 过渡期留下的 legacy preload 兼容层**

Use this rule:

```text
Task 4 完成后，旧 App 已不再依赖 getBookmarkSettings / getBookmarkUiSettings / loadChromeBookmarks 等兼容方法。
此时应从 services.js 中删除 quick-bookmarks 相关 key、legacy 兼容 API 和旧错误文案，
只保留 getUiSettings / saveUiSettings / getPluginSettings / savePluginSettings 四个正式桥接方法。
```

- [ ] **Step 2: 同步清理因旧书签模块保留而暂时留下的依赖与测试文案**

Use this rule:

```text
如果 package.json 里仍为中间态保留了 pinyin-pro，应在这一步删除，并同步更新 package-lock.json。
同时把 localState.test.mjs 里任何仅用于兼容旧书签桥接的断言、旧 key、旧错误路径文案一起清掉，
让测试只覆盖当前插件真正保留的 preload 语义。
```

- [ ] **Step 3: 保留仍然服务当前工程的测试**

Use this rule:

```text
theme.test.mjs 如果仍覆盖当前 screenTranslation/theme.js，就继续保留。
bootShell.test.mjs 如果仍覆盖 src/bootShell.js 的真实在用逻辑，也继续保留，不删除。
```

- [ ] **Step 4: 运行全部 preload 测试**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
npm test
```

Expected: PASS。

- [ ] **Step 5: 提交 legacy 清理**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add public/preload tests package.json package-lock.json
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "refactor: 清理 legacy 兼容层与旧依赖"
```

Expected: 提交成功。

### Task 6: 全局替换检查与构建验证

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/**/*`

- [ ] **Step 1: 全局搜索旧业务关键词**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
rg -n "quick-bookmarks|bookmark|bookmarks|Chrome Bookmarks|chrome书签|快捷书签" .
```

Expected: 只允许在设计/计划文档里命中；源码、README、配置、测试里不应再命中旧书签语义。

- [ ] **Step 2: 如果源码里仍命中旧语义，逐个清理后再次搜索**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
rg -n "quick-bookmarks|bookmark|bookmarks|Chrome Bookmarks|chrome书签|快捷书签" src public tests README.md package.json
```

Expected: 无命中。

- [ ] **Step 3: 安装依赖**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
npm install
```

Expected: 安装完成，不报缺失依赖。

- [ ] **Step 4: 执行构建**

Run:

```bash
cd /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation
npm run build
```

Expected: PASS，并生成 `dist/` 产物。

- [ ] **Step 5: 汇总当前骨架的真实边界**

Document these exact points in the final implementation summary:

```text
- 当前只完成工程迁移和骨架替换
- 首页与设置页语义已切到新插件
- preload 只保留新设置桥接
- 还没有接入真实截屏、翻译和钉住能力
```

- [ ] **Step 6: 提交最终迁移结果**

Run:

```bash
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation add .
git -C /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation commit -m "feat: migrate plugin scaffold to screen shot translation skeleton"
```

Expected: 提交成功，仓库处于可继续开发的骨架状态。
