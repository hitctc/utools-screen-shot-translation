# utools-screen-shot-translation 协作文档

## 1. 文档目标

这份 `AGENTS.md` 用来约束本项目内的协作方式，优先级高于上层那些不够贴近本仓库现状的通用规则。

它主要解决四件事：

- 让进入仓库的协作者先快速知道这个项目现在做到哪一步、怎么运行、主要代码在哪。
- 让后续改动优先沿着当前“截屏 -> 翻译 -> 钉住”骨架继续推进，而不是回退成模板式试验代码。
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
- 目标方向：做成一个在 `uTools` 内完成“截屏 -> 翻译 -> 钉住结果”的工具
- 当前阶段：当前分支 `feature/custom-capture-pin` 已把主流程重写为“官方截图 -> 百度图片翻译 -> 默认钉图 -> 按条件保存”，不再把自定义截图 overlay 作为主路径
- 当前真实能力：
  - 插件身份已经切换为 `uTools Screen Shot Translation`
  - `public/plugin.json` 已定义 3 个入口：
    - `screen-shot-translation-run` -> `截屏翻译钉住`
    - `screen-shot-translation-records` -> `钉住记录`
    - `screen-shot-translation-settings` -> `设置`
  - `钉住记录` 页面已从保存目录总清单读取记录并渲染瀑布流卡片，默认 3 列，支持通过滑块调到 3~6 列并持久化
  - `设置` 页面已承载翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度
  - 设置页已可填写百度图片翻译 `AppID / Access Token`
  - `失败结果页` 已承载主流程失败、重钉失败和未知失败码的统一文案与动作
  - 支持 `跟随系统 / 深色 / 浅色` 三态主题
  - 支持在系统主题变化时同步刷新页面主题和状态文案
  - 支持通过 `dbStorage` 持久化 UI 设置和插件设置
  - 支持调整主插件窗口高度，并在重新进入插件时恢复
  - 支持 Vue 挂载前显示静态首屏壳子，避免纯白空屏
  - 插件设置模型已切到 `translationMode / saveTranslatedImage / saveDirectory / confirmBeforeDelete`，`preload` 侧已完成归一化和测试收口
  - `public/preload/recordStore.cjs` 已接通保存目录总清单的读取、整理、保存、删除和最后钉住位置更新
  - `public/preload/baiduPictureTranslate.cjs` 已接通百度图片翻译请求发送、自动方向选择，以及 `V2` 块级回填优先的本地拼图
  - `public/preload/translationCredentialStore.cjs` 已接通百度凭证同步文档的读取与更新
  - 已钉住窗口支持按鼠标指针中心进行滚轮缩放，macOS 下支持双指缩放，并会记住上次缩放后的大小
- 已钉住窗口在聚焦时支持 `Cmd/Ctrl + C` 直接把当前图片复制到系统剪切板，复制的是位图不是文件路径；复制成功后会在窗口内显示短暂轻反馈
- 已钉住窗口在聚焦时支持按 `ESC` 直接关闭当前这张图片；不做全局快捷键关闭
  - `public/preload/services.js` 已暴露 `pickSaveDirectory / listSavedRecords / deleteSavedRecord / repinSavedRecord / runCaptureTranslationPin`
- 当前明确限制：
  - 真实翻译当前只走百度图片翻译 `V2`，读取设置页同步的 `AppID / Access Token`；`V2` 优先使用块级 `contents[].paste_img` 在本地重新拼译后图，开发态仍支持环境变量兜底
  - 当前主流程截图统一走 `utools.screenCapture(callback)`，因此暂不支持“按截图原位置钉回”
  - 首次钉图默认落到当前屏幕右上角；只有记录重钉时才优先回到上次保存的位置
  - “当前哪些图片已钉住”只保存在插件进程内存里；插件进程结束后，只保留 manifest 中的最后位置
- 当前技术栈：`Vue 3 + Vite 6 + @vitejs/plugin-vue + utools-api-types + Node built-in node:test`
- 当前视觉基线：Nothing 风格中文桌面工具表达，深色优先、浅色同步，主题强调色固定为 `#d71921`
- 当前界面字体：`Doto / Space Grotesk / Space Mono`
- 当前运行模型：
  - `uTools` 进入插件后由 `src/App.vue` 按 feature code 切到 `records / settings / result`；`run` 主流程则在 `public/preload/services.js` 的 `onPluginEnter` 阶段直接启动，渲染层只负责承载失败结果
  - `public/preload/services.js` 通过 `window.services` 暴露当前正式保留的设置、记录、目录选择和主流程桥接能力
  - `public/preload/localState.cjs` 负责 UI 设置和插件设置的归一化
  - `src/screenTranslation/*` 负责记录页、设置页、结果页和对应 view-state 映射

