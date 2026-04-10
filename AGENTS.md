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
- 当前阶段：工程迁移完成后的空骨架阶段
- 当前真实能力：
  - 插件身份已经切换为 `uTools Screen Shot Translation`
  - `public/plugin.json` 已定义单一入口 `screen-shot-translation`
  - 首页已经替换成三步流骨架：`截屏`、`翻译`、`钉住`
  - 保留设置页，用于承载翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度
  - 支持 `跟随系统 / 深色 / 浅色` 三态主题
  - 支持在系统主题变化时同步刷新页面主题和状态文案
  - 支持通过 `dbStorage` 持久化 UI 设置和插件设置
  - 支持调整主插件窗口高度，并在重新进入插件时恢复
  - 支持 Vue 挂载前显示静态首屏壳子，避免纯白空屏
  - 插件设置模型已切到 `translationMode / saveTranslatedImage / saveDirectory / confirmBeforeDelete`，`preload` 侧已完成归一化和测试收口
- 当前明确限制：
  - 还没有接入真实截屏能力
  - 还没有接入真实 OCR 或翻译服务
  - 还没有实现真正的图片钉住窗口
  - 设置页当前只是骨架配置，不代表相关能力已落地
  - 当前只有一个主入口，不存在多窗口或多 feature 结构
- 当前技术栈：`Vue 3 + Vite 6 + @vitejs/plugin-vue + utools-api-types + Node built-in node:test`
- 当前运行模型：
  - `uTools` 进入插件后触发 `src/App.vue` 初始化
  - `public/preload/services.js` 通过 `window.services` 暴露当前插件正式保留的本地设置能力
  - `public/preload/localState.cjs` 负责 UI 设置和插件设置的归一化
  - `src/screenTranslation/*` 负责首页三步流和设置页 UI

当前仓库虽然已经有完整工程壳，但它还只是“截屏翻译工具”的骨架，不要把 README 里的长期方向误当成已交付功能。

## 3. 关键目录与职责

- `public/plugin.json`
  uTools 插件清单文件，定义插件入口、`preload` 路径、开发态地址、默认窗口高度和功能指令匹配规则。当前只保留一个 `screen-shot-translation` 入口。
- `public/preload/package.json`
  固定 `preload` 目录使用 `commonjs`，不要在这里随意切成 ESM。
- `public/preload/services.js`
  负责桥接 `utools.dbStorage`，并通过 `window.services` 暴露当前插件正式保留的四个本地设置方法：`getUiSettings`、`saveUiSettings`、`getPluginSettings`、`savePluginSettings`。
- `public/preload/localState.cjs`
  负责 UI 设置与插件设置的归一化规则，包括主题模式、窗口高度，以及翻译保存相关的 `translationMode`、`saveTranslatedImage`、`saveDirectory` 和 `confirmBeforeDelete`。
- `src/App.vue`
  当前插件 UI 总入口，负责首页 / 设置页双视图切换、三步流状态迁移、主题同步和窗口高度应用。
- `src/screenTranslation/HomeView.vue`
  首页视图，负责展示 `截屏 / 翻译 / 钉住` 三步流骨架、错误提示和设置入口。
- `src/screenTranslation/SettingsView.vue`
  设置页视图，负责翻译方向、保存结果图片、保存目录、删除前二次确认，以及主题模式和窗口高度的骨架配置展示。
- `src/screenTranslation/theme.js`
  负责三态主题解析、系统主题同步和状态文案格式化。
- `src/screenTranslation/types.ts`
  负责首页状态、设置项和页面选项的前端类型与常量定义。
- `src/main.js`
  Vue 客户端挂载入口，同时负责在应用接管页面后移除静态首屏壳子。
- `src/bootShell.js`
  负责首屏静态壳子的最小移除逻辑，避免这段启动链路散落在入口文件里。
- `src/main.css`
  当前截屏翻译工具骨架页的基础样式和主题 token。
- `tests/preload/localState.test.mjs`
  负责当前 `preload` 正式保留的设置归一化与读写合并语义测试，包括新的插件设置默认值、脏值归一化和局部更新持久化。
