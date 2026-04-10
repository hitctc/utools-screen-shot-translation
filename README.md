# uTools Screen Shot Translation

一个放在 uTools 里的截屏翻译插件，目标是在桌面上完成“截屏 -> 翻译 -> 原位置钉住结果”。

当前版本已经接通首个真实闭环：

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
  - 缩略图点击按上次位置重钉
  - 删除记录时按设置决定是否二次确认
- `preload` 已接通：
  - 设置持久化
  - 保存目录总清单读取 / 保存 / 删除 / 位置回写
  - 目录选择桥接
  - 自定义截图桥接
  - 百度图片翻译桥接
  - 百度凭证同步存储
  - 真实钉住窗口与重钉
  - 主流程失败归因

当前已经支持的真实行为：

- `截屏翻译钉住`
  - 拉起自定义截图选区
  - 把翻译结果钉到原截图位置
  - 成功时直接隐藏主窗口，不再落结果页
- 钉住窗口
  - 可拖动
  - 不穿透点击
  - 双击关闭
  - 关闭后保留最后位置
- `钉住记录`
  - 点击缩略图按 `lastPinBounds` 重钉
  - 同一张图已钉住时会提示“该图片已经钉住，不能重复钉住。”
- 开启保存且目录已设置时
  - 翻译结果会写入保存目录
  - 同时更新 `.screen-translation-records.json`

当前推荐直接在设置页填写百度图片翻译凭证。凭证会保存到 uTools 同步数据库，并随同一账号在多设备间同步。

开发态仍保留环境变量兜底，未在设置页填写时会继续尝试读取：

- `BAIDU_FANYI_APP_ID`
- `BAIDU_FANYI_APP_KEY`

如果设置页和环境变量都没有提供完整凭证，`截屏翻译钉住` 在截图完成后会进入 `translation-config-invalid` 失败结果页。

当前已知限制：

- 自定义截图当前优先取“鼠标所在屏幕”，还没有做跨屏拼接选区
- 钉住窗口状态是进程内态；uTools 或插件进程退出后，会失去“当前已钉住”判定，但保存记录和最后位置仍会保留在 manifest 里
- GUI 级 smoke test 仍需在 uTools 里人工验证

常用命令：

- `npm test`
- `npm run build`
- `npm run dev`
