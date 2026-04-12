// 面板窗口和主流程入口解耦后，records/settings/result 都通过单独 browser window 承载。
// 这里复用已有 services bridge，并额外监听 panel init 事件，把视图初始化数据交给 panel.html 的 jQuery 页面壳。
require('./services.js')

const { ipcRenderer } = require('electron')

window.__PANEL_INIT__ = window.__PANEL_INIT__ || {
  view: 'records',
  result: null,
}

if (ipcRenderer && typeof ipcRenderer.on === 'function') {
  ipcRenderer.on('screen-shot-translation:panel-init', (_event, payload) => {
    const nextPayload = payload && typeof payload === 'object' ? payload : { view: 'records', result: null }

    window.__PANEL_INIT__ = nextPayload

    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('screen-shot-translation:panel-init', {
          detail: nextPayload,
        }),
      )
    }
  })
}