- `tests/preload/theme.test.mjs`
  负责主题模式解析、状态文案和系统主题响应式同步测试。
- `tests/preload/bootShell.test.mjs`
  负责静态启动壳移除逻辑的最小单测。
- `tests/pluginSettings.test.mjs`
  负责前端侧插件设置归一化和保存目录警告文案的最小契约测试。
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

- `screen-shot-translation`
  通过 `截屏&翻译`、`截屏&翻译&钉住` 进入插件，展示当前三步流骨架首页。

当前关键约定：

- 如果新增或重命名 `feature.code`，必须同步更新：
  - `public/plugin.json`
  - `src/App.vue`
  - 对应前端视图或业务模块
  - `README.md` 与 `AGENTS.md`
- 所有需要 Node.js 权限的能力，优先放到 `public/preload/`，再通过 `window.services` 给前端使用；不要把系统能力直接散落到渲染层各处。
- 当前 UI 不使用 `vue-router`，而是在 `App.vue` 内维护 `home / settings` 双视图。除非需求明显升级，否则不要提前引入完整路由系统。
- 当前首页只是骨架流程，不要为了“看起来像完成了”去伪造截图结果、翻译结果或钉住行为。

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
6. 在 uTools 中通过 `截屏&翻译` 或 `截屏&翻译&钉住` 打开插件
7. 改 `src/` 下的前端代码时，Vite 会热更新，回到插件窗口即可看到界面变化
8. 需要看控制台、报错、网络请求或 DOM 时，进入插件后打开 `开发者工具`
9. 确认首页展示的是 `截屏 -> 翻译 -> 钉住` 三步流骨架，而不是旧业务残留
10. 点击设置按钮，确认可以进入设置页并返回首页
11. 在设置页切换主题模式，确认首页状态文案和根节点主题同步更新
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
5. 通过 `截屏&翻译` 或 `截屏&翻译&钉住` 进入插件
6. 确认静态启动壳文案已经是当前插件语义，而不是旧项目残留
7. 确认首页展示 `1. 截屏 / 2. 翻译 / 3. 钉住` 三步流骨架
8. 点击“开始截屏”，确认流程推进到翻译阶段
9. 在翻译阶段点击“开始翻译”，确认流程推进到钉住阶段
10. 在钉住阶段点击“钉住结果”，确认收到“当前版本还未接入真实钉住能力”的受控提示
11. 点击设置按钮，确认可以进入设置页并返回首页
12. 在设置页切换 `跟随系统 / 深色 / 浅色`，确认首页主题和状态标签即时更新
13. 在系统主题变化时，确认 `跟随系统` 模式下首页与设置页也能同步更新
14. 在设置页拖动窗口高度滑块，确认窗口高度会立即变化；点击“恢复默认高度”后确认回到默认值；关闭并重新进入插件后仍保持上次保存值
15. 切换源语言、目标语言和钉住预览模式后，确认设置项状态能够持久化

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

截至 `2026-04-10`，仓库状态可按下面理解：

- 当前主线已经从参考书签项目迁移成新的截屏翻译插件工程
- 当前已具备：
  - 单一 `screen-shot-translation` 插件入口
  - 静态首屏壳子
  - 首页 / 设置页双视图
  - `截屏 / 翻译 / 钉住` 三步流骨架
  - `跟随系统 / 深色 / 浅色` 三态主题
  - 主插件窗口高度设置与持久化
  - `translationMode`、`saveTranslatedImage`、`saveDirectory`、`confirmBeforeDelete` 插件设置与持久化
  - `preload` 设置接口与最小测试覆盖
  - 前端设置页已切到新的插件设置契约，并能在保存结果图片开启但目录为空时提示警告
- 当前仍未具备：
  - 真实截屏
  - 真实 OCR
  - 真实翻译
  - 真实钉住窗口
  - 目录选择、历史记录和删除确认工作流

后续协作者如果继续推进功能，默认应从“真实截屏能力怎么收口到 preload”和“翻译 / 钉住链路如何在当前三步流骨架上接入”这两条主线思考，而不是再回退到旧项目结构。
