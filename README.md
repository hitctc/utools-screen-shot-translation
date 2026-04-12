# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件。

当前分支：`rewrite-jquery-shell`

当前运行壳已经切成静态模板插件模型：

- `截屏翻译钉住` 不再经过页面壳
- `钉住记录 / 设置 / 失败结果` 由 `public/panel.html` 承载
- 旧的 `Vue / Vite / src/` 代码先冻结，不再参与当前运行路径

当前正式入口：

- `截屏翻译钉住`
- `钉住记录`
- `设置`

当前主流程语义：

- `截屏翻译钉住`
  - 由 `public/preload/services.js` 里的 `window.exports['screen-shot-translation-run']` 直接启动
  - 先走 uTools 官方 `screenCapture(callback)`
  - 再走百度图片翻译 `V2`
  - 翻译成功后默认钉到当前屏幕右上角
- `钉住记录`
  - 由 `window.exports['screen-shot-translation-records']` 打开静态面板窗口
- `设置`
  - 由 `window.exports['screen-shot-translation-settings']` 打开静态面板窗口

当前运行壳文件：

- [public/plugin.json](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json)
- [public/panel.html](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/panel.html)
- [public/app.js](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.js)
- [public/app.css](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/app.css)
- [public/preload/services.js](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/services.js)
- [public/preload/panel-preload.js](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/preload/panel-preload.js)

当前已保留的业务能力：

- `设置` 页已支持：
  - `translationMode`
  - `saveTranslatedImage`
  - `saveDirectory`
  - `confirmBeforeDelete`
  - `百度 AppID / Access Token`
  - `themeMode`
  - `windowHeight`
- `钉住记录` 页已支持：
  - 读取保存目录总清单
  - 记录瀑布流展示
  - 默认 3 列，支持通过滑块调到 3~6 列并持久化
  - 删除记录时按设置决定是否二次确认
- `preload` 已接通：
  - 设置持久化
  - 保存目录总清单读取 / 删除 / 位置回写
  - 目录选择桥接
  - 官方 `screenCapture` 截图桥接
  - 百度图片翻译桥接（纯 V2，块级回填优先）
  - 百度凭证同步存储
  - 真实钉住窗口与重钉
  - 主流程失败归因

当前界面样式约束：

- 视觉基线按 Nothing 风格收口，深色模式优先，浅色模式同步维护
- 全局字体使用 `Doto / Space Grotesk / Space Mono`
- 主体界面文案保持中文，不再混入英文 UI 标签
- 主题强调色统一为 `#d71921`

当前推荐直接在设置页填写百度图片翻译凭证。凭证会保存到 uTools 同步数据库，并随同一账号在多设备间同步。

- 需要填写 `AppID + Access Token`
- 当前 V2 会优先使用块级 `contents[].paste_img` 在本地重新拼出译后图

开发态仍保留环境变量兜底，未在设置页填写时会继续尝试读取：

- `BAIDU_FANYI_APP_ID`
- `BAIDU_FANYI_ACCESS_TOKEN`

当前已知限制：

- 当前主流程不再追求“按截图原位置钉回”
- 首次钉图默认落到当前屏幕右上角；只有记录重钉时才优先回到上次保存位置
- GUI 级 smoke test 仍需在 uTools 里人工验证

常用命令：

- `npm test`
- `npm run build`
- `npm run dev`

开发 / 构建接入约定：

- 开发联调时，用 uTools 开发者工具接入 [public/plugin.json](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json)
- `npm run dev` 和 `npm run build` 当前都走静态复制脚本，会把 `public/` 同步成 `dist/`
- 构建产物验证时，用 [dist/plugin.json](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/dist/plugin.json)
- 当前 `plugin.json` 已不再配置 `main`，也不再配置 `development.main`
- 这意味着 `截屏翻译钉住` 不再经过自定义主窗口页面壳

如果要验证截图入口是否已经切到新的模板插件运行模型，按这个顺序：

1. 在 uTools 开发者工具里断开当前插件。
2. 重新接入 [public/plugin.json](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/public/plugin.json)。
3. 再触发 `截屏翻译钉住`。
4. 如果仍然先出现白色页面壳，说明 uTools 还没有真正切到新的模板插件入口模型。

旧的 `Vue / Vite / src/` 当前仍保留在仓库里，但它们已经退出运行路径，只作为迁移期冻结代码保留。
