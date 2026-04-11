import { createApp } from 'vue'
import './main.css'
import App from './App.vue'
import { dismissBootShell } from './bootShell.js'

const app = createApp(App)
app.mount('#app')
dismissBootShell(document)
