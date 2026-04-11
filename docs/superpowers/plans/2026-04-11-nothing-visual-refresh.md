# Nothing 风格样式收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前插件界面统一收口为深色优先、浅色同步的 Nothing 风格中文桌面工具界面，明确层级、减弱玻璃感和歧义展示。

**Architecture:** 这轮不改业务流程，只改样式 token、页面结构层级和关键组件呈现方式。实现顺序从全局字体与主题 token 开始，再落到记录页、设置页、结果页，最后统一按钮、卡片、滑块和状态标签的组件规则。

**Tech Stack:** Vue 3、Vite 6、原生 CSS、uTools 插件壳、Node built-in `node:test`

---

## 文件结构与职责

- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/index.html`
  - 注入 Google Fonts，提供 `Doto / Space Grotesk / Space Mono`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`
  - 重建全局 token、深浅主题、页面容器、卡片、按钮、滑块、状态标签和悬浮按钮样式
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
  - 收紧记录页头部说明和控制条层级，确保中文标签清晰
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
  - 把设置页分组结构调整到“翻译 / 保存 / 界面”三段式表达
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/ResultView.vue`
  - 统一结果页标题、失败码标签和动作区层级
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
  - 同步当前视觉风格、字体来源和主题色约束
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`
  - 同步协作者必须知道的字体、主题和页面层级规则

---

### Task 1: 注入字体并建立全局主题 token

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/index.html`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 写入字体加载代码**

在 `index.html` 的 `<head>` 里加入：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Doto:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: 重写根级 token**

在 `src/main.css` 的 `:root` 和 `:root[data-theme='dark']` 中，把当前暖色玻璃 token 改为：

```css
:root {
  color-scheme: light;
  --bg: #f5f5f2;
  --surface: #ffffff;
  --surface-muted: #efefec;
  --surface-strong: #ffffff;
  --border: #d6d6d2;
  --border-strong: #bdbdb7;
  --text-display: #000000;
  --text-primary: #111111;
  --text-secondary: #666666;
  --text-muted: #8d8d88;
  --accent: #d71921;
  --accent-strong: #b3131a;
  --accent-soft: rgba(215, 25, 33, 0.08);
  --danger: #d71921;
  --shadow: none;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #000000;
  --surface: #111111;
  --surface-muted: #1a1a1a;
  --surface-strong: #161616;
  --border: #242424;
  --border-strong: #363636;
  --text-display: #ffffff;
  --text-primary: #f2f2f2;
  --text-secondary: #9a9a9a;
  --text-muted: #6d6d6d;
  --accent: #d71921;
  --accent-strong: #f03a42;
  --accent-soft: rgba(215, 25, 33, 0.12);
  --danger: #d71921;
  --shadow: none;
}
```

- [ ] **Step 3: 统一全局字体与背景**

把 `body` 和基础文本样式改成：

```css
body {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Space Grotesk', 'PingFang SC', 'Helvetica Neue', sans-serif;
  background: var(--bg);
  text-rendering: optimizeLegibility;
}

.section-label,
.status-chip,
.record-card__order,
.record-card__action,
.range-meta {
  font-family: 'Space Mono', monospace;
}

.hero-card h1,
.settings-card h1 {
  color: var(--text-display);
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
}
```

- [ ] **Step 4: 去掉玻璃和大阴影**

把卡片基础容器统一改成：

```css
.hero-card,
.step-card,
.settings-card,
.result-card,
.state-card,
.settings-group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: none;
  backdrop-filter: none;
}
```

- [ ] **Step 5: 运行构建确认字体和样式可以打包**

Run: `npm run build`
Expected: PASS，`dist/` 正常生成，没有 CSS 语法错误

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.css
git commit -m "feat: 建立 Nothing 风格全局主题基线"
```

---

### Task 2: 重排记录页头部和控制区层级

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 收紧记录页头部文案结构**

把 `HomeView.vue` 头部的标签和说明改成中文优先、短句表达：

```vue
<div class="hero-card__eyebrow">
  <p class="section-label">钉住记录</p>
  <span class="status-chip">{{ themeStatus }}</span>
</div>
<h1>钉住记录</h1>
<p class="hero-copy">
  点击缩略图会按最后位置重新钉住，删除会按设置里的确认开关执行。
</p>
```

- [ ] **Step 2: 把控制条压缩成一行主次清晰的控制区**

把工具条模板调整为：

