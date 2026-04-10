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

## 2. 项目当前定位

- 项目名称：`utools-screen-shot-translation`
- 目标方向：做成一个在 `uTools` 内完成“截屏 -> 翻译 -> 钉住结果”的工具
- 当前阶段：第一版入口、设置、记录页和失败闭环已接通，真实截图/翻译/钉住仍待后续实现
- 当前真实能力：
  - 插件身份已经切换为 `uTools Screen Shot Translation`
  - `public/plugin.json` 已定义 3 个入口：
    - `screen-shot-translation-run` -> `截屏翻译钉住`
    - `screen-shot-translation-records` -> `钉住记录`
    - `screen-shot-translation-settings` -> `设置`
  - `钉住记录` 页面已从保存目录总清单读取记录并渲染瀑布流卡片
  - `设置` 页面已承载翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度
  - `失败结果页` 已承载主流程失败、重钉失败和未知失败码的统一文案与动作
  - 支持 `跟随系统 / 深色 / 浅色` 三态主题
  - 支持在系统主题变化时同步刷新页面主题和状态文案
  - 支持通过 `dbStorage` 持久化 UI 设置和插件设置
  - 支持调整主插件窗口高度，并在重新进入插件时恢复
  - 支持 Vue 挂载前显示静态首屏壳子，避免纯白空屏
  - 插件设置模型已切到 `translationMode / saveTranslatedImage / saveDirectory / confirmBeforeDelete`，`preload` 侧已完成归一化和测试收口
  - `public/preload/recordStore.cjs` 已接通保存目录总清单的读取、整理和删除
  - `public/preload/services.js` 已暴露 `pickSaveDirectory / listSavedRecords / deleteSavedRecord / repinSavedRecord / runCaptureTranslationPin`
- 当前明确限制：
  - 还没有接入真实截屏能力
  - 还没有接入真实 OCR 或翻译服务
  - 还没有实现真正的图片钉住窗口
  - `runCaptureTranslationPin` 仍是诚实占位：当前只会返回失败码，不会真正完成截图翻译钉住
  - `repinSavedRecord` 仍是诚实占位：当前只会返回 `repin-failed`
- 当前技术栈：`Vue 3 + Vite 6 + @vitejs/plugin-vue + utools-api-types + Node built-in node:test`
- 当前运行模型：
  - `uTools` 进入插件后由 `src/App.vue` 按 feature code 切到 `records / settings / result`，或执行 `run` 主流程入口
  - `public/preload/services.js` 通过 `window.services` 暴露当前正式保留的设置、记录、目录选择和主流程桥接能力
  - `public/preload/localState.cjs` 负责 UI 设置和插件设置的归一化
  - `src/screenTranslation/*` 负责记录页、设置页、结果页和对应 view-state 映射

