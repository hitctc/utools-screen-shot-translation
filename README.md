# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件，目标是在桌面上完成“截屏 -> 翻译 -> 原位置钉住结果”。

当前版本已经接通第一阶段的入口、设置和记录交互：

- `plugin.json` 已提供 3 个入口：
  - `截屏翻译钉住`
  - `钉住记录`
  - `设置`
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
  - 缩略图点击走重钉交互闭环
  - 删除记录时按设置决定是否二次确认
- `preload` 已接通：
  - 设置持久化
  - 保存目录总清单读取 / 删除
  - 目录选择桥接
  - 真实截图桥接
  - 百度图片翻译桥接
  - 百度凭证同步存储
  - 主流程失败归因
  - 重钉失败闭环占位

当前仍未完成的能力：

- 真实钉住窗口与重钉
- 主流程成功时“无页面直接完成”的最终闭环

当前推荐直接在设置页填写百度图片翻译凭证。凭证会保存到 uTools 同步数据库，并随同一账号在多设备间同步。

开发态仍保留环境变量兜底，未在设置页填写时会继续尝试读取：

- `BAIDU_FANYI_APP_ID`
- `BAIDU_FANYI_APP_KEY`

如果设置页和环境变量都没有提供完整凭证，`截屏翻译钉住` 在截图完成后会进入 `translation-config-invalid` 失败结果页。

常用命令：

- `npm test`
- `npm run build`
- `npm run dev`
