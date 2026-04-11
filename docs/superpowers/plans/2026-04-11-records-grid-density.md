# 记录页列数与卡片密度优化实现计划

日期：2026-04-11
分支：`feature/custom-capture-pin`
设计稿：`docs/superpowers/specs/2026-04-11-records-grid-density-design.md`

## 1. 实现目标

在不影响现有记录页删除、重钉和主流程的前提下，完成以下能力：

- `钉住记录` 页默认 `3` 列
- 顶部工具条提供滑块调节列数，范围 `3 ~ 6`
- 列数保存到 `UiSettings`
- 卡片视觉密度明显收紧，恢复更接近设计稿的瀑布流浏览体验

## 2. 实现步骤

### 步骤 1：扩展 UI 设置模型

文件：

- `src/screenTranslation/types.ts`
- `public/preload/localState.cjs`
- 若存在对应前端归一化文件，则同步更新

动作：

- 在 `UiSettings` 中新增 `recordsColumnCount`
- 增加默认值 `3`
- 在 preload 归一化里加入区间裁切 `3 ~ 6`
- 让 `saveUiSettings(partial)` 支持局部写入列数

验证：

- 更新 `tests/preload/localState.test.mjs`
- 如果已有前端归一化测试，则补默认值与非法值回退断言

### 步骤 2：把列数接到 App 状态

文件：

- `src/App.vue`

动作：

- 从 `UiSettings` 读取 `recordsColumnCount`
- 新增处理函数，用于响应记录页列数滑块更新
- 调整传给 `HomeView` 的 props / emits

验证：

- 保持现有记录刷新、删除、重钉逻辑不变
- 确认列数更新只影响 UI，不触发业务 warning

### 步骤 3：记录页增加工具条与滑块

文件：

- `src/screenTranslation/HomeView.vue`

动作：

- 在记录页标题区域下增加工具条
- 展示记录总数
- 增加 `range` 滑块，范围 `3 ~ 6`
- 展示实时文本 `N 列`
- 保留设置按钮

验证：

- 拖动滑块时触发事件
- 记录为空时仍保留合理布局，不出现工具条错位

### 步骤 4：收紧卡片和瀑布流样式

文件：

- `src/main.css`

动作：

- 用 CSS 变量驱动 `records-grid` 列数
- 调整 `record-card` 的 padding、间距、按钮区密度
- 去掉图片固定 `aspect-ratio`
- 增加合理的图片背景占位，避免图片加载抖动时完全塌陷
- 保留窄屏媒体查询的自动降列

验证：

- `3 / 4 / 5 / 6` 列视觉都可用
- 中小窗口下自动降到 `2 / 1` 列
- 删除、重钉按钮仍清晰可点

### 步骤 5：最小回归验证

命令：

- `npm test`
- `npm run build`

手动 smoke：

- 进入 `钉住记录`
- 默认看到 `3` 列
- 拖到 `6` 列后退出并重新进入，确认列数持久化
- 窄窗口下确认自动降列
- 删除 / 重钉功能继续可用

## 3. 风险与控制

### 风险 1：列数状态写入破坏现有 UI 设置

控制：

- 沿用现有 `UiSettings` 归一化模式
- 只增加一个新字段，不改旧字段语义

### 风险 2：去掉固定比例后图片高度过于跳跃

控制：

- 保留卡片背景和圆角
- 只移除固定比例，不改变图片 `width: 100%`
- 如果实际效果过散，再补最小 `max-height` 或 `object-fit` 微调

### 风险 3：窄窗口下 6 列导致布局崩坏

控制：

- 媒体查询继续强制降列
- 用户设置只作为桌面首选列数，不做全局强制