当前仓库已经不再是“三步流首页骨架”阶段，但也还没有进入真实截图/翻译/钉住闭环阶段。不要把记录页、失败页和目录选择这些现有壳能力误说成真实主流程已完成。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，定义插件入口、`preload` 路径、开发态地址、默认窗口高度和功能指令匹配规则。当前保留 3 个 feature 入口。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/services.js`
  负责桥接 `utools.dbStorage`、目录选择、记录读取/删除、主流程占位和重钉占位，并通过 `window.services` 暴露前端可消费的接口。
- `public/preload/localState.cjs`
  负责 UI 设置与插件设置的归一化规则，包括主题模式、窗口高度，以及翻译保存相关的 `translationMode`、`saveTranslatedImage`、`saveDirectory` 和 `confirmBeforeDelete`。
- `public/preload/recordStore.cjs`
  负责保存目录根目录下总清单文件 `.screen-translation-records.json` 的读、写、整理和删除。
- `public/preload/workflow.cjs`
  负责主流程 `capture -> translate -> pin -> save` 的失败归因和统一返回契约，当前仍通过依赖注入挂占位实现。
- `src/App.vue`
  当前插件 UI 总入口，负责 `records / settings / result` 三个视图切换、失败结果页映射、记录读取、删除确认、目录选择和重钉失败闭环。
- `src/screenTranslation/HomeView.vue`
  当前记录页视图，负责展示瀑布流记录卡片、空态、warning、删除按钮和设置入口。
- `src/screenTranslation/SettingsView.vue`
  设置页视图，负责翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度的配置展示。
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
  负责当前 `preload` 正式保留的设置归一化与读写合并语义测试，包括目录选择、重钉占位桥接和局部更新持久化。
- `tests/preload/recordStore.test.mjs`
  负责保存目录总清单的读写、清理、删除和路径安全边界测试。
- `tests/preload/workflow.test.mjs`
  负责主流程占位编排、失败归因和异常归一化测试。
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
  构建产物目录；`npm run build` 后会生成 `dist/index.html`、`dist/plugin.json`、`dist/preload/*` 和静态资源，供 uTools 实际加载。
- `docs/superpowers/specs/`
  保存本轮功能设计稿。
- `docs/superpowers/plans/`
  保存本轮实现计划。

## 4. 当前能力与入口约定

当前插件能力全部由 `public/plugin.json` 中的 `features` 决定，并且必须和 `src/App.vue` 的初始化逻辑保持同步。

当前已定义的 feature：

- `screen-shot-translation-run`
  通过 `截屏翻译钉住` 进入插件，执行主流程入口。当前只会返回受控失败码，还没有真实截图/翻译/钉住成功闭环。
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
- 当前记录页、结果页和设置页已经是正式承载面；但主流程和重钉仍是占位失败闭环，不要为了“看起来像完成了”去伪造截图结果、翻译结果或钉住成功。

## 5. 运行与验证

首次进入仓库先确认依赖状态。当前工作区可能没有安装依赖，不要默认 `node_modules` 已存在。

常用命令：

- 安装依赖：`npm install`
- 单测：`npm test`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

当前开发方式约定：

- `npm run dev` 会启动 Vite 开发服务
- `public/plugin.json` 的 `development.main` 会指向当前本地 Vite 地址
- 用 uTools 开发者工具接入开发时，应选择仓库内的 `public/plugin.json`
- `public/preload/services.js`、`public/plugin.json` 或 `index.html` 变更后，不要只依赖热更新；按官方调试文档重新进入插件，必要时开启“退出到后台立即结束运行”

当前项目的开发 / 预览 / 调试方式：

1. 首次安装依赖：`npm install`
2. 运行单测：`npm test`
3. 启动前端开发服务：`npm run dev`
4. 打开 `uTools 开发者工具`，在项目里选择本仓库的 `public/plugin.json`
5. 点击 `接入开发`
6. 在 uTools 中通过 `钉住记录`、`设置`、`截屏翻译钉住` 三个指令验证不同入口
7. 改 `src/` 下的前端代码时，Vite 会热更新，回到插件窗口即可看到界面变化
8. 需要看控制台、报错、网络请求或 DOM 时，进入插件后打开 `开发者工具`
9. 确认 `钉住记录` 页面展示瀑布流记录或受控空态，而不是旧的三步流首页
10. 确认 `设置` 页面可以返回记录页，且保存目录按钮、保存开关、删除确认开关都可操作
11. 在设置页切换主题模式，确认记录页和结果页状态标签与根节点主题同步更新
12. 在设置页拖动窗口高度，确认窗口高度立即变化；关闭并重新进入插件后，确认仍保持为上次保存值
13. 每次进入插件时，确认会先看到静态首屏壳子而不是纯白空屏

当前项目的构建预览方式：

1. 运行 `npm run build`
2. 确认产物已经生成到 `dist/`
3. 在 uTools 开发者工具中选择构建后的 `dist/plugin.json` 对应产物进行验证

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
14. 如果保存目录下已有记录，点击缩略图或“重新钉住”，确认进入失败结果页并看到 `repin-failed` 失败闭环
15. 如果保存目录下已有记录，打开/关闭“删除前二次确认”后删除一条记录，确认确认框行为符合设置
16. 通过 `截屏翻译钉住` 进入插件，确认当前会进入受控失败结果页，而不是假装成功

## 6. 配置与安全约束

- 当前项目没有业务环境变量需求；如果后续引入配置，优先明确哪些是非敏感配置、哪些必须走环境变量。
- 不要把 secrets、tokens、cookies、授权码、私有路径或测试账号写进仓库。
- 当前 `preload` 只暴露设置读写能力；新增系统调用时优先控制边界，不要默认把过多系统权限直接暴露给前端。
- 当前设置通过 `utools.dbStorage` 保存；如果后续接入图片缓存、OCR 结果缓存或钉住窗口状态，先明确哪些可以同步、哪些只能本机保存。
- 当前主题样式使用本地优先字体栈，不要为界面美化顺手新增运行时远程字体请求。
- 除非需求明确变化，否则不要新增 telemetry、analytics 或额外网络上报。
- 如果未来引入远程 OCR / 翻译服务，必须先同步补齐安全边界、配置说明和忽略规则，再继续实现。

## 7. 代码改动约束

- 优先做小而清晰的改动，不要在当前骨架阶段顺手做大范围重构。
- 新增截图、OCR、翻译、钉住窗口等系统能力时，优先通过 `preload` 收口，再在渲染层按最小接口消费。
- `public/preload/package.json` 既然声明了 `commonjs`，后续 preload 代码要继续兼容这个约束，不要半途混入会破坏运行时的模块格式。
- 对外能力发生变化时，优先补最相关验证；当前项目至少要补一次 `npm test` 或 `npm run build`，并根据改动范围决定是否手动 smoke。
- Git 提交信息默认使用 `英文类型：中文正文`，例如 `feat: 增加钉住窗口初版`。
- 默认直接在 `main` 分支开发；只有用户明确要求分支隔离或 PR 流程时，才切到其他分支。
- 完成最小可验证改动后，默认创建本地 commit；如果验证通过、提交边界清晰且工作区没有无关脏改，默认继续 push 到远端。
- 以下情况不要自动 push：验证未通过、工作区混有无关修改、只做了分析没有形成可交付结果、改动里包含本地临时文件或敏感信息。
- 当前只有骨架，没有真实业务闭环。任何新增文案都必须明确区分“已实现能力”和“后续计划”，不要把占位动作写成真实功能。

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
  - `跟随系统 / 深色 / 浅色` 三态主题
  - 主插件窗口高度设置与持久化
  - `translationMode`、`saveTranslatedImage`、`saveDirectory`、`confirmBeforeDelete` 插件设置与持久化
  - 保存目录总清单读取、整理、删除
  - 记录页瀑布流展示、目录选择、删除确认开关、删除失败 warning
  - 主流程失败结果页和重钉失败结果页
  - `preload` 设置接口、记录接口、目录选择接口、主流程占位接口与测试覆盖
- 当前仍未具备：
  - 真实截屏
  - 真实 OCR
  - 真实翻译
  - 真实钉住窗口
  - 主流程成功时无页面直达的最终闭环
  - 真实重钉

后续协作者如果继续推进功能，默认应从“真实截屏能力怎么收口到 preload”和“百度图片翻译 / 钉住窗口如何替换当前占位桥接”这两条主线思考，而不是再回退到旧的三步流首页结构。
