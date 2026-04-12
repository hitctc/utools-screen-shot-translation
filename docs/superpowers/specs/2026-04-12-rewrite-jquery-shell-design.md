# 纯静态 jQuery 壳重写设计

## 1. 背景

当前仓库围绕 `Vue + Vite + preload + uTools` 已经叠加了多轮修补。实际结果是：

- `截屏翻译钉住` 入口既碰 `preload`，又碰 `App.vue`
- `run` 入口是否经过页面壳不清晰
- 主窗口显示 / 隐藏和业务流程耦合
- 每次修截图问题，都会牵动页面壳、入口分流、结果页和钉图逻辑

用户已经明确要求：

- 不再继续在当前链路上补丁
- 把项目从 `Vue` 形式改成 `uTools` 更常见的 `jQuery / 静态页面` 形态
- 重写完整业务逻辑，但不要顺手重写样式和配置模型
- 本轮优先把“截图入口正确、白框消失、主流程清晰”作为第一目标

## 2. 目标

本轮重写目标如下：

- 放弃当前 `Vue + Vite` 作为运行时页面壳
- 改成纯静态 `HTML + jQuery + preload bridge` 的 `uTools` 插件结构
- 保留现有 `plugin.json` feature 语义不变：
  - `截屏翻译钉住`
  - `钉住记录`
  - `设置`
- 让 `截屏翻译钉住` 彻底脱离主窗口页面壳，直接由 preload 启动
- 保持当前配置模型、记录模型和样式方向不变
- 先重建最小闭环，再逐层接回翻译、钉图、保存

## 3. 非目标

本轮明确不做以下内容：

- 不继续保留 `Vue` 作为运行时页面壳
- 不重做视觉样式和设计语言
- 不改当前设置字段语义
- 不改记录清单格式
- 不重写百度翻译 `V2` 的业务目标
- 不顺手做“原位钉回”
- 不做新的自定义截图 overlay
- 不在第一轮就删除旧的 `src/` 和 `vite.config.js`

## 4. 新运行结构

### 4.1 运行时只保留的前端壳

新运行时只保留以下页面侧文件：

- `public/index.html`
- `public/app.js`
- `public/app.css`
- `public/plugin.json`
- `public/preload/*.cjs`
- `public/preload/services.js`

运行时不再依赖：

- `src/main.js`
- `src/App.vue`
- `src/screenTranslation/*`
- `Vite dev server`

这些旧文件第一轮先退出运行路径，但不立刻删除。

### 4.2 页面技术栈

新页面壳只使用：

- 原生 HTML
- jQuery
- 少量原生 JS 状态管理

原则是：

- 不引入前端框架状态机
- 不再通过组件树承接 `run` 入口
- 页面逻辑尽量收在 `public/app.js`

## 5. 入口模型

### 5.1 截屏翻译钉住

`screen-shot-translation-run`

- 通过 preload 的 `window.exports[feature].mode = 'none'` 直接启动
- 不进入主窗口页面
- 不通过页面壳做任何中转
- 只在失败时才恢复主窗口并显示结果页

这条入口链路必须满足：

1. 触发时不出现白框
2. 官方 `screenCapture(callback)` 能直接弹起

### 5.2 钉住记录

`screen-shot-translation-records`

- 进入静态页面壳
- `app.js` 通过 `window.services.listSavedRecords()` 拉记录
- 页面默认渲染记录页

### 5.3 设置

`screen-shot-translation-settings`

- 进入静态页面壳
- `app.js` 通过 `window.services.getPluginSettings()`、`getTranslationCredentials()`、`getUiSettings()` 拉状态
- 页面默认渲染设置页

## 6. 页面职责

### 6.1 页面只保留三种承载面

静态页面只承接：

- `records`
- `settings`
- `result`

不再承接：

- `run` 主流程
- 截图启动
- 主窗口生命周期控制

### 6.2 页面职责边界

`public/app.js` 只负责：

