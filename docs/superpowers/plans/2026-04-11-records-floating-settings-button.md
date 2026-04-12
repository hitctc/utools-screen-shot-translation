# 记录页悬浮设置按钮实现计划

日期：2026-04-11
分支：`feature/custom-capture-pin`
设计稿：`docs/superpowers/specs/2026-04-11-records-floating-settings-button-design.md`

## 实现目标

在不影响记录页其他交互的前提下，把“设置”按钮改成右下角悬浮入口。

## 步骤

### 1. 调整模板结构

文件：

- `src/screenTranslation/HomeView.vue`

动作：

- 去掉页面流末尾的普通按钮行
- 增加独立的悬浮按钮容器

### 2. 增加悬浮样式

文件：

- `src/main.css`

动作：

- 为记录页增加底部安全留白
- 为悬浮按钮容器增加固定定位、层级和响应式边距

### 3. 验证

- `npm run build`
- 在 uTools 中确认按钮固定在右下角且不遮挡最后一排卡片