当前仓库已经进入真实“截屏 -> 翻译 -> 钉住”闭环阶段，但多屏选区、进程外钉住状态恢复这些增强能力仍未完成。不要把这些增强项误说成已支持。
当前界面不要再往玻璃拟态、厚阴影或大渐变方向扩散；样式层级优先靠排版、边框和间距控制。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，定义插件入口、`preload` 路径、开发态地址、默认窗口高度和功能指令匹配规则。当前保留 3 个 feature 入口。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/services.js`
  负责桥接 `utools.dbStorage`、`utools.db`、目录选择、记录读取/保存/删除、官方截图入口、百度翻译入口和真实钉住/重钉，并通过 `window.services` 暴露前端可消费的接口。`run` 入口的首次 `onPluginEnter` 也在这里预收口，用来在渲染层挂载前先静默隐藏当前插件窗口；当前隐藏策略统一优先走 `outPlugin()`，只在不可用时才回退到 `hideMainWindow()`。
- `public/preload/baiduPictureTranslate.cjs`
  负责百度图片翻译的图片解码、请求发送、自动方向选择，以及 `V2` 块级译文的本地拼图回填。
- `public/preload/baiduPictureCompose.cjs`
  负责把百度图片翻译 `V2` 返回的块级 `paste_img` 和原截图背景重新拼成最终位图，继续供钉住与保存链路复用。
- `public/preload/translationCredentialStore.cjs`
  负责百度凭证同步文档的读取、归一化和更新。
- `public/preload/localState.cjs`
  负责 UI 设置与插件设置的归一化规则，包括主题模式、窗口高度、记录页列数，以及翻译保存相关的 `translationMode`、`saveTranslatedImage`、`saveDirectory` 和 `confirmBeforeDelete`。
- `public/preload/recordStore.cjs`
  负责保存目录根目录下总清单文件 `.screen-translation-records.json` 的读、写、整理、删除和最后钉住位置更新。
- `public/preload/pinWindowManager.cjs`
  负责真实钉住窗口的创建、拖动、缩放、重复钉住前台提醒，以及 `lastPinBounds` 的持续回写。
- `public/preload/workflow.cjs`
  负责主流程 `capture -> translate -> pin -> save` 的失败归因和统一返回契约，当前会透传步骤返回的明确失败码。
- `src/App.vue`
  当前插件 UI 总入口，负责 `records / settings / result` 三个视图切换、失败结果页映射、记录读取、删除确认、目录选择和重钉失败闭环。
- `src/screenTranslation/HomeView.vue`
  当前记录页视图，负责展示瀑布流记录卡片、空态、warning、删除按钮和设置入口。
- `src/screenTranslation/SettingsView.vue`
  设置页视图，负责百度凭证、翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度的配置展示。
- `src/screenTranslation/ResultView.vue`
  失败结果页视图，负责展示统一失败文案和 `retry / open-settings / close` 动作。
- `src/screenTranslation/viewState.js`
  负责失败码文案映射、记录卡片数据映射和本地文件 `file://` URL 归一化。
- `src/screenTranslation/theme.js`
  负责三态主题解析、系统主题同步和状态文案格式化。
- `src/screenTranslation/types.ts`
  负责记录页、结果页、设置项和页面选项的前端类型与常量定义。
- `src/main.js`
  Vue 客户端挂载入口，同时负责在应用接管页面后移除静态首屏壳子。
- `src/bootShell.js`
  负责首屏静态壳子的最小移除逻辑，避免这段启动链路散落在入口文件里。
- `src/main.css`
  当前截屏翻译工具骨架页的基础样式和主题 token。
- `tests/preload/localState.test.mjs`
  负责当前 `preload` 正式保留的设置归一化与读写合并语义测试，包括目录选择、同步凭证桥接、官方截图桥接、真实重钉桥接和局部更新持久化。
- `tests/preload/translationCredentialStore.test.mjs`
  负责百度凭证同步文档的读写与局部更新测试。
- `tests/preload/recordStore.test.mjs`
  负责保存目录总清单的读写、清理、保存、删除、位置回写和路径安全边界测试。
