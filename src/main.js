import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import { dismissBootShell } from './bootShell.js'
import { installRuntimeDiagnostics, renderRuntimeDiagnostic } from './runtimeDiagnostics.js'

installRuntimeDiagnostics(window, document)

try {
  const app = createApp(App)

  // Vue 组件树里的异常同样要落到页面里，否则 uTools 里会退化成没有线索的白屏。
  app.config.errorHandler = (error, _instance, info) => {
    renderRuntimeDiagnostic(document, error, `vue-error:${info || 'unknown'}`)
  }

  app.mount('#app')
  dismissBootShell(document)
} catch (error) {
  renderRuntimeDiagnostic(document, error, 'app-mount')
}