```vue
<div class="records-toolbar">
  <div class="records-toolbar__meta">
    <span class="section-label">记录总数</span>
    <strong class="records-toolbar__count">{{ records.length }} 条</strong>
  </div>

  <div class="records-toolbar__controls">
    <label class="records-toolbar__density" for="records-column-count">
      <span class="records-toolbar__density-label">列数</span>
      <input
        id="records-column-count"
        class="records-toolbar__slider"
        type="range"
        min="3"
        max="6"
        step="1"
        :value="recordsColumnCount"
        @input="handleColumnCountInput"
      />
      <span class="records-toolbar__density-value">{{ recordsColumnCount }} 列</span>
    </label>
  </div>
</div>
```

- [ ] **Step 3: 重写记录页头部和控制区样式**

在 `src/main.css` 中加入或替换为：

```css
.hero-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 12px;
  background: var(--surface);
}

.hero-card::after {
  display: none;
}

.hero-card h1,
.settings-card h1 {
  font-size: clamp(28px, 4.4vw, 40px);
  line-height: 1.04;
  letter-spacing: -0.03em;
}

.hero-copy,
.settings-copy {
  max-width: 56ch;
  font-size: 15px;
  line-height: 1.55;
}

.records-toolbar {
  display: grid;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.records-toolbar__controls {
  display: grid;
  gap: 8px;
}

.records-toolbar__density-value {
  color: var(--text-primary);
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.06em;
}
```

- [ ] **Step 4: 把滑块改轻，不再抢视觉**

```css
.records-toolbar__slider {
  width: 100%;
  height: 2px;
  accent-color: var(--accent);
}
```

- [ ] **Step 5: 运行构建验证**

Run: `npm run build`
Expected: PASS，记录页模板和 CSS 无编译错误

- [ ] **Step 6: Commit**

```bash
git add src/screenTranslation/HomeView.vue src/main.css
git commit -m "feat: 收紧记录页头部与控制区层级"
```

---

### Task 3: 重做记录卡片为更清晰的面板卡

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/HomeView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 保留卡片结构，但固定三段布局**

`HomeView.vue` 中的每张卡片保持为：

```vue
<article v-for="record in records" :key="record.id" class="record-card">
  <button type="button" class="record-card__preview" @click="emit('repin-record', record.id)">
    <img class="record-card__image" :src="record.imagePath" :alt="record.orderLabel" />
    <span class="record-card__overlay">
      <span class="record-card__order">{{ record.orderLabel }}</span>
      <span class="record-card__action">重钉</span>
    </span>
  </button>

  <div class="record-card__meta">
    <span>{{ record.orderLabel }}</span>
    <span>{{ record.createdAtLabel }}</span>
  </div>

  <div class="record-card__actions">
    <button type="button" class="secondary-button secondary-button--compact" @click="emit('repin-record', record.id)">
      重新钉住
    </button>
    <button type="button" class="secondary-button secondary-button--compact secondary-button--danger" @click="emit('delete-record', record.id)">
      删除
    </button>
  </div>
</article>
```

- [ ] **Step 2: 提高缩略图区可读性**

把缩略图和卡片样式改成：

```css
.records-grid {
  column-gap: 12px;
}

.record-card {
  break-inside: avoid;
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
}

.record-card__preview {
  position: relative;
  overflow: hidden;
  display: block;
  width: 100%;
  min-height: 168px;
  border-radius: 12px;
  background: var(--surface-muted);
}

.record-card__image {
  display: block;
  width: 100%;
  min-height: 168px;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 3: 把叠层和信息区做薄**

```css
.record-card__overlay {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.72) 100%);
  color: #ffffff;
}

.record-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-secondary);
  font-family: 'Space Mono', monospace;
  font-size: 12px;
}

.record-card__actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 4: 把按钮收轻**

```css
.secondary-button {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
}

.secondary-button--compact {
  min-height: 34px;
  padding-inline: 12px;
  border-radius: 999px;
  font-size: 13px;
}

.secondary-button--danger {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border-strong));
  color: var(--accent);
}
```

- [ ] **Step 5: 运行构建验证**

Run: `npm run build`
Expected: PASS，记录卡片结构和按钮样式正常打包

- [ ] **Step 6: Commit**

```bash
git add src/screenTranslation/HomeView.vue src/main.css
git commit -m "feat: 重做记录卡片展示层级"
```

---

### Task 4: 把设置页重排为三段式配置面板

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 把设置页标题区收紧**

把 `SettingsView.vue` 头部文案改成：

```vue
<div class="hero-card__eyebrow">
  <p class="section-label">设置</p>
  <span class="status-chip">{{ themeStatus }}</span>
</div>
<h1>设置</h1>
<p class="settings-copy">
  这里集中管理翻译、保存和界面配置。
</p>
```