- `tests/preload/workflow.test.mjs`
  负责主流程编排、失败归因和 `capture -> translate -> pin -> save` 参数传递测试。
- `tests/preload/theme.test.mjs`
  负责主题模式解析、状态文案和系统主题响应式同步测试。
- `tests/preload/bootShell.test.mjs`
  负责静态启动壳移除逻辑的最小单测。
- `tests/pluginSettings.test.mjs`
  负责前端侧插件设置归一化和保存目录警告文案的最小契约测试。
- `tests/viewState.test.mjs`
  负责未知失败码兜底、记录卡片时间容错和本地文件路径归一化测试。
- `vite.config.js`
  Vite 构建配置；当前 `base` 固定为 `./`，用于适配 uTools 本地资源加载。
- `dist/`
  构建产物目录；`npm run build` 后会生成 `dist/index.html`、`dist/plugin.json`、`dist/preload/*` 和静态资源，供 uTools 实际加载。当前构建后会额外移除 `dist/plugin.json` 里的 `development` 字段，避免构建产物继续回指本地 dev server。
- `scripts/prepare-dist-plugin.mjs`
  负责把构建后的 `dist/plugin.json` 改写成 release 形态，去掉仅开发联调用的 `development.main`。
- `docs/superpowers/specs/`
  保存本轮功能设计稿。
- `docs/superpowers/plans/`
  保存本轮实现计划。

## 4. 当前能力与入口约定

当前插件能力全部由 `public/plugin.json` 中的 `features` 决定，并且必须和 `src/App.vue` 的初始化逻辑保持同步。

当前已定义的 feature：

- `screen-shot-translation-run`
  通过 `截屏翻译钉住` 进入插件，执行主流程入口。当前主路径会走 `官方截图 -> 百度图片翻译 -> 默认右上角钉图 -> 按条件保存`，并且 `feature.mainHide` 已开启，不应主动把主窗口顶到前台。
- `screen-shot-translation-records`
  通过 `钉住记录` 进入记录页，展示已保存目录中的总清单记录。
- `screen-shot-translation-settings`
  通过 `设置` 进入设置页。

当前关键约定：

- 如果新增或重命名 `feature.code`，必须同步更新：
  - `public/plugin.json`
  - `src/App.vue`
  - 对应前端视图或业务模块
  - `README.md` 与 `AGENTS.md`
- 所有需要 Node.js 权限的能力，优先放到 `public/preload/`，再通过 `window.services` 给前端使用；不要把系统能力直接散落到渲染层各处。
- 当前 UI 不使用 `vue-router`，而是在 `App.vue` 内维护 `records / settings / result` 视图切换和 `run` 主流程入口。除非需求明显升级，否则不要提前引入完整路由系统。
  当前约束是：`run` 首次进入不应主动把主窗口顶到前台；官方截图主流程应由 preload 直接触发，渲染层不能再承担启动截图的职责。
- 当前记录页、结果页和设置页已经是正式承载面；当前分支主流程里的截图、翻译、钉住与记录重钉都是真实能力。后续如果改这条链路，必须明确是增强还是回归修复。

## 5. 运行与验证

首次进入仓库先确认依赖状态。当前工作区可能没有安装依赖，不要默认 `node_modules` 已存在。

常用命令：

- 安装依赖：`npm install`
- 单测：`npm test`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

当前开发方式约定：

- `npm run dev` 会启动 Vite 开发服务
- `public/plugin.json` 的 `development.main` 会指向当前本地 Vite 地址 `http://localhost:5173`
- 用 uTools 开发者工具接入开发时，应选择仓库内的 `public/plugin.json`
- `public/preload/services.js`、`public/plugin.json` 或 `index.html` 变更后，不要只依赖热更新；按官方调试文档重新进入插件，必要时开启“退出到后台立即结束运行”
- 如果再次出现“截图链路改动后所有入口一起白屏”，优先检查 `public/preload/services.js`、`public/plugin.json`、`src/main.js` 和相关子窗口 HTML 是否引入了新的启动期异常

当前项目的开发 / 预览 / 调试方式：

1. 首次安装依赖：`npm install`
2. 运行单测：`npm test`
3. 启动前端开发服务：`npm run dev`
4. 打开 `uTools 开发者工具`，在项目里选择本仓库的 `public/plugin.json`
5. 点击 `接入开发`
6. 在 uTools 中通过 `钉住记录`、`设置`、`截屏翻译钉住` 三个指令验证不同入口
   其中 `截屏翻译钉住` 入口应直接进入静默截图链路，不应先展示主窗口页面壳子。
