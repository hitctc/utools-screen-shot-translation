(function () {
  var DEFAULT_DEV_URL = 'http://127.0.0.1:5173/index.html'
  var root = document.documentElement
  var statusNode = document.getElementById('dev-entry-status')
  var linkNode = document.getElementById('dev-entry-link')

  function setStatus(message) {
    if (statusNode) {
      statusNode.textContent = message
    }
  }

  function setLink(url) {
    if (!linkNode) {
      return
    }

    linkNode.href = url
    linkNode.textContent = url
  }

  // public/plugin.json 即使没有命中 development.main，也要能通过这个兜底页把开发入口拉起来。
  function resolveDevEntryUrl(locationLike) {
    var candidate = DEFAULT_DEV_URL

    if (
      locationLike &&
      typeof locationLike.search === 'string' &&
      locationLike.search.indexOf('devMain=') >= 0
    ) {
      try {
        var params = new URLSearchParams(locationLike.search)
        var value = params.get('devMain')
        if (value) {
          candidate = value
        }
      } catch (_error) {
        candidate = DEFAULT_DEV_URL
      }
    }

    return candidate
  }

  function showServerHint(url) {
    root.setAttribute('data-dev-fallback-ready', 'true')
    setStatus('开发服务器没有响应。请先运行 npm run dev，或改为接入 dist/plugin.json。')
    setLink(url)
  }

  async function boot() {
    var devUrl = resolveDevEntryUrl(window.location)
    setLink(devUrl)
    setStatus('正在连接开发服务器…')

    try {
      var response = await fetch(devUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
      })

      if (!response || !response.ok) {
        showServerHint(devUrl)
        return
      }

      window.location.replace(devUrl)
    } catch (_error) {
      showServerHint(devUrl)
    }
  }

  window.__SCREEN_TRANSLATION_DEV_ENTRY__ = {
    resolveDevEntryUrl: resolveDevEntryUrl,
  }

  void boot()
})()
