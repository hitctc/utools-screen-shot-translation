# Settings Header Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧设置页顶部 hero 区块，并把“返回记录页”改成左上角悬浮按钮，同时保持现有返回行为和主题状态展示不变。

**Architecture:** 这次只动设置页模板和全局样式，不改 `App.vue`、preload、状态模型和设置项内容区。返回按钮继续复用当前 `emit('back')`，主题状态继续复用 `themeStatus`，因此这是一轮纯前端视图层精修。当前仓库没有 Vue 组件渲染测试基建，这次不引入新测试框架，自动验证以 `npm run build` 为准，行为回归通过最小手动 smoke 覆盖。

**Tech Stack:** Vue 3 SFC, Vite 6, CSS, Node `--test`（本次不新增组件级自动测试）

---

## File Map

- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`
  只调整设置页顶部 hero 的 DOM 结构，把“返回记录页”按钮移入 hero 左上角，并收紧说明文案区域。
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`
  为设置页 hero 增加紧凑布局和左上角悬浮按钮样式，保证浅色/深色主题表现一致。

## Implementation Notes

- 当前工作区存在与你这次无关的脏改，执行时只 stage 本计划涉及的两个文件。
- 不修改记录页、结果页和设置项卡片内容。
- 不新增路由、状态字段或 preload 桥接接口。

### Task 1: 调整设置页顶部模板结构

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`

- [ ] **Step 1: 先读当前设置页顶部模板，只锁定 hero 区块改动范围**

Run:

```bash
sed -n '1,140p' /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
```

Expected: 能看到当前 `settings-card settings-card--hero`、右上角 `themeStatus` 和正文里的“返回记录页”按钮，确认这次只改顶部区块。

- [ ] **Step 2: 把返回按钮移到 hero 左上角，保留原来的返回事件**

Update the hero block to this shape:

```vue
<header class="settings-card settings-card--hero settings-hero">
  <button
    type="button"
    class="secondary-button secondary-button--compact settings-hero__back"
    @click="emit('back')"
  >
    返回记录页
  </button>

  <div class="hero-card__eyebrow settings-hero__eyebrow">
    <p class="section-label">Screen Translation</p>
    <span class="status-chip">{{ themeStatus }}</span>
  </div>

  <div class="settings-hero__content">
    <h1>设置</h1>
    <p class="settings-copy">
      在这里维护当前已经接通的配置项，包括凭证、翻译方向、保存目录、主题和窗口高度。
    </p>
  </div>
</header>
```

Expected: “返回记录页”不再出现在正文动作区，而是在 hero 内部左上角，点击行为仍然是 `emit('back')`。

- [ ] **Step 3: 删除旧的正文按钮容器，避免顶部再次被动作区撑高**

Remove this block:

```vue
<div class="actions-row actions-row--settings">
  <button type="button" class="secondary-button secondary-button--compact" @click="emit('back')">
    返回记录页
  </button>
</div>
```

Expected: 设置页头部只保留一个返回入口，不会同时出现两个“返回记录页”按钮。

- [ ] **Step 4: 快速检查模板是否只影响设置页头部**

Run:

```bash
sed -n '1,120p' /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
```

Expected: 只有顶部 hero 结构变化，下面的凭证、翻译方向、保存目录、删除确认、主题和窗口高度卡片都未被误改。

- [ ] **Step 5: 提交模板结构调整**

Run:

```bash
git add /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
git commit -m "refactor: 收紧设置页顶部结构"
```

Expected: 只提交 `SettingsView.vue`，不带入其他脏改。

### Task 2: 增加紧凑 hero 样式并完成验证

**Files:**
- Modify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css`
- Verify: `/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue`

- [ ] **Step 1: 为设置页 hero 增加更紧凑的专属样式**

Add styles near the existing settings hero rules:

```css
.settings-hero {
  position: relative;
  gap: 12px;
  padding: 18px 20px 18px;
  overflow: hidden;
}

.settings-hero__back {
  position: absolute;
  top: 18px;
  left: 20px;
  z-index: 1;
  min-height: 38px;
  padding-inline: 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-strong) 90%, transparent);
}

.settings-hero__eyebrow {
  padding-left: 132px;
}

.settings-hero__content {
  display: grid;
  gap: 10px;
  max-width: 720px;
  padding-top: 6px;
}
```

Expected: hero 高度明显收紧，左上角有悬浮返回按钮，右上角状态 chip 不和按钮重叠。

- [ ] **Step 2: 收紧标题和说明文案的视觉密度**

Add or adjust these rules:

```css
.settings-hero h1 {
  font-size: clamp(28px, 4.6vw, 40px);
}

.settings-hero .settings-copy {
  max-width: 52ch;
  line-height: 1.55;
}
```

Expected: 标题依然醒目，但不会像当前版本那样把首屏撑得过高，说明文案长度也更克制。

- [ ] **Step 3: 给小窗口补一层避让，避免按钮压住正文**

Add a small-screen adjustment inside the existing responsive area:

```css
@media (max-width: 720px) {
  .settings-hero {
    padding-top: 64px;
  }

  .settings-hero__back {
    top: 16px;
    left: 16px;
  }

  .settings-hero__eyebrow {
    padding-left: 0;
    padding-right: 96px;
  }
}
```

Expected: 小宽度下返回按钮和右上角状态都能避开正文，标题不会被遮挡。

- [ ] **Step 4: 运行构建验证 SFC 和样式改动**

Run:

```bash
npm run build
```

Expected: `vite build` 和 `node scripts/prepare-dist-plugin.mjs` 全部成功，没有模板编译错误或样式导致的构建失败。

- [ ] **Step 5: 做最小手动 smoke，确认视觉和交互**

Run:

```bash
npm run dev
```

Then verify manually in uTools:

```text
1. 从“设置”入口进入插件
2. 确认顶部 hero 比原来明显更矮
3. 确认“返回记录页”在左上角悬浮显示
4. 点击“返回记录页”，确认回到记录页
5. 确认右上角主题状态仍正常显示
```

Expected: 设置项内容区更早进入首屏，同时返回逻辑和主题状态都保持原样。

- [ ] **Step 6: 提交样式和验证结果**

Run:

```bash
git add /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/main.css /Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/src/screenTranslation/SettingsView.vue
git commit -m "style: 优化设置页顶部布局"
```

Expected: 只提交这次设置页顶部优化涉及的两个文件。

## Self-Review

- Spec coverage:
  - 顶部区块收紧: Task 1 Step 2 + Task 2 Step 1/2
  - 左上角悬浮返回按钮: Task 1 Step 2/3 + Task 2 Step 1/3
  - 保留主题状态: Task 1 Step 2 + Task 2 Step 1/3
  - 不改设置项主体: Task 1 Step 4
  - 最小验证: Task 2 Step 4/5
- Placeholder scan: 本计划未使用 `TODO`、`TBD`、"适当处理" 这类占位表达。
- Type consistency: 只复用现有 `emit('back')` 和 `themeStatus`，没有引入新状态名或新接口。
