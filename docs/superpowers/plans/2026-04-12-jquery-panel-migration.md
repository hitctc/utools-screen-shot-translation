# jQuery 面板迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 Vue 承载的 `钉住记录 / 设置 / 失败结果` 三个页面完整迁移到静态 `HTML + jQuery + preload` 壳中，同时保持主流程入口不变。

**Architecture:** 继续保留当前 preload 数据和业务能力，前端只重写承载壳。`public/index.html` 负责面板容器，`public/app.js` 负责状态协调和事件绑定，新增 `public/panel-renderers.js` 与 `public/panel-state.js` 把 HTML 渲染和状态管理拆开，避免把所有逻辑重新堆回一个大脚本。

**Tech Stack:** HTML, jQuery 3.7, CommonJS preload, Node built-in node:test

---

## 文件结构

- 修改：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/index.html`
  - 补齐 jQuery 面板需要的脚本引用和容器结构
- 修改：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js`
  - 只保留启动、状态协调、事件绑定
- 修改：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.css`
  - 承接 records/settings/result 的主要样式
- 新建：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-state.js`
  - 最小前端状态模型
- 新建：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-renderers.js`
  - records/settings/result HTML 渲染函数
- 修改：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/indexHtmlPackaging.test.mjs`
  - 继续验证静态壳打包
- 新建：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelRenderers.test.mjs`
  - 验证 records/settings/result 渲染关键内容
- 新建：`/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelState.test.mjs`
  - 验证视图状态切换和结果态更新

## Task 1: 搭好 jQuery 面板基础结构

**Files:**
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-state.js`
- Create: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-renderers.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/index.html`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelState.test.mjs`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelRenderers.test.mjs`

- [ ] **Step 1: 写 panel-state 的失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPanelState } from '../../public/panel-state.js'

test('panel state keeps current view and workflow result separately', () => {
  const state = createPanelState()
  state.setView('settings')
  state.setResult({ code: 'translation-failed' })
  assert.equal(state.getSnapshot().view, 'settings')
  assert.deepEqual(state.getSnapshot().result, { code: 'translation-failed' })
})
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `node --test tests/public/panelState.test.mjs`  
Expected: FAIL with module or export not found

- [ ] **Step 3: 写最小 panel-state 实现**

```js
function normalizeView(view) {
  return view === 'settings' || view === 'result' ? view : 'records'
}

export function createPanelState(initial = {}) {
  let snapshot = {
    view: normalizeView(initial.view),
    result: initial.result ?? null,
  }

  return {
    getSnapshot() {
      return { ...snapshot }
    },
    setView(view) {
      snapshot = { ...snapshot, view: normalizeView(view) }
      return this.getSnapshot()
    },
    setResult(result) {
      snapshot = { ...snapshot, result: result ?? null }
      return this.getSnapshot()
    },
    replace(nextState) {
      snapshot = {
        view: normalizeView(nextState?.view),
        result: nextState?.result ?? null,
      }
      return this.getSnapshot()
    },
  }
}
```

- [ ] **Step 4: 写 panel-renderers 的失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { renderResultPanel } from '../../public/panel-renderers.js'

test('result renderer prints title and retry button', () => {
  const html = renderResultPanel({
    code: 'translation-failed',
    title: '翻译失败',
    message: '翻译没有成功',
    themeStatus: '跟随 / 浅色',
    showRetry: true,
    showOpenSettings: true,
    showClose: true,
  })

  assert.match(html, /翻译失败/)
  assert.match(html, /重试/)
  assert.match(html, /前往设置/)
})
```

- [ ] **Step 5: 跑测试确认当前失败**

Run: `node --test tests/public/panelRenderers.test.mjs`  
Expected: FAIL with module or export not found

- [ ] **Step 6: 写最小 panel-renderers 实现和 app.js 引用骨架**

```js
export function renderResultPanel(result) {
  return `<div class="shell"><section class="panel"><h1>${result.title}</h1></section></div>`
}
```

`public/app.js` 先只改成：

```js
import { createPanelState } from './panel-state.js'
import { renderResultPanel } from './panel-renderers.js'
```

- [ ] **Step 7: 让 index.html 引入新的静态脚本**

```html
<script src="./vendor/jquery-3.7.1.min.js"></script>
<script type="module" src="./app.js"></script>
```

- [ ] **Step 8: 运行最小测试**

Run: `node --test tests/public/panelState.test.mjs tests/public/panelRenderers.test.mjs`  
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/app.js public/panel-state.js public/panel-renderers.js tests/public/panelState.test.mjs tests/public/panelRenderers.test.mjs
git commit -m "feat: 搭建 jQuery 面板基础结构"
```

## Task 2: 完整迁移 records 页

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-renderers.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.css`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelRenderers.test.mjs`

- [ ] **Step 1: 为 records 页渲染写失败测试**

```js
test('records renderer prints warning, count and settings action', () => {
  const html = renderRecordsPanel({
    records: [],
    warning: '目录不可读',
    emptyStateTitle: '暂时还没有钉住记录',
    emptyStateCopy: '当前保存目录里还没有可展示的钉住记录。',
    themeStatus: '跟随 / 浅色',
    recordsColumnCount: 4,
  })

  assert.match(html, /目录不可读/)
  assert.match(html, /4 列/)
  assert.match(html, /设置/)
})
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `node --test tests/public/panelRenderers.test.mjs`  
Expected: FAIL with renderRecordsPanel not found

