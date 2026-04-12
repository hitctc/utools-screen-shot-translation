# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件。

当前分支：`feature/custom-capture-pin`

当前这条分支已经把主流程重写成“官方截图 -> 百度翻译 -> 默认钉图”的实现线，不再把自定义截图 overlay 作为主路径。

当前正式入口：

- `截屏翻译钉住`
- `钉住记录`
- `设置`

当前分支能力：

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
- 卡片、按钮和状态标签优先使用轻边框和清晰层级，不再依赖玻璃拟态和厚重阴影

当前主流程语义：

- `截屏翻译钉住`
  - 先走 uTools 官方 `screenCapture(callback)`
  - 再走百度图片翻译
  - 翻译成功后默认钉到当前屏幕右上角
- `钉住记录`
  - 可按 `lastPinBounds` 真实重钉
  - 同一张图已钉住时只提示，不重复创建窗口

当前推荐直接在设置页填写百度图片翻译凭证。凭证会保存到 uTools 同步数据库，并随同一账号在多设备间同步。

- 需要填写 `AppID + Access Token`，启用百度图片翻译 `V2`
- 当前 V2 会优先使用块级 `contents[].paste_img` 在本地重新拼出译后图，尽量避免中译英时整图回填把文字压得过小

开发态仍保留环境变量兜底，未在设置页填写时会继续尝试读取：

- `BAIDU_FANYI_APP_ID`
- `BAIDU_FANYI_ACCESS_TOKEN`

如果设置页和环境变量都没有提供完整凭证，`截屏翻译钉住` 在截图完成后会进入 `translation-config-invalid` 失败结果页。

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
- 接入 `public/plugin.json` 前，先执行 `npm run dev`
- 构建产物验证时，用 [dist/plugin.json](/Users/tc-nihao/100-tc/700-code/100-center/utools-screen-shot-translation/dist/plugin.json)
- `npm run build` 会自动把 `dist/plugin.json` 里的 `development` 字段去掉，避免构建产物仍然回指本地 dev server