- 视图切换
- 事件绑定
- 调用 `window.services`
- 结果页文案映射
- 记录页和设置页状态刷新

它不应负责：

- 截图流程
- 翻译流程
- 钉图流程
- 主窗口隐藏 / 恢复

## 7. 业务流程重建顺序

### 7.1 第一轮：最小闭环证明

只保留 3 个核心文件进入第一轮：

- `public/plugin.json`
- `public/preload/services.js`
- `public/index.html + public/app.js` 中的最小结果页承载逻辑

第一轮只验证两件事：

1. 触发 `截屏翻译钉住` 时绝不出现白框
2. 官方 `screenCapture(callback)` 能稳定弹起

这一轮不要求：

- 翻译成功
- 钉图成功
- 保存成功

只要求把入口模型打通。

### 7.2 第二轮：接回翻译

在第一轮成立后：

- 接回 `baiduPictureTranslate.cjs`
- 让 `run` 链路形成：
  - `capture`
  - `translate`
- 失败时进入结果页

### 7.3 第三轮：接回钉图

在翻译链路成立后：

- 接回 `pinWindowManager.cjs`
- 默认钉到当前屏幕右上角

### 7.4 第四轮：接回保存

在钉图成立后：

- 接回 `recordStore.cjs`
- 只有 `saveTranslatedImage === true && saveDirectory` 有效时才保存

## 8. preload 层边界

### 8.1 保留的业务层

本轮优先复用这些业务模块：

- `public/preload/workflow.cjs`
- `public/preload/baiduPictureTranslate.cjs`
- `public/preload/translationCredentialStore.cjs`
- `public/preload/recordStore.cjs`
- `public/preload/pinWindowManager.cjs`
- `public/preload/localState.cjs`

### 8.2 `services.js` 的职责

`public/preload/services.js` 只负责：

1. 暴露设置与记录 bridge
2. 暴露主流程 `runCaptureTranslationPin()`
3. 暴露 `window.exports` 的 feature 入口
4. 在失败时恢复主窗口并把失败结果交给页面

它不应继续承担：

- 自定义截图 overlay
- 多套截图策略切换
- 页面壳逻辑
- 临时调试分支和回退链路叠加

## 9. 旧代码处理策略

第一轮不直接删除旧代码：

- `src/`
- `vite.config.js`
- 相关 Vue 测试

处理方式是：

- 先退出运行路径
- 保留在仓库中，等静态 jQuery 版本跑稳后再清理

这样做的原因是：

- 避免迁移和删除同时发生
- 先把运行时切干净
- 再做仓库清理

## 10. 验证要求

### 10.1 第一轮自动化验证

至少覆盖：

- `plugin.json` 中 run feature 的无 UI 入口契约
- `services.js` 中 run feature 直接启动截图
- 失败结果缓存与页面消费桥接

### 10.2 第一轮手动 smoke test

只验证这两件事：

1. 输入 `截屏翻译钉住` 后，不显示主窗口白框
2. 官方截图工具直接弹起

只要这两条没有成立，就不进入翻译、钉图、保存阶段。

## 11. 风险

### 11.1 接受的短期风险

- 仓库短期内会同时存在 `Vue` 旧代码和 `jQuery` 新壳
- 自动化测试会有一段迁移期，需要同时覆盖新旧文件

### 11.2 当前不接受的风险

- 在现有 Vue 壳上继续叠补丁
- 一边迁移壳子一边大规模重写业务层
- 在第一轮就把翻译、钉图、保存全部并发接回

## 12. 预期收益

这次重写成功后，主流程会变得更直接：

- `run` 不再经过页面壳
- 截图问题和页面问题彻底拆开
- `records / settings / result` 只承担展示职责
- 后续 bug 定位会变成：
  - 入口问题查 `plugin.json / window.exports / services.js`
  - 页面问题查 `index.html / app.js`
  - 业务问题查 `workflow / translate / pin / recordStore`

这样比当前 `Vue + preload + 多轮补丁` 的结构更容易维护，也更符合当前功能复杂度。