- [ ] **Step 2: 调整设置页卡片说明，形成三段式结构**

把主要分组文案收口为：

```vue
<p class="group-title">翻译配置</p>
<p class="group-copy">填写百度图片翻译凭证，并选择当前翻译方向。</p>

<p class="group-title">保存配置</p>
<p class="group-copy">控制结果是否保存、保存到哪里，以及删除时是否需要确认。</p>

<p class="group-title">界面配置</p>
<p class="group-copy">调整主题模式、窗口高度和展示偏好。</p>
```

- [ ] **Step 3: 调整设置页卡片样式**

```css
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
}

.settings-card__header {
  display: grid;
  gap: 8px;
}

.group-title {
  font-size: 20px;
  line-height: 1.1;
}

.group-copy {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}
```

- [ ] **Step 4: 保留右下角悬浮返回按钮，但弱化权重**

```css
.settings-floating-action__button {
  min-width: 96px;
  min-height: 48px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
}
```

- [ ] **Step 5: 运行构建验证**

Run: `npm run build`
Expected: PASS，设置页结构和样式正常打包

- [ ] **Step 6: Commit**

```bash
git add src/screenTranslation/SettingsView.vue src/main.css
git commit -m "feat: 重排设置页分区与返回入口"
```

---

### Task 5: 统一结果页、状态标签与动作层级

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/ResultView.vue`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`

- [ ] **Step 1: 收紧结果页标题和辅助文案**

保持 `ResultView.vue` 的数据流不变，只把文案承载结构整理为：

```vue
<header class="result-card">
  <div class="hero-card__eyebrow">
    <p class="section-label">结果</p>
    <span class="status-chip">{{ themeStatus }}</span>
  </div>
  <h1>{{ title }}</h1>
  <p class="settings-copy">{{ message }}</p>
</header>
```

- [ ] **Step 2: 弱化失败码标签**

```css
.status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
}
```

- [ ] **Step 3: 统一结果页动作按钮轻重**

```css
.primary-button {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.primary-button:hover:not(:disabled),
.secondary-button:hover:not(:disabled) {
  border-color: var(--accent);
  transform: none;
}
```

- [ ] **Step 4: 运行构建验证**

Run: `npm run build`
Expected: PASS，结果页样式调整不影响 Vue 构建

- [ ] **Step 5: Commit**

```bash
git add src/screenTranslation/ResultView.vue src/main.css
git commit -m "feat: 统一结果页与状态标签样式"
```

---

### Task 6: 更新文档并做最终验证

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/README.md`
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/AGENTS.md`

- [ ] **Step 1: 更新 README 里的视觉风格说明**

在 `README.md` 中补充：

```md
- 当前界面风格已收口为 Nothing 风格的中文桌面工具表达
- 深色模式作为第一优先基线，浅色模式同步维护
- 全局字体使用 Doto / Space Grotesk / Space Mono
- 主题强调色统一为 #d71921
```

- [ ] **Step 2: 更新 AGENTS.md 的协作约束**

在 `AGENTS.md` 中补充：

```md
- 当前界面样式以 Nothing 风格为基线，深色优先，浅色同步
- 字体加载依赖 Doto / Space Grotesk / Space Mono
- 按钮、状态标签和卡片统一走轻量边框方案，不再使用玻璃拟态和厚重阴影
```

- [ ] **Step 3: 运行全量验证**

Run: `npm test`
Expected: PASS，已有测试不回归

Run: `npm run build`
Expected: PASS，构建通过

- [ ] **Step 4: 手动 smoke 清单**

在 uTools 中手动验证：

```text
1. 记录页深色模式：标题、控制条、卡片和按钮风格统一
2. 记录页浅色模式：不是纯白反色，而是暖白纸面表达
3. 记录卡片缩略图区比当前更清楚，不再被压得过薄
4. 设置页三段式分组清晰，返回记录页按钮在右下角悬浮
5. 结果页主次关系明确，失败码标签不抢眼
```

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: 同步 Nothing 风格视觉约束"
```

---

## Self-Review

- **Spec coverage:** 已覆盖字体加载、深浅主题、记录页、设置页、结果页、卡片、按钮、标签、滑块和文档同步，没有遗漏 spec 主要求。
- **Placeholder scan:** 计划中没有 `TODO`、`TBD` 或“自行实现”类占位语句，每个任务都给了明确文件、代码片段和命令。
- **Type consistency:** 本计划不新增业务类型，不改数据契约；组件和样式类名均基于当前仓库已有结构，保持 `HomeView.vue / SettingsView.vue / ResultView.vue / main.css` 的命名一致。
