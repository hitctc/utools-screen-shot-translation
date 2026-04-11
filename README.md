# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件，当前主线先以“稳定进入页面、稳定截图、稳定翻译失败闭环”为优先。

当前正式入口：

- `截屏翻译钉住`
- `钉住记录`
- `设置`

当前稳定主线能力：

- `设置` 页已支持：
  - `translationMode`
  - `saveTranslatedImage`
  - `saveDirectory`
  - `confirmBeforeDelete`
  - `百度 AppID / AppKey`
  - `themeMode`
  - `windowHeight`
- `钉住记录` 页已支持：
  - 读取保存目录总清单
  - 记录瀑布流展示
  - 删除记录时按设置决定是否二次确认
- `preload` 已接通：
  - 设置持久化
  - 保存目录总清单读取 / 删除
  - 目录选择桥接
  - `uTools.screenCapture` 官方截图桥接
  - 百度图片翻译桥接
  - 百度凭证同步存储
  - 主流程失败归因

当前主流程语义：

- `截屏翻译钉住`
  - 先走 `uTools.screenCapture`
  - 再走百度图片翻译
  - 当前不会进入真实钉住窗口
  - 翻译成功后会落到 `pin-failed` 失败结果页
- `钉住记录`
  - 当前只承载记录浏览和删除
  - 重钉能力暂时未接通，会走 `repin-failed` 失败闭环

当前推荐直接在设置页填写百度图片翻译凭证。凭证会保存到 uTools 同步数据库，并随同一账号在多设备间同步。

开发态仍保留环境变量兜底，未在设置页填写时会继续尝试读取：

- `BAIDU_FANYI_APP_ID`
- `BAIDU_FANYI_APP_KEY`

如果设置页和环境变量都没有提供完整凭证，`截屏翻译钉住` 在截图完成后会进入 `translation-config-invalid` 失败结果页。

当前已知限制：

- 主线已回退到官方截图桥接，自定义截图和真实钉住不再挂在当前主流程上
- `钉住记录` 当前不会执行真实重钉
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