- [ ] **Step 3: 实现 records 页渲染**

实现要求：
- 记录页标题、主题状态、记录总数、列数滑块、当前排布提示条
- warning 区
- 空态
- 卡片列表
- 设置按钮

- [ ] **Step 4: 在 app.js 接通 records 数据加载与事件绑定**

需要接通：
- `window.services.listSavedRecords()`
- `window.services.repinSavedRecord(recordId)`
- `window.services.deleteSavedRecord(recordId)`
- `window.services.getUiSettings/saveUiSettings()`
- `window.services.getPluginSettings()`

- [ ] **Step 5: 按现有视觉结果迁移 records 样式**

重点：
- 记录卡片
- 列数滑块
- 空态
- 右下角设置按钮

- [ ] **Step 6: 跑最相关测试**

Run: `node --test tests/public/panelRenderers.test.mjs tests/preload/localState.test.mjs`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/app.css public/panel-renderers.js tests/public/panelRenderers.test.mjs
git commit -m "feat: 迁移钉住记录页面到 jQuery 壳"
```

## Task 3: 完整迁移 settings 页

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-renderers.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.css`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelRenderers.test.mjs`

- [ ] **Step 1: 为 settings 页渲染写失败测试**

```js
test('settings renderer prints translation credentials and save controls', () => {
  const html = renderSettingsPanel({
    translationCredentials: { appId: '123', accessToken: 'token' },
    pluginSettings: { saveDirectory: '/tmp', saveTranslatedImage: true, confirmBeforeDelete: true, translationMode: 'auto' },
    uiSettings: { themeMode: 'system', windowHeight: 640, recordsColumnCount: 3 },
    themeStatus: '跟随 / 浅色',
    saveDirectoryWarning: '',
    translationCredentialWarning: '',
  })

  assert.match(html, /百度 AppID/)
  assert.match(html, /百度 Access Token/)
  assert.match(html, /选择保存目录/)
  assert.match(html, /返回记录页/)
})
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `node --test tests/public/panelRenderers.test.mjs`  
Expected: FAIL with renderSettingsPanel not found

- [ ] **Step 3: 实现 settings 页渲染**

必须覆盖：
- 凭证区
- 两个外链
- 翻译方向
- 保存配置
- 删除确认
- 界面偏好
- 返回记录页

- [ ] **Step 4: 在 app.js 接通 settings 的所有事件**

需要接通：
- `getTranslationCredentials/saveTranslationCredentials`
- `getPluginSettings/savePluginSettings`
- `getUiSettings/saveUiSettings`
- `pickSaveDirectory`
- `openSaveDirectory`
- `openExternalLink`

- [ ] **Step 5: 迁移 settings 样式**

重点：
- 信息条
- 字段区
- checkbox / select / input / slider
- 悬浮返回按钮

- [ ] **Step 6: 跑最相关测试**

Run: `node --test tests/public/panelRenderers.test.mjs tests/preload/localState.test.mjs tests/pluginSettings.test.mjs`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/app.css public/panel-renderers.js tests/public/panelRenderers.test.mjs
git commit -m "feat: 迁移设置页面到 jQuery 壳"
```

## Task 4: 完整迁移 result 页并清理临时壳逻辑

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel-renderers.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.css`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelRenderers.test.mjs`
- Test: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/tests/public/panelState.test.mjs`

- [ ] **Step 1: 补 result 页关键测试**

```js
test('result renderer prints retry, open settings and close actions', () => {
  const html = renderResultPanel({
    code: 'translation-failed',
    title: '翻译失败',
    message: '截图已经完成，但翻译步骤没有成功。',
    themeStatus: '跟随 / 浅色',
    showRetry: true,
    showOpenSettings: true,
    showClose: true,
  })

  assert.match(html, /翻译失败/)
  assert.match(html, /重试/)
  assert.match(html, /前往设置/)
  assert.match(html, /关闭/)
})
```

- [ ] **Step 2: 在 app.js 清掉临时占位渲染逻辑**

要求：
- records/settings/result 全部统一通过 `panel-renderers.js`
- 失败重试后成功时切回 records
- 失败重试后失败时继续停留 result

- [ ] **Step 3: 跑前端最相关测试**

Run: `node --test tests/public/panelState.test.mjs tests/public/panelRenderers.test.mjs tests/preload/localState.test.mjs`  
Expected: PASS

- [ ] **Step 4: 跑完整验证**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/app.css public/panel-renderers.js public/panel-state.js tests/public/panelState.test.mjs tests/public/panelRenderers.test.mjs
git commit -m "feat: 完成 jQuery 面板迁移"
```

## Self-Review

- Spec coverage:
  - records/settings/result 三个页面都有单独任务，覆盖本次迁移范围
  - 样式迁移、事件绑定、数据读写与构建验证都有对应步骤
- Placeholder scan:
  - 已避免使用 TBD/TODO
  - 代码步骤给了最小示例
- Type consistency:
  - 统一使用 `view/result` 面板状态
  - 统一围绕 `renderRecordsPanel / renderSettingsPanel / renderResultPanel`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-12-jquery-panel-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
