# utools-screen-shot-translation 协作文档

## 1. 文档目标

这份 `AGENTS.md` 用来约束本项目内的协作方式，优先级高于上层那些不够贴近本仓库现状的通用规则。

它主要解决四件事：

- 让进入仓库的协作者先快速知道这个项目现在做到哪一步、怎么运行、主要代码在哪。
- 让后续改动优先沿着当前“截屏 -> 翻译 -> 钉图”骨架继续推进，而不是回退成模板式试验代码。
- 让协作者明确当前已实现能力、当前限制和下一步边界，避免把未来目标误当成现状。
- 让 `AGENTS.md` 跟着代码一起维护，不变成过期说明。

官方开发文档入口：

- 快速开始：[`https://www.u-tools.cn/docs/developer/basic/getting-started.html`](https://www.u-tools.cn/docs/developer/basic/getting-started.html)
- 文档中心：[`https://www.u-tools.cn/docs/developer/welcome.html`](https://www.u-tools.cn/docs/developer/welcome.html)
- 基础 / API 索引：[`https://www.u-tools.cn/docs/developer/docs.html`](https://www.u-tools.cn/docs/developer/docs.html)
- `dbStorage`：[`https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html`](https://www.u-tools.cn/docs/developer/api-reference/db/db-storage.html)
- `setExpendHeight` / 窗口能力：[`https://www.u-tools.cn/docs/developer/api-reference/utools/window.html`](https://www.u-tools.cn/docs/developer/api-reference/utools/window.html)
- 系统能力：[`https://www.u-tools.cn/docs/developer/utools-api/system.html`](https://www.u-tools.cn/docs/developer/utools-api/system.html)

后续凡是涉及 `uTools API`、`plugin.json`、`preload`、接入开发、打包、发布、部署配置、启动方式等问题，优先查官方开发文档，不凭记忆臆断。

调试与问题分析的输出约定：

- 以后在本项目里做问题定位、实验记录和修复说明时，统一使用中文结构标题：
  - `问题假设`
  - `已做实验`
  - `最小修复方案`
- 不再混用 `Hypotheses`、`Experiments` 这类英文关键词，除非是在引用外部原文或 API 字段名。

## 2. 项目当前定位

- 项目名称：`utools-screen-shot-translation`
- 目标方向：做成一个在 `uTools` 内完成“截屏 -> 翻译 -> 钉图结果”的工具
- 当前阶段：当前分支 `rewrite-jquery-shell` 正在把运行壳切到“uTools 模板插件 + 静态 `HTML + jQuery + preload`”；当前主路径已收口为“官方截图 -> 百度图片翻译 -> 默认钉图 -> 按条件保存”
- 当前真实能力：
  - 插件身份已经切换为 `uTools Screen Shot Translation`
  - `public/plugin.json` 已定义 3 个入口：
    - `screen-shot-translation-peg-run` -> `截屏翻译钉图`
    - `screen-shot-translation-peg-records` -> `钉图记录`
    - `screen-shot-translation-settings` -> `设置`
  - `钉图记录` 页面已从保存目录总清单读取记录并渲染瀑布流卡片，默认 4 列，支持在右下角操作组中上拉选择 3 / 4 / 5 列并持久化；点击图片会在当前页打开预览层，遮罩层内常驻 `删除 / 重钉图` 两个文字动作
  - `设置` 页面已承载翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度
  - 设置页已可填写百度图片翻译 `AppID / Access Token`
  - `失败结果页` 已承载主流程失败、重钉图失败和未知失败码的统一文案与动作
  - 支持 `跟随系统 / 深色 / 浅色` 三态主题
  - 支持在系统主题变化时同步刷新页面主题和状态文案
  - 支持通过 `dbStorage` 持久化 UI 设置和插件设置
  - 支持调整主插件窗口高度，并在重新进入插件时恢复
  - `public/panel.html + public/app.js + public/app.css + public/panel-state.js` 已接管 `钉图记录 / 设置 / 失败结果` 的运行壳
  - 插件设置模型已切到 `translationMode / saveTranslatedImage / saveDirectory / confirmBeforeDelete`，`preload` 侧已完成归一化和测试收口
  - `public/preload/recordStore.cjs` 已接通保存目录总清单的读取、整理、保存、删除和最后钉图位置更新
  - `public/preload/baiduPictureTranslate.cjs` 已接通百度图片翻译请求发送、自动方向选择，以及 `V2` 块级回填优先的本地拼图
  - `public/preload/translationCredentialStore.cjs` 已接通百度凭证同步文档的读取与更新
  - 已钉图窗口支持按鼠标指针中心进行滚轮缩放，macOS 下支持双指缩放，并会记住上次缩放后的大小
- 已钉图窗口在聚焦时支持 `Cmd/Ctrl + C` 直接把当前图片复制到系统剪切板，复制的是位图不是文件路径；复制成功后会在窗口内显示短暂轻反馈
- 已钉图窗口在聚焦时支持按 `ESC` 直接关闭当前这张图片；不做全局快捷键关闭
  - `public/preload/services.js` 已暴露 `pickSaveDirectory / listSavedRecords / deleteSavedRecord / repegSavedRecord / runCaptureTranslationPin`
- 当前明确限制：
  - 真实翻译当前只走百度图片翻译 `V2`，读取设置页同步的 `AppID / Access Token`；`V2` 优先使用块级 `contents[].paste_img` 在本地重新拼译后图，开发态仍支持环境变量兜底
  - 当前主流程截图统一走 `utools.screenCapture(callback)`，因此暂不支持“按截图原位置钉回”
  - 首次钉图默认落到当前屏幕左上角；只有记录重钉图时才优先回到上次保存的位置
  - “当前哪些图片已钉图”只保存在插件进程内存里；插件进程结束后，只保留 manifest 中的最后位置
- 当前技术栈：运行时已切到 `静态 HTML + jQuery + preload + Node built-in node:test`；旧 `Vue / Vite` 代码已从仓库主线清理，不再保留双轨运行壳
- 当前视觉基线：Nothing 风格中文桌面工具表达，深色优先、浅色同步，主题强调色固定为 `#d71921`
- 当前界面字体：`Doto / Space Grotesk / Space Mono`
- 当前运行模型：
  - `screen-shot-translation-peg-run / peg-records / settings` 三个入口都由 `public/preload/services.js` 里的 `window.exports[feature].mode = 'none'` 接管
  - `screen-shot-translation-peg-run` 直接在 preload 启动主流程，不再经过页面壳
  - `screen-shot-translation-peg-records / settings` 会通过 `utools.createBrowserWindow('panel.html?...')` 打开静态面板窗口
  - `public/panel.html + public/app.js + public/panel-state.js` 只负责 `records / settings / result` 的静态 UI 承载
  - `public/preload/services.js` 通过 `window.services` 暴露当前正式保留的设置、记录、目录选择和主流程桥接能力
  - `public/preload/localState.cjs` 负责 UI 设置和插件设置的归一化
  - 不再保留旧 `src/` 和 `vite.config.js`，后续协作不要再按 Vue/Vite 双轨模型理解当前仓库

当前仓库已经进入真实“截屏 -> 翻译 -> 钉图”闭环阶段，但多屏选区、进程外钉图状态恢复这些增强能力仍未完成。不要把这些增强项误说成已支持。
当前界面不要再往玻璃拟态、厚阴影或大渐变方向扩散；样式层级优先靠排版、边框和间距控制。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，当前按模板插件模型工作：不再配置 `main`，只保留 `preload`、`pluginSetting` 和 3 个 `features`。
- `public/panel.html`
  当前静态面板窗口壳，承载 `钉图记录 / 设置 / 失败结果` 三种视图。
- `public/app.js`
  当前面板窗口的 jQuery 事件绑定与最小状态切换入口。
- `public/app.css`
  当前静态面板窗口样式文件。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/services.js`
  负责桥接 `utools.dbStorage`、`utools.db`、目录选择、记录读取/保存/删除、官方截图入口、百度翻译入口和真实钉图/重钉图，并通过 `window.services` 暴露前端可消费的接口。三个 feature 入口都在这里通过 `window.exports` 以无 UI 模式接管，不应再依赖渲染层页面壳子。
- `public/preload/panel-preload.js`
  面板窗口专用 preload，把 `services.js` 和面板初始化事件桥接给 `public/panel.html`。
- `public/preload/baiduPictureTranslate.cjs`
  负责百度图片翻译的图片解码、请求发送、自动方向选择，以及 `V2` 块级译文的本地拼图回填。
- `public/preload/baiduPictureCompose.cjs`
  负责把百度图片翻译 `V2` 返回的块级 `paste_img` 和原截图背景重新拼成最终位图，继续供钉图与保存链路复用。
- `public/preload/translationCredentialStore.cjs`
  负责百度凭证同步文档的读取、归一化和更新。
- `public/preload/localState.cjs`
  负责 UI 设置与插件设置的归一化规则，包括主题模式、窗口高度、记录页列数，以及翻译保存相关的 `translationMode`、`saveTranslatedImage`、`saveDirectory` 和 `confirmBeforeDelete`。
- `public/preload/recordStore.cjs`
  负责保存目录根目录下总清单文件 `.screen-translation-records.json` 的读、写、整理、删除和最后钉图位置更新。
- `public/preload/pegImageWindowManager.cjs`
  负责真实钉图窗口的创建、拖动、缩放、重复钉图前台提醒，以及 `lastPegBounds` 的持续回写。
- `public/preload/workflow.cjs`
  负责主流程 `capture -> translate -> peg -> save` 的失败归因和统一返回契约，当前会透传步骤返回的明确失败码。
- `tests/preload/localState.test.mjs`
  负责当前 `preload` 正式保留的设置归一化与读写合并语义测试，包括目录选择、同步凭证桥接、官方截图桥接、真实重钉图桥接和局部更新持久化。
- `tests/preload/translationCredentialStore.test.mjs`
  负责百度凭证同步文档的读写与局部更新测试。
- `tests/preload/recordStore.test.mjs`
  负责保存目录总清单的读写、清理、保存、删除、位置回写和路径安全边界测试。
- `tests/preload/workflow.test.mjs`
  负责主流程编排、失败归因和 `capture -> translate -> peg -> save` 参数传递测试。
- `tests/preload/theme.test.mjs`
  负责主题模式解析、状态文案和系统主题响应式同步测试。
- `tests/panelState.test.mjs`
  负责静态面板状态辅助函数的最小单测，包括设置归一化、失败文案映射、记录映射和列分配。
- `dist/`
  构建产物目录；`npm run build` 后会把 `public/` 直接同步到 `dist/`，供 uTools 实际加载。
- `scripts/build-static-plugin.mjs`
  当前唯一构建脚本，负责把 `public/` 同步为运行中的静态插件产物。
- `docs/superpowers/specs/`
  保存本轮功能设计稿。
- `docs/superpowers/plans/`
  保存本轮实现计划。

## 4. 当前能力与入口约定

当前插件能力全部由 `public/plugin.json` 中的 `features` 决定，并且必须和 `public/preload/services.js` 里的 `window.exports` 保持同步。

当前已定义的 feature：

- `screen-shot-translation-peg-run`
  通过 `截屏翻译钉图` 进入插件，执行主流程入口。当前主路径会走 `官方截图 -> 百度图片翻译 -> 默认左上角钉图 -> 按条件保存`，并且 `feature.mainHide` 已开启，不应主动把主窗口顶到前台。
- `screen-shot-translation-peg-records`
  通过 `钉图记录` 进入记录页，展示已保存目录中的总清单记录。
- `screen-shot-translation-settings`
  通过 `设置` 进入设置页。

当前关键约定：

- 如果新增或重命名 `feature.code`，必须同步更新：
  - `public/plugin.json`
  - `public/preload/services.js`
  - `public/panel.html / public/app.js`
  - `README.md` 与 `AGENTS.md`
- 所有需要 Node.js 权限的能力，优先放到 `public/preload/`，再通过 `window.services` 给前端使用；不要把系统能力直接散落到渲染层各处。
- 当前 UI 不再使用 `vue-router`，也不再依赖 Vue 主窗口壳；records / settings / result 的视图切换全部在 `public/app.js` 内以最小状态机维护。
  当前约束是：`run` 首次进入不应主动把主窗口顶到前台；官方截图主流程必须由 preload 的无 UI feature handler 直接触发，静态面板窗口不能承担启动截图的职责。
- 当前记录页、结果页和设置页已经是正式承载面；当前分支主流程里的截图、翻译、钉图与记录重钉图都是真实能力。后续如果改这条链路，必须明确是增强还是回归修复。

## 5. 运行与验证

首次进入仓库先确认依赖状态。当前工作区可能没有安装依赖，不要默认 `node_modules` 已存在。

常用命令：

- 安装依赖：`npm install`
- 单测：`npm test`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

当前开发方式约定：

- `npm run dev` 和 `npm run build` 当前都走静态复制脚本
- `public/plugin.json` 已不再配置 `main` 和 `development.main`
- 用 uTools 开发者工具接入开发时，应选择仓库内的 `public/plugin.json`
- `public/preload/services.js`、`public/plugin.json`、`public/panel.html` 或 `public/app.js` 变更后，不要只依赖热更新；按官方调试文档重新进入插件，必要时先断开再重新接入
- 如果再次出现“截图链路改动后仍然先出现大白框”，先确认 uTools 是否已经完整重载了新的模板插件配置，而不是继续运行旧的带 `main` 的插件缓存

当前项目的开发 / 预览 / 调试方式：

1. 首次安装依赖：`npm install`
2. 运行单测：`npm test`
3. 同步静态运行文件：`npm run dev`
4. 打开 `uTools 开发者工具`，在项目里选择本仓库的 `public/plugin.json`
5. 点击 `接入开发`
6. 在 uTools 中通过 `钉图记录`、`设置`、`截屏翻译钉图` 三个指令验证不同入口
   其中 `截屏翻译钉图` 入口应直接进入静默截图链路，不应先展示主窗口页面壳子。
7. 如果要验证真实翻译，优先在设置页填写百度 `AppID / Access Token`
   开发态只有在设置页未填写时，才继续回退到 `BAIDU_FANYI_APP_ID`、`BAIDU_FANYI_ACCESS_TOKEN`
8. 改 `public/` 或 `public/preload/` 下的运行文件后，重新执行一次 `npm run dev`
9. 需要看控制台、报错、网络请求或 DOM 时，进入插件后打开 `开发者工具`
10. 确认 `钉图记录` 页面展示瀑布流记录或受控空态，而不是旧的三步流首页；有记录时默认 4 列，可通过右下角列数按钮上拉选择 3 / 4 / 5 列；点击图片应打开当前页预览层，遮罩层里的 `删除 / 重钉图` 动作应各自独立
11. 确认 `设置` 页面可以返回记录页，且保存目录按钮、保存开关、删除确认开关都可操作
12. 在设置页切换主题模式，确认记录页和结果页状态标签与根节点主题同步更新
13. 在设置页拖动窗口高度，确认窗口高度立即变化；关闭并重新进入插件后，确认仍保持为上次保存值
14. 每次进入 `钉图记录 / 设置 / 结果页` 时，确认看到的是 `public/panel.html` 承载的静态面板，而不是任何旧页面壳

当前项目的构建预览方式：

1. 运行 `npm run build`
2. 确认产物已经生成到 `dist/`
3. 在 uTools 开发者工具中选择构建后的 `dist/plugin.json` 对应产物进行验证
4. 当前 `dist/plugin.json` 会和 `public/plugin.json` 保持一致，不再依赖 `development.main`

文档优先级约定：

- 查“怎么接入开发、怎么调试、热更新为何不生效”，优先看官方“快速开始 / 第一个插件应用 / 调试插件应用”
- 查 `window.utools` 能力、生命周期、数据存储、动态指令等，优先看官方 API 文档
- 查 `plugin.json` 字段语义，优先看官方 `plugin.json 核心配置文件说明`
- 查 `preload` 能力边界和 Node.js 接入方式，优先看官方 `preload` 文档

当前推荐验证顺序：

1. 只改文档或注释时，先做文档自检，确认说明与真实代码一致。
2. 改了 `preload` 设置模型或主题逻辑时，先跑 `npm test`。
3. 改了前端界面、插件入口、静态启动壳、`plugin.json`、`preload` 或构建配置时，至少跑一次 `npm run build`。
4. 改了 `feature` 匹配、uTools 生命周期、主题同步或窗口高度逻辑时，跑完 `npm test` 和 `npm run build` 后，再做一次手动 uTools smoke test。

当前推荐 smoke test：

1. 运行 `npm test`
2. 运行 `npm run build`
3. 运行 `npm run dev`
4. 在 uTools 开发者工具中接入 `public/plugin.json`
5. 通过 `钉图记录` 进入插件
6. 确认静态启动壳文案已经是当前插件语义，而不是旧项目残留
7. 确认记录页展示瀑布流卡片；如果当前没有记录，则看到受控空态和设置入口
8. 点击设置按钮，确认可以进入设置页并返回记录页
9. 在设置页点击“选择保存目录”，确认系统目录选择器可打开；取消后不应污染当前设置
10. 切换 `saveTranslatedImage` 和 `confirmBeforeDelete`，确认设置状态可持久化
11. 在设置页切换 `跟随系统 / 深色 / 浅色`，确认记录页主题和状态标签即时更新
12. 在系统主题变化时，确认 `跟随系统` 模式下记录页与设置页也能同步更新
13. 在设置页拖动窗口高度滑块，确认窗口高度会立即变化；点击“恢复默认高度”后确认回到默认值；关闭并重新进入插件后仍保持上次保存值
14. 如果保存目录下已有记录，点击缩略图或“重新钉图”，确认按记录中的 `lastPegBounds` 真实重钉图
15. 如果保存目录下已有记录，打开/关闭“删除前二次确认”后删除一条记录，确认确认框行为符合设置
16. 通过 `截屏翻译钉图` 进入插件：
   如果设置页和环境变量都未配置百度凭证，应在截图后进入 `translation-config-invalid` 失败结果页，并可直接跳设置页补全。
   如果已配置百度凭证且翻译成功，应直接把翻译结果默认钉到当前屏幕左上角，而不是停在结果页。
17. 拖动已经钉图的图片，再关闭并重新从 `钉图记录` 打开同一张图，确认会回到关闭前最后一次位置。
18. 对已经钉图的图片执行鼠标滚轮缩放，确认会按指针中心平滑缩放；在 macOS 下再用双指向外扩 / 向内缩，确认同样生效且不卡顿。
19. 缩放一张已经钉图的图片后关闭，再从 `钉图记录` 重新钉图同一张图，确认会恢复为上次缩放后的大小。
20. 鼠标点击一张已经钉图的图片让它聚焦，再按 `Cmd+C`（macOS）或 `Ctrl+C`（Windows），确认系统剪切板里得到的是图片位图而不是文件路径；同时确认窗口右上角会出现短暂“已复制”反馈，外围边框会轻闪一下。
21. 鼠标点击一张已经钉图的图片让它聚焦，再按 `ESC`，确认会关闭当前这张图片；未聚焦时不应误关别的窗口。
22. 同一张记录图已处于钉图状态时，再次点击该记录，确认不再弹系统通知，而是把现有窗口拉到前台并左右晃动提示位置。
23. 如果使用 `dist/plugin.json` 做构建产物验证，确认在没有启动 `npm run dev` 的情况下也能正常进入记录页、设置页和主流程，而不是统一白屏。
24. 触发 `截屏翻译钉图` 时，确认不会先出现旧主窗口白框；如果仍然出现，优先怀疑 uTools 仍在跑旧缓存，而不是直接回退业务代码。

## 6. 配置与安全约束

- 当前图片翻译优先读取设置页里通过 `utools.db` 同步的百度 `V2` 凭证；开发态仍可通过环境变量 `BAIDU_FANYI_APP_ID`、`BAIDU_FANYI_ACCESS_TOKEN` 兜底。
- 不要把 secrets、tokens、cookies、授权码、私有路径或测试账号写进仓库。
- 当前 `preload` 已暴露设置、记录、官方截图、真实钉图和翻译能力；新增系统调用时仍要优先控制边界，不要默认把更多系统权限直接暴露给前端。
- 当前设置通过 `utools.dbStorage` 保存，百度凭证通过 `utools.db` 同步，记录图片和总清单只落本机目录；后续再扩存储时先明确哪些可以同步、哪些只能本机保存。
- 当前主题样式使用本地优先字体栈，不要为界面美化顺手新增运行时远程字体请求。
- 除非需求明确变化，否则不要新增 telemetry、analytics 或额外网络上报。
- 当前已引入百度图片翻译远程调用；后续如果再扩 OCR、别的翻译服务或钉图云同步，必须先同步补齐安全边界、配置说明和忽略规则，再继续实现。

## 7. 代码改动约束

- 优先做小而清晰的改动，不要在当前骨架阶段顺手做大范围重构。
- 新增截图、OCR、翻译、钉图窗口等系统能力时，优先通过 `preload` 收口，再在渲染层按最小接口消费。
- `public/preload/package.json` 既然声明了 `commonjs`，后续 preload 代码要继续兼容这个约束，不要半途混入会破坏运行时的模块格式。
- 对外能力发生变化时，优先补最相关验证；当前项目至少要补一次 `npm test` 或 `npm run build`，并根据改动范围决定是否手动 smoke。
- Git 提交信息默认使用 `英文类型：中文正文`，例如 `feat: 增加钉图窗口初版`。
- 默认直接在 `main` 分支开发；只有用户明确要求分支隔离或 PR 流程时，才切到其他分支。
- 完成最小可验证改动后，默认创建本地 commit；如果验证通过、提交边界清晰且工作区没有无关脏改，默认继续 push 到远端。
- 以下情况不要自动 push：验证未通过、工作区混有无关修改、只做了分析没有形成可交付结果、改动里包含本地临时文件或敏感信息。
- 当前已经具备官方截图、百度图片翻译和真实钉图。任何新增文案都必须明确区分“已实现能力”和“后续增强计划”，不要把未做的增强项写成已支持。

## 8. AGENTS.md 维护规则

后续代码更新过程中，满足以下任一条件时，必须在同一轮改动里同步更新 `AGENTS.md`：

- 项目目标、阶段或主链路发生变化
- 插件入口、`feature` 列表、目录职责或运行方式发生变化
- `preload` 暴露能力、构建方式或 uTools 联调方式发生变化
- 新增了环境变量、配置文件、测试命令或新的验证门禁
- 设置项结构、主题策略、窗口能力或持久化策略发生变化
- 新增了后续协作者必须知道的安全边界、限制或操作前提

如果只是纯实现细节调整，且不影响协作方式、运行方式、验证方式或系统边界，可以不改 `AGENTS.md`。

## 9. 当前阶段快照

截至 `2026-04-12`，仓库状态可按下面理解：

- 当前主线已经从参考书签项目迁移成新的截屏翻译插件工程
- 当前已具备：
  - `截屏翻译钉图 / 钉图记录 / 设置` 三个入口
  - 模板插件 `window.exports` 三入口
  - `public/panel.html` 承载的记录页 / 设置页 / 失败结果页三种静态面板
  - 官方 `screenCapture` 截图桥接
  - 百度图片翻译真实调用（优先读取设置页同步的 `V2` 凭证，开发态支持环境变量兜底）
  - 百度图片翻译 `V2` 块级回填的本地拼图生成
  - 设置页百度 `AppID / Access Token` 输入与 `utools.db` 同步存储
  - `跟随系统 / 深色 / 浅色` 三态主题
  - 主插件窗口高度设置与持久化
  - 记录页列数 `3 / 4 / 5` 的右下角上拉选择与持久化
  - 记录页图片预览层，以及遮罩层内常驻 `删除 / 重钉图` 文字动作
  - `translationMode`、`saveTranslatedImage`、`saveDirectory`、`confirmBeforeDelete` 插件设置与持久化
  - 保存目录总清单读取、整理、删除
  - 记录页瀑布流展示、目录选择、删除确认开关、删除失败 warning
  - 主流程失败结果页和重钉图失败结果页
  - 真实钉图窗口、拖动位置同步、指针中心缩放、聚焦后 `Cmd/Ctrl + C` 复制图片并显示轻反馈、双击关闭、聚焦后 `ESC` 关闭和重复钉图前台晃动提醒
  - `preload` 设置接口、记录接口、目录选择接口、官方截图桥接、真实钉图桥接与测试覆盖
- 当前仍未具备：
  - 真实 OCR
  - 按截图原位置钉回
  - 已钉图状态的跨进程恢复

后续协作者如果继续推进功能，默认应从“如何在保持主路径简洁的前提下增强截图能力”和“当前已钉图状态如何跨进程恢复”这两条主线思考，而不是再把主流程重新拉回冗余分支。
