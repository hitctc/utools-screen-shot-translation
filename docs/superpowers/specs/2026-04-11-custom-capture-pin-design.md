# uTools Screen Shot Translation 自定义截图与原位钉住设计稿

## 1. 背景

当前主线已经回退到稳定版本：

- `设置` 可进入
- `钉住记录` 可进入
- `截屏翻译钉住` 可走 `uTools.screenCapture -> 百度翻译 -> 失败结果页`

这条分支的目标不是继续修改稳定主线，而是在独立分支上重新实现“拿到截图坐标并按原位置钉住”。

用户已经确认本轮第一版范围只支持：

- 鼠标所在屏幕
- 单屏截图选区
- 翻译成功后原位钉住

明确不在这轮范围内：

- 跨屏联合截图
- 多屏拼接截图
- 进程重启后恢复“当前已钉住”状态
- 把所有历史增强项一次性并回主线

## 2. 目标

这轮设计只解决 4 件事：

1. 自定义截图如何拿到真实选区坐标
2. 截图结果如何接到现有百度图片翻译链路
3. 翻译结果如何按原截图位置创建钉住窗口
4. 记录页如何复用钉住窗口能力做重钉

成功标准：

- 从 `截屏翻译钉住` 进入后，用户可以在当前鼠标所在屏幕框选区域
- 能得到准确的 `x / y / width / height`
- 百度翻译成功后，结果图片按同样位置和尺寸钉住到屏幕
- `钉住记录` 点击记录后也能按 `lastPinBounds` 重钉
- 同一张记录图已经钉住时，再点只提示，不重复创建窗口

## 3. 方案比较

### 3.1 方案 A：单屏冻结截图 + overlay 选区 + 原位钉住

做法：

- 在 preload 里读取鼠标所在屏幕信息
- 获取该屏幕的桌面缩略图
- 用 `utools.createBrowserWindow("capture-overlay.html", ...)` 打开全屏 overlay
- overlay 内部渲染冻结截图，让用户拖出选区
- overlay 回传裁切图和选区坐标
- 主流程继续翻译和钉住

优点：

- 与目标最一致
- 坐标最清晰
- 范围可控

缺点：

- 要维护一套截图子窗口交互

### 3.2 方案 B：overlay 只回传坐标，裁切在 preload 中完成

做法：

- overlay 只负责返回选区坐标
- preload 按原始大图和坐标自行裁切

优点：

- overlay 页面更轻

缺点：

- 图像裁切链路更复杂
- 主进程 / preload 调试难度更高

### 3.3 方案 C：继续官方截图，钉住时猜测位置

做法：

- 继续使用 `utools.screenCapture`
- 不拿真实坐标，只做默认位置钉住

优点：

- 实现最简单

缺点：

- 无法满足“原位置钉住”
- 与需求目标不一致

### 3.4 推荐

推荐方案 A。

原因：

- 它是满足需求的最小正确方案
- 选区、坐标、裁切图和钉住窗口职责边界清楚
- 可以先只做单屏，不把跨屏复杂度引进来

## 4. 架构设计

本轮在现有代码基础上增加两条独立运行链路：

1. 自定义截图链路
2. 钉住窗口链路

主流程编排仍然继续复用 `workflow.cjs`。

### 4.1 模块划分

- `public/preload/services.js`
  - 仍是前端唯一 bridge 入口
  - 在这条分支里重新把主流程切回自定义截图和真实钉住
- `public/preload/customCapture.cjs`
  - 负责单屏 overlay 截图
  - 返回截图图片和真实坐标
- `public/capture-overlay.html`
  - 负责截图选区 UI
  - 只运行在 browser window 中
- `public/preload/pinWindowManager.cjs`
  - 负责创建钉住窗口、拖动、关闭、重复钉住拦截
- `public/pin-window.html`
  - 负责渲染钉住图片和拖动交互
- `public/preload/recordStore.cjs`
  - 继续负责保存记录与 `lastPinBounds` 更新

### 4.2 边界约束

这轮必须遵守官方窗口能力约束：

- `createBrowserWindow(url, ...)` 的 `url` 使用本地相对 HTML 文件
- 不再给子窗口传开发服务器 URL

原因：

- 这是官方文档明确要求的方式
- 之前白屏问题已经证明在 uTools 里混用 dev server 子窗口 URL 风险很高

## 5. 数据流

## 5.1 主流程：截屏翻译钉住

1. 用户通过 `截屏翻译钉住` 进入插件
2. `services.runCaptureTranslationPin()` 调用 `customCapture.captureImageWithCustomOverlay()`
3. preload 根据鼠标位置拿到当前所在屏幕
4. 打开 `capture-overlay.html` 全屏窗口，覆盖该屏幕
5. 用户拖拽选区
6. overlay 返回：
   - `image`
   - `bounds`
