export function dismissBootShell(documentLike = document) {
  // 先标记应用已经接管页面，后续如果需要做更细的首屏态判断，可以直接复用这个标记。
  documentLike.documentElement?.setAttribute('data-app-ready', 'true')

  const bootShell = documentLike.getElementById('app-boot-shell')
  if (!bootShell?.parentNode) {
    return
  }

  // 挂载完成后直接移除静态壳子，避免它和真实首页短暂重叠。
  bootShell.parentNode.removeChild(bootShell)
}