7. 如果要验证真实翻译，优先在设置页填写百度 `AppID / Access Token`
   开发态只有在设置页未填写时，才继续回退到 `BAIDU_FANYI_APP_ID`、`BAIDU_FANYI_ACCESS_TOKEN`
8. 改 `src/` 下的前端代码时，Vite 会热更新，回到插件窗口即可看到界面变化
9. 需要看控制台、报错、网络请求或 DOM 时，进入插件后打开 `开发者工具`
10. 确认 `钉住记录` 页面展示瀑布流记录或受控空态，而不是旧的三步流首页；有记录时默认 3 列，可通过顶部滑块调到 3~6 列
10.1 如果看到的是开发态兜底入口页，确认它会跳到 `http://127.0.0.1:5173/index.html`；如果开发服务器未启动，应看到明确提示而不是白屏
11. 确认 `设置` 页面可以返回记录页，且保存目录按钮、保存开关、删除确认开关都可操作
12. 在设置页切换主题模式，确认记录页和结果页状态标签与根节点主题同步更新
13. 在设置页拖动窗口高度，确认窗口高度立即变化；关闭并重新进入插件后，确认仍保持为上次保存值
14. 每次进入插件时，确认会先看到静态首屏壳子而不是纯白空屏

当前项目的构建预览方式：

1. 运行 `npm run build`
2. 确认产物已经生成到 `dist/`
3. 在 uTools 开发者工具中选择构建后的 `dist/plugin.json` 对应产物进行验证
4. 当前 `dist/plugin.json` 已去掉 `development.main`，构建产物验证不再依赖 `npm run dev`

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
5. 通过 `钉住记录` 进入插件
6. 确认静态启动壳文案已经是当前插件语义，而不是旧项目残留
7. 确认记录页展示瀑布流卡片；如果当前没有记录，则看到受控空态和设置入口
8. 点击设置按钮，确认可以进入设置页并返回记录页
9. 在设置页点击“选择保存目录”，确认系统目录选择器可打开；取消后不应污染当前设置
10. 切换 `saveTranslatedImage` 和 `confirmBeforeDelete`，确认设置状态可持久化
11. 在设置页切换 `跟随系统 / 深色 / 浅色`，确认记录页主题和状态标签即时更新
12. 在系统主题变化时，确认 `跟随系统` 模式下记录页与设置页也能同步更新
13. 在设置页拖动窗口高度滑块，确认窗口高度会立即变化；点击“恢复默认高度”后确认回到默认值；关闭并重新进入插件后仍保持上次保存值
14. 如果保存目录下已有记录，点击缩略图或“重新钉住”，确认按记录中的 `lastPinBounds` 真实重钉
15. 如果保存目录下已有记录，打开/关闭“删除前二次确认”后删除一条记录，确认确认框行为符合设置
16. 通过 `截屏翻译钉住` 进入插件：
   如果设置页和环境变量都未配置百度凭证，应在截图后进入 `translation-config-invalid` 失败结果页，并可直接跳设置页补全。
   如果已配置百度凭证且翻译成功，应直接把翻译结果默认钉到当前屏幕右上角，而不是停在结果页。
17. 拖动已经钉住的图片，再关闭并重新从 `钉住记录` 打开同一张图，确认会回到关闭前最后一次位置。
18. 对已经钉住的图片执行鼠标滚轮缩放，确认会按指针中心平滑缩放；在 macOS 下再用双指向外扩 / 向内缩，确认同样生效且不卡顿。
19. 缩放一张已经钉住的图片后关闭，再从 `钉住记录` 重新钉住同一张图，确认会恢复为上次缩放后的大小。
20. 鼠标点击一张已经钉住的图片让它聚焦，再按 `Cmd+C`（macOS）或 `Ctrl+C`（Windows），确认系统剪切板里得到的是图片位图而不是文件路径；同时确认窗口右上角会出现短暂“已复制”反馈，外围边框会轻闪一下。
21. 鼠标点击一张已经钉住的图片让它聚焦，再按 `ESC`，确认会关闭当前这张图片；未聚焦时不应误关别的窗口。
22. 同一张记录图已处于钉住状态时，再次点击该记录，确认不再弹系统通知，而是把现有窗口拉到前台并左右晃动提示位置。
23. 如果使用 `dist/plugin.json` 做构建产物验证，确认在没有启动 `npm run dev` 的情况下也能正常进入记录页、设置页和主流程，而不是统一白屏。

