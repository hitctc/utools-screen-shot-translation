# 纯静态 jQuery 壳重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前插件从 `Vue + Vite` 运行壳切到纯静态 `HTML + jQuery + preload`，并先证明 `截屏翻译钉住` 入口在不显示白框的前提下能直接弹起官方截图。

**Architecture:** `run` feature 不再进入页面壳，而是通过 `public/preload/services.js` 的 `window.exports[feature].mode = 'none'` 直接启动主流程。页面层只保留 `records / settings / result` 三种承载面，由 `public/index.html + public/app.js + public/app.css` 组成，状态和业务能力继续走 `window.services` bridge。

**Tech Stack:** uTools plugin.json, preload CommonJS, 原生 HTML, 本地 jQuery, Node `node:test`, 本地构建脚本

---

## 文件结构

### 这轮新增文件

- Create: `public/app.js`
- Create: `public/app.css`
- Create: `public/vendor/jquery-3.7.1.min.js`
- Create: `scripts/build-static-plugin.mjs`
- Create: `tests/staticShell.test.mjs`
- Create: `tests/preload/runFeatureExports.test.mjs`

### 这轮修改文件

- Modify: `public/index.html`
- Modify: `public/plugin.json`
- Modify: `public/preload/services.js`
- Modify: `public/preload/workflow.cjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `tests/preload/localState.test.mjs`
- Modify: `tests/runFeaturePresentation.test.mjs`

### 这轮不进入运行路径但先不删除的文件

- Keep frozen: `src/**`
- Keep frozen: `vite.config.js`
- Keep frozen: `tests/app*.test.mjs`
- Keep frozen: `tests/entryFlow.test.mjs`

这些文件在第一轮不删，只退出运行路径，避免迁移和删除同时发生。

---

### Task 1: 建立纯静态运行壳

**Files:**
- Modify: `public/index.html`
- Create: `public/app.js`
- Create: `public/app.css`
- Create: `public/vendor/jquery-3.7.1.min.js`
- Test: `tests/staticShell.test.mjs`

- [ ] **Step 1: 写一个失败测试，锁定静态页面壳必须直接加载本地 jQuery 和 app.js**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('static shell only references local assets', () => {
  const html = readFileSync('public/index.html', 'utf8')
  assert.match(html, /vendor\\/jquery-3\\.7\\.1\\.min\\.js/)
  assert.match(html, /app\\.js/)
  assert.match(html, /app\\.css/)
  assert.doesNotMatch(html, /src\\/main\\.js/)
  assert.doesNotMatch(html, /https?:\\/\\//)
})
```

- [ ] **Step 2: 跑测试确认它先失败**

Run: `node --test tests/staticShell.test.mjs`  
Expected: FAIL，提示 `public/index.html` 还没有本地 jQuery/app.js/app.css 引用。

- [ ] **Step 3: 把 `public/index.html` 改成纯静态壳**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>截屏翻译并钉住</title>
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body data-view="idle">
    <div id="app">
      <section id="records-view" hidden></section>
      <section id="settings-view" hidden></section>
      <section id="result-view" hidden></section>
    </div>
    <script src="./vendor/jquery-3.7.1.min.js"></script>
    <script src="./app.js"></script>
  </body>
  </html>
```

- [ ] **Step 4: 新建最小 `app.js`，先只做静态视图切换骨架**

```js
(function () {
  const views = {
    records: $('#records-view'),
    settings: $('#settings-view'),
    result: $('#result-view'),
  }

  function showView(name) {
    Object.entries(views).forEach(([key, $view]) => {
      $view.prop('hidden', key !== name)
    })
    document.body.dataset.view = name
  }

  window.screenTranslationApp = {
    showView,
  }

  showView('records')
})()
```

- [ ] **Step 5: 新建最小 `app.css`，只保留现有页面基本布局兜底**

```css
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

#app {
  min-height: 100vh;
}
```

- [ ] **Step 6: 加入本地 jQuery 文件**

```text
路径: public/vendor/jquery-3.7.1.min.js
来源: jQuery 3.7.1 官方发布包
要求: 本地文件，不允许 CDN
```

- [ ] **Step 7: 跑测试确认静态壳通过**

Run: `node --test tests/staticShell.test.mjs`  
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add public/index.html public/app.js public/app.css public/vendor/jquery-3.7.1.min.js tests/staticShell.test.mjs
git commit -m "feat: 建立纯静态 jquery 页面壳"
```

---

### Task 2: 把 run feature 改成 preload 无 UI 入口

**Files:**
- Modify: `public/preload/services.js`
- Modify: `public/plugin.json`
- Test: `tests/preload/runFeatureExports.test.mjs`
- Test: `tests/preload/localState.test.mjs`
- Test: `tests/runFeaturePresentation.test.mjs`

- [ ] **Step 1: 写失败测试，锁定 `run` feature 必须通过 `window.exports` 暴露**

```js
import assert from 'node:assert/strict'
import test from 'node:test'

test('run feature is exposed via window.exports mode none', () => {
  global.window = { utools: { onPluginEnter() {} } }
  require('../public/preload/services.js')
  assert.equal(window.exports['screen-shot-translation-run'].mode, 'none')
  assert.equal(typeof window.exports['screen-shot-translation-run'].args.enter, 'function')
})
```

- [ ] **Step 2: 跑测试确认它先失败**

Run: `node --test tests/preload/runFeatureExports.test.mjs`  
Expected: FAIL，说明 `window.exports` 入口还没收干净。

- [ ] **Step 3: 在 `services.js` 里实现 run feature 的无 UI 入口**

```js
const RUN_FEATURE_CODE = 'screen-shot-translation-run'

function startRunFeatureWorkflow() {
  if (runningPreloadWorkflow) return
  runningPreloadWorkflow = true
  pendingWorkflowResult = null

  Promise.resolve(runCaptureTranslationPin())
    .then((result) => {
      if (result && result.ok === false) {
        pendingWorkflowResult = result
        emitWorkflowResult(result)
      }
    })
    .finally(() => {
      runningPreloadWorkflow = false
    })
}

window.exports = {
  ...(window.exports || {}),
  [RUN_FEATURE_CODE]: {
    mode: 'none',
    args: {
      enter: startRunFeatureWorkflow,
    },
  },
}
```

- [ ] **Step 4: 让 `onPluginEnter` 只继续服务 records/settings**

```js
function handlePreloadPluginEnter(event = {}) {
  const normalizedEvent = event && typeof event === 'object' ? event : {}

  if (normalizedEvent.code === RUN_FEATURE_CODE) {
    return
  }

  pendingPluginEnter = normalizedEvent
}
```

- [ ] **Step 5: 校验 `plugin.json` 仍然保持 `mainHide: true`**

```json
{
  "code": "screen-shot-translation-run",
  "mainHide": true,
  "cmds": ["截屏翻译钉住"]
}
```

- [ ] **Step 6: 跑测试确认 run 入口模型通过**

Run: `node --test tests/preload/runFeatureExports.test.mjs tests/preload/localState.test.mjs tests/runFeaturePresentation.test.mjs`  
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add public/preload/services.js public/plugin.json tests/preload/runFeatureExports.test.mjs tests/preload/localState.test.mjs tests/runFeaturePresentation.test.mjs
git commit -m "feat: 收口 run 无界面截图入口"
```

---

### Task 3: 把页面层缩成 records/settings/result 三视图

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`
- Test: `tests/staticShell.test.mjs`

- [ ] **Step 1: 写失败测试，锁定页面壳不再依赖 Vue 入口和 run 页面态**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('static shell only contains records settings result containers', () => {
  const html = readFileSync('public/index.html', 'utf8')
  assert.match(html, /id="records-view"/)
  assert.match(html, /id="settings-view"/)
  assert.match(html, /id="result-view"/)
  assert.doesNotMatch(html, /id="run-view"/)
})
```

- [ ] **Step 2: 跑测试确认它先失败**

Run: `node --test tests/staticShell.test.mjs`  
Expected: FAIL，如果页面壳里还残留旧结构。

- [ ] **Step 3: 在 `app.js` 里写最小视图调度**

```js
(function () {
  const services = window.services || null
  const state = {
    currentView: 'records',
    pendingFailure: null,
  }

  function renderRecords() {
    $('#records-view').text('记录页占位')
  }

  function renderSettings() {
    $('#settings-view').text('设置页占位')
  }

  function renderResult(result) {
    $('#result-view').text(result?.code || 'unknown-error')
  }

  function showView(name) {
    $('#records-view, #settings-view, #result-view').prop('hidden', true)
    $(`#${name}-view`).prop('hidden', false)
    state.currentView = name
  }

  function handlePluginEnter(event) {
    const code = event?.code
    if (code === 'screen-shot-translation-settings') {
      renderSettings()
      showView('settings')
      return
    }
    if (code === 'screen-shot-translation-records' || code === undefined) {
      renderRecords()
      showView('records')
      return
    }
  }

  window.screenTranslationApp = { handlePluginEnter, renderResult }
})()
```

- [ ] **Step 4: 让页面消费 preload 缓存的失败结果**

```js
const pendingWorkflowResult = services?.consumePendingWorkflowResult?.()
if (pendingWorkflowResult) {
  renderResult(pendingWorkflowResult)
  showView('result')
}

window.addEventListener('screen-shot-translation:workflow-result', (event) => {
  renderResult(event.detail)
  showView('result')
})
```

- [ ] **Step 5: 跑测试确认页面壳结构通过**

Run: `node --test tests/staticShell.test.mjs`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add public/index.html public/app.js tests/staticShell.test.mjs
git commit -m "feat: 收口静态页面三视图壳"
```

---

### Task 4: 接回 records/settings 的最小 bridge 消费

**Files:**
- Modify: `public/app.js`
- Modify: `public/app.css`
- Test: `tests/staticShell.test.mjs`

- [ ] **Step 1: 给记录页写最小渲染函数**

```js
async function renderRecords() {
  const manifest = await services?.listSavedRecords?.()
  const records = Array.isArray(manifest?.records) ? manifest.records : []
  const html = records.length
    ? records.map((record) => `<li data-record-id="${record.id}">${record.id}</li>`).join('')
    : '<p>暂无钉住记录</p>'
  $('#records-view').html(`<section class="records-shell"><div id="records-list">${html}</div></section>`)
}
```

- [ ] **Step 2: 给设置页写最小渲染函数**

```js
function renderSettings() {
  const pluginSettings = services?.getPluginSettings?.() || {}
  const credentials = services?.getTranslationCredentials?.() || {}
  $('#settings-view').html(`
    <section class="settings-shell">
      <div>AppID: ${credentials.appId || ''}</div>
      <div>Access Token: ${credentials.accessToken ? '已填写' : '未填写'}</div>
      <div>保存目录: ${pluginSettings.saveDirectory || '未设置'}</div>
    </section>
  `)
}
```

- [ ] **Step 3: 给结果页写最小按钮**

```js
function renderResult(result) {
  $('#result-view').html(`
    <section class="result-shell">
      <h1>处理失败</h1>
      <p>${result?.code || 'unknown-error'}</p>
      <button id="result-open-settings">进入设置</button>
      <button id="result-close">关闭</button>
    </section>
  `)
}
```

- [ ] **Step 4: 补最小事件绑定**

```js
$(document).on('click', '#result-open-settings', () => {
  renderSettings()
  showView('settings')
})

$(document).on('click', '#result-close', () => {
  renderRecords()
  showView('records')
})
```

- [ ] **Step 5: 跑一轮最相关构建验证**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add public/app.js public/app.css
git commit -m "feat: 接回记录设置结果最小静态壳"
```

---

### Task 5: 去掉 Vite 运行路径，建立纯静态构建

**Files:**
- Modify: `package.json`
- Create: `scripts/build-static-plugin.mjs`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写失败测试，锁定 build 不再依赖 Vite**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('package build script uses static plugin builder', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.match(pkg.scripts.build, /build-static-plugin\\.mjs/)
  assert.doesNotMatch(pkg.scripts.build, /vite build/)
})
```

- [ ] **Step 2: 跑测试确认它先失败**

Run: `node --test tests/staticShell.test.mjs`  
Expected: FAIL，如果 `package.json` 仍然依赖 `vite build`。

- [ ] **Step 3: 新建静态构建脚本**

```js
import { cpSync, mkdirSync, rmSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
cpSync('public', 'dist', { recursive: true })
```

- [ ] **Step 4: 调整 `package.json`**

```json
{
  "scripts": {
    "build": "node scripts/build-static-plugin.mjs",
    "test": "node --test tests/preload/*.test.mjs tests/*.test.mjs"
  }
}
```

- [ ] **Step 5: 更新 README 和 AGENTS**

```md
- 当前运行壳已切到 `public/index.html + public/app.js + public/app.css`
- `npm run dev` 不再作为主运行方式
- 调试应直接接入 `public/plugin.json`
```

- [ ] **Step 6: 跑构建验证**

Run: `npm run build`  
Expected: PASS，且 `dist/` 直接是静态插件目录结构。

- [ ] **Step 7: 提交**

```bash
git add package.json scripts/build-static-plugin.mjs README.md AGENTS.md
git commit -m "chore: 切换静态 jquery 插件构建路径"
```

---

### Task 6: 第一轮手动闭环验证

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 重载插件**

Run:

```bash
npm run build
```

然后在 uTools 开发者工具里：

1. 断开当前插件
2. 重新接入 `public/plugin.json`

- [ ] **Step 2: 验证 run 入口不再显示白框**

操作：

1. 输入 `截屏翻译钉住`
2. 观察是否直接弹起 uTools 官方截图

Expected:

- 不出现白色主窗口
- 官方截图工具直接弹起

- [ ] **Step 3: 验证失败结果承载**

操作：

1. 故意让翻译失败，例如清空凭证
2. 重新触发 `截屏翻译钉住`

Expected:

- 截图后失败时，主窗口才回来
- 页面显示最小结果页，不是白屏

- [ ] **Step 4: 更新文档中的运行说明**

```md
- 第一轮门禁：先证明“无白框 + 官方截图直起”
- 只有这两条通过，才进入翻译、钉图、保存接回阶段
```

- [ ] **Step 5: 提交**

```bash
git add README.md AGENTS.md
git commit -m "docs: 同步静态 jquery 主流程验证门禁"
```

---

## 计划自检

### 覆盖检查

- 已覆盖纯静态 jQuery 壳建立
- 已覆盖 run feature 的 preload 无 UI 入口
- 已覆盖页面壳缩成 records/settings/result
- 已覆盖静态构建脚本替代 Vite
- 已覆盖第一轮只验证“无白框 + 官方截图直起”

### 占位检查

- 无 `TODO`
- 无 `TBD`
- 无“后续补充”式空步骤

### 类型与边界检查

- `run` 入口始终只在 preload 直接启动
- `records/settings/result` 始终只在静态页面壳里显示
- 旧 `src/` 和 `vite.config.js` 只冻结，不在本计划里删除