7. `baiduPictureTranslate.translateCapturedImage()` 翻译图片
8. `pinWindowManager.pinTranslatedImage()` 按 `bounds` 创建钉住窗口
9. 如果开启保存，则 `recordStore.saveTranslatedRecord()` 写图片和 manifest
10. 再调用 `pinWindowManager.attachPinnedRecord()` 把活动窗口与记录 id 关联

## 5.2 记录页：重钉

1. 用户在 `钉住记录` 点击卡片
2. `services.repinSavedRecord(recordId)` 读取记录
3. 使用记录里的 `lastPinBounds`
4. 调用 `pinWindowManager.repinSavedRecordImage()`
5. 如果该记录已钉住：
   - 不重复创建窗口
   - 只给友好提示
6. 如果未钉住：
   - 创建新窗口
   - 复用原有钉住窗口交互

## 6. 自定义截图设计

## 6.1 屏幕范围

第一版只支持鼠标所在屏幕。

具体做法：

- 通过 uTools 当前鼠标位置能力拿到 `point`
- 通过显示器查询能力找到该点所在屏幕
- overlay 窗口只覆盖这一块屏幕的 bounds

## 6.2 overlay 页面职责

`capture-overlay.html` 只负责：

- 展示当前屏幕的冻结截图
- 响应鼠标按下、拖拽、抬起
- 画出选区蒙层
- 输出选区坐标
- 输出裁切后的图片
- 支持取消

它不负责：

- 调百度翻译
- 读写记录
- 创建钉住窗口

## 6.3 overlay 返回契约

建议保持稳定 shape：

```js
{
  ok: true,
  image: "data:image/png;base64,...",
  bounds: {
    x: 120,
    y: 80,
    width: 640,
    height: 320
  }
}
```

失败时：

```js
{
  ok: false,
  code: "capture-cancelled"
}
```

## 7. 钉住窗口设计

## 7.1 创建规则

翻译成功后，按截图选区的 bounds 创建独立窗口：

- `x = bounds.x`
- `y = bounds.y`
- `width = bounds.width`
- `height = bounds.height`

窗口表现：

- 无边框
- 始终置顶
- 不穿透点击
- 支持拖动
- 双击关闭

## 7.2 拖动和位置回写

窗口拖动时：

- 在窗口层内部记录拖动前位置
- 拖动结束后，以最终位置为准
- 如果这张图已经有 `recordId`，就回写 `lastPinBounds`

## 7.3 重复钉住拦截

同一条记录同一时刻只能存在一个活动窗口。

如果用户再次点击同一记录：

- 不创建第二个窗口
- 只提示：`该图片已经钉住，不能重复钉住。`

## 7.4 关闭行为

双击关闭时：

- 先保留当前最终位置
- 再关闭窗口
- 关闭后不删除记录

这样下次从记录页重钉时，仍然能回到关闭前位置。

## 8. 错误处理

本轮只保留 6 类关键失败：

- `capture-cancelled`
- `translation-config-invalid`
- `translation-failed`
- `pin-failed`
- `repin-failed`
- `save-failed`

原则：

- 截图失败只归因到截图
- 翻译失败只归因到翻译
- 钉住失败只归因到钉住
- 不把底层异常直接暴露到页面

## 9. 测试要求

本轮至少补这些自动化验证：

- `customCapture.cjs`
  - 无可用屏幕源时返回 `capture-cancelled`
  - 正常选区时返回 `image + bounds`
- `pinWindowManager.cjs`
  - 正常创建钉住窗口
  - 已钉住时返回 `already-pinned`
  - 拖动结束后会调用位置回写
- `services.js`
  - `runCaptureTranslationPin` 走自定义截图链路
  - `repinSavedRecord` 走真实重钉链路
- `workflow.cjs`
  - 继续保证 `capture -> translate -> pin -> save` 的失败归因不回退

手动 smoke test 至少覆盖：

1. `设置` 正常进入
2. `钉住记录` 正常进入
3. `截屏翻译钉住` 能打开单屏 overlay
4. 完成选区后能走翻译
5. 翻译成功后能原位钉住
6. 拖动关闭后，从记录页再次点开回到新位置
7. 已钉住状态下再次点击同一记录，只提示不重复钉住

## 10. 本轮不做

- 跨屏选区
- 多活动窗口恢复
- 进程重启后恢复“已钉住”状态
- 记录页大图预览
- 拖拽缩放钉住窗口
- 对自定义截图再加复杂工具栏

## 11. 实现建议

实现顺序建议固定为：

1. 恢复 `services.js` 到自定义截图分支形态，但只接单屏
2. 先让 `customCapture.cjs + capture-overlay.html` 单独跑通
3. 再接 `pinWindowManager.cjs + pin-window.html`
4. 再把翻译链路和保存链路串起来
5. 最后补 `repinSavedRecord` 和 manifest 位置回写

这样做的原因是：

- 截图拿坐标是最核心的新能力
- 先把截图和钉住各自跑通，再串流程，问题归因最清楚