## 6. 配置与安全约束

- 当前图片翻译优先读取设置页里通过 `utools.db` 同步的百度 `V2` 凭证；开发态仍可通过环境变量 `BAIDU_FANYI_APP_ID`、`BAIDU_FANYI_ACCESS_TOKEN` 兜底。
- 不要把 secrets、tokens、cookies、授权码、私有路径或测试账号写进仓库。
- 当前 `preload` 已暴露设置、记录、官方截图、真实钉住和翻译能力；新增系统调用时仍要优先控制边界，不要默认把更多系统权限直接暴露给前端。
- 当前设置通过 `utools.dbStorage` 保存，百度凭证通过 `utools.db` 同步，记录图片和总清单只落本机目录；后续再扩存储时先明确哪些可以同步、哪些只能本机保存。
- 当前主题样式使用本地优先字体栈，不要为界面美化顺手新增运行时远程字体请求。
- 除非需求明确变化，否则不要新增 telemetry、analytics 或额外网络上报。
- 当前已引入百度图片翻译远程调用；后续如果再扩 OCR、别的翻译服务或钉住云同步，必须先同步补齐安全边界、配置说明和忽略规则，再继续实现。

## 7. 代码改动约束

- 优先做小而清晰的改动，不要在当前骨架阶段顺手做大范围重构。
- 新增截图、OCR、翻译、钉住窗口等系统能力时，优先通过 `preload` 收口，再在渲染层按最小接口消费。
- `public/preload/package.json` 既然声明了 `commonjs`，后续 preload 代码要继续兼容这个约束，不要半途混入会破坏运行时的模块格式。
- 对外能力发生变化时，优先补最相关验证；当前项目至少要补一次 `npm test` 或 `npm run build`，并根据改动范围决定是否手动 smoke。
- Git 提交信息默认使用 `英文类型：中文正文`，例如 `feat: 增加钉住窗口初版`。
- 默认直接在 `main` 分支开发；只有用户明确要求分支隔离或 PR 流程时，才切到其他分支。
- 完成最小可验证改动后，默认创建本地 commit；如果验证通过、提交边界清晰且工作区没有无关脏改，默认继续 push 到远端。
- 以下情况不要自动 push：验证未通过、工作区混有无关修改、只做了分析没有形成可交付结果、改动里包含本地临时文件或敏感信息。
- 当前已经具备官方截图、百度图片翻译和真实钉住。任何新增文案都必须明确区分“已实现能力”和“后续增强计划”，不要把未做的增强项写成已支持。

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

截至 `2026-04-11`，仓库状态可按下面理解：

- 当前主线已经从参考书签项目迁移成新的截屏翻译插件工程
- 当前已具备：
  - `截屏翻译钉住 / 钉住记录 / 设置` 三个入口
  - 静态首屏壳子
  - 记录页 / 设置页 / 失败结果页三种承载面
  - 官方 `screenCapture` 截图桥接
  - 百度图片翻译真实调用（优先读取设置页同步的 `V2` 凭证，开发态支持环境变量兜底）
  - 百度图片翻译 `V2` 块级回填的本地拼图生成
  - 设置页百度 `AppID / Access Token` 输入与 `utools.db` 同步存储
  - `跟随系统 / 深色 / 浅色` 三态主题
  - 主插件窗口高度设置与持久化
  - 记录页列数 `3 ~ 6` 的滑块调节与持久化
  - `translationMode`、`saveTranslatedImage`、`saveDirectory`、`confirmBeforeDelete` 插件设置与持久化
  - 保存目录总清单读取、整理、删除
  - 记录页瀑布流展示、目录选择、删除确认开关、删除失败 warning
  - 主流程失败结果页和重钉失败结果页
  - 真实钉住窗口、拖动位置同步、指针中心缩放、聚焦后 `Cmd/Ctrl + C` 复制图片并显示轻反馈、双击关闭、聚焦后 `ESC` 关闭和重复钉住前台晃动提醒
  - `preload` 设置接口、记录接口、目录选择接口、官方截图桥接、真实钉住桥接与测试覆盖
- 当前仍未具备：
  - 真实 OCR
  - 按截图原位置钉回
  - 已钉住状态的跨进程恢复

后续协作者如果继续推进功能，默认应从“如何在保持主路径简洁的前提下增强截图能力”和“当前已钉住状态如何跨进程恢复”这两条主线思考，而不是再把主流程重新拉回冗余分支。
