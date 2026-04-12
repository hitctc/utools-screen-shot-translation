# 截屏翻译主流程重写设计

## 1. 背景

当前分支围绕“自定义截图 + 百度图片翻译 V2 + 原位钉图”已经叠加了多轮修补。实际结果是主链路复杂度持续上升，截图、翻译、钉图、主窗口生命周期彼此耦合，导致排查和修复成本越来越高。

本轮目标不是继续补丁，而是把 `截屏 -> 翻译 -> 钉图` 这条主流程按最小闭环重新定义。页面样式、设置页布局、记录页展示和现有配置模型都不作为本轮重写范围。

## 2. 目标

本轮只重写主流程业务逻辑，目标如下：

- 把主流程收口成清晰的 4 步：
  - 截图
  - 翻译
  - 钉图
  - 保存
- 截图统一使用 `uTools` 官方 `screenCapture(callback)`。
- 翻译统一使用当前已经接通的百度图片翻译 `V2`。
- 钉图成功后默认出现在当前屏幕右上角。
- 保留记录页、设置页、结果页作为现有承载面，不重写 UI 样式和配置结构。
- 去掉当前主流程里与自定义截图、原位钉回、多层 fallback 和重复窗口控制相关的冗余逻辑。

## 3. 非目标

本轮明确不做以下内容：

- 不做自定义截图 overlay
- 不做按原截图选区位置精确钉回
- 不做多屏联合截图
- 不重写记录页 UI
- 不重写设置页 UI
- 不改主题系统
- 不改保存目录和总清单格式
- 不改 3 个 feature 入口的对外语义
- 不继续扩张百度 `V2` 的复杂回填分支

## 4. 新主流程

### 4.1 入口

用户触发 `截屏翻译钉住` 后：

1. 插件进入 `run` 主流程
2. 主窗口不承担业务展示，只负责在失败时回到结果页
3. 直接调用 `utools.screenCapture(callback)`

### 4.2 截图

截图阶段统一行为：

- 使用 `utools.screenCapture(callback)`
- 用户完成截图后拿到截图图片 `base64 data url`
- 用户取消截图时返回 `capture-cancelled`

本轮不再追踪截图坐标，不再持有选区矩形。

### 4.3 翻译

翻译阶段统一行为：

- 只走百度图片翻译 `V2`
- 只依赖设置页同步的 `AppID / Access Token`
- 翻译输入是截图得到的图片 `base64`
- 翻译输出必须收口成“最终可展示图片”

失败类型统一为：

- `translation-config-invalid`
- `translation-failed`

### 4.4 钉图

钉图阶段统一行为：

- 钉住窗口默认出现在当前屏幕右上角
- 默认右边距和上边距为固定值，例如 `24px`
- 窗口大小按翻译结果图尺寸显示
- 用户可拖动
- 双击关闭保留

如果记录重钉：

- 有历史位置时优先回到历史位置
- 没有历史位置时回到默认右上角

失败类型统一为：

- `pin-failed`

### 4.5 保存

保存阶段统一行为：

- 仅当 `saveTranslatedImage === true` 且 `saveDirectory` 有效时执行
- 保存翻译结果图片
- 写入或更新总清单 `.screen-translation-records.json`
- 如果窗口后续被拖动或关闭，继续更新该条记录的最后位置

失败类型统一为：

- `save-failed`

本轮第一版中，保存失败按整条主流程失败处理，不做“钉图成功但保存失败继续静默”的分叉。

## 5. 模块边界

### 5.1 保留的模块

- `src/App.vue`
  继续负责 feature 入口分流、记录页、设置页、结果页
- `public/preload/services.js`
  继续作为唯一 bridge 出口
- `public/preload/translationCredentialStore.cjs`
  继续负责百度凭证存取
- `public/preload/recordStore.cjs`
  继续负责记录保存、删除、位置更新
- `public/preload/pinWindowManager.cjs`
  继续负责钉住窗口创建、关闭、拖动和重钉

### 5.2 主流程核心模块

本轮主流程建议只保留两个核心实现模块：

- `public/preload/workflow.cjs`
  只负责编排：
  - `capture`
  - `translate`
  - `pin`
  - `save`
- `public/preload/baiduPictureTranslate.cjs`
  只负责：
  - 收图
  - 调百度图片翻译 `V2`
  - 返回最终可展示图片

### 5.3 退出主路径的模块

以下模块不再参与主流程：

- `public/preload/customCapture.cjs`
- 任何服务于“自定义选区 + 原位钉回”的旧主路径逻辑

`public/preload/baiduPictureCompose.cjs` 如果仍需保留，也只能作为 `baiduPictureTranslate.cjs` 内部实现细节，不能再反向控制主流程的截图、窗口生命周期或结果页行为。

## 6. services 层重写要求

`public/preload/services.js` 在本轮重写后只承担三类职责：

1. 暴露设置和记录相关能力
2. 暴露 `runCaptureTranslationPin()`
3. 做最小窗口生命周期控制

它不应继续承担：

- 自定义截图流程编排
- 多层截图兜底
- 翻译策略分叉决策
- 与钉图实现互相穿透的临时诊断逻辑

## 7. App 层要求

`src/App.vue` 在主流程重写后应满足：

- `run` 入口只负责触发 `window.services.runCaptureTranslationPin()`
- 成功时不展示页面
- 失败时进入结果页
- 不再把主流程细节散落在视图切换逻辑里

`App.vue` 不应继续承担：

- 主流程内部的窗口隐藏策略
- 截图链路控制
- 钉住链路控制

## 8. 失败策略

本轮只保留统一失败面：

- `capture-cancelled`
- `translation-config-invalid`
- `translation-failed`
- `pin-failed`
- `save-failed`

所有失败都进入当前已有的结果页承载，不增加新的业务承载面。

## 9. 验证要求

本轮实现完成后至少需要覆盖：

### 9.1 自动化验证

- `workflow.cjs` 主路径编排测试
- `services.js` 主流程桥接测试
- `recordStore.cjs` 保存和位置更新测试
- `pinWindowManager.cjs` 默认右上角钉图测试
- `npm run build`

### 9.2 手动 smoke test

1. `设置` 页面填写 `AppID / Access Token`
2. 触发 `截屏翻译钉住`
3. 使用官方截图完成一张截图
4. 翻译成功后，结果图默认出现在右上角
5. 拖动后关闭，再从 `钉住记录` 重钉，确认优先回到上次位置
6. 开启保存时，确认记录页和保存目录都能看到结果
7. 任一步失败时，确认进入统一结果页

## 10. 预期收益

本轮重写的收益不是增加新能力，而是把主流程重新压回清晰边界：

- 截图逻辑更简单
- 主窗口生命周期更容易理解
- 翻译链路更集中
- 钉图位置规则明确
- 保存策略单一
- 后续继续修 bug 时不需要再跨截图、翻译、钉图三层同时定位
