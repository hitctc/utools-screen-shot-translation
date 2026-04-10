const path = require('node:path')

// 生成 macOS 下 Google Chrome 默认 profile 的书签文件路径。
function getDefaultChromeBookmarksPath(homeDir) {
  return path.join(
    homeDir,
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'Default',
    'Bookmarks',
  )
}

// 用户已保存路径存在时优先使用，否则回退到默认 Chrome 路径。
function getEffectiveChromeBookmarksPath(homeDir, savedPath) {
  const trimmed = typeof savedPath === 'string' ? savedPath.trim() : ''
  return trimmed || getDefaultChromeBookmarksPath(homeDir)
}

// 云端同步过来的路径在当前设备上可能并不存在，所以这里按设备本地可读性兜底。
function getReadableStoredChromeBookmarksPath(homeDir, savedPath, canAccessPath) {
  const trimmed = typeof savedPath === 'string' ? savedPath.trim() : ''
  if (trimmed && typeof canAccessPath === 'function' && canAccessPath(trimmed)) {
    return trimmed
  }

  return getDefaultChromeBookmarksPath(homeDir)
}

// 递归展开 Chrome 书签树，只保留真正的 url 叶子节点。
function flattenNodes(nodes, sourceRoot, folderPath = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return []
  }

  return nodes.flatMap(node => {
    if (!node || typeof node !== 'object') {
      return []
    }

    if (node.type === 'folder') {
      const nextFolderPath = node.name ? [...folderPath, node.name] : folderPath
      return flattenNodes(node.children, sourceRoot, nextFolderPath)
    }

    if (node.type !== 'url' || typeof node.url !== 'string' || node.url.length === 0) {
      return []
    }

    return [
      {
        id: String(node.id ?? ''),
        title: typeof node.name === 'string' ? node.name : '',
        url: node.url,
        folderPath,
        sourceRoot,
        dateAdded: typeof node.date_added === 'string' ? node.date_added : '',
      },
    ]
  })
}

// 解析 Chrome Bookmarks JSON 文本，输出前端可直接消费的扁平书签数组。
function parseChromeBookmarksText(text) {
  const json = JSON.parse(text)
  const items = [
    ...flattenNodes(json?.roots?.bookmark_bar?.children, 'bookmark_bar'),
    ...flattenNodes(json?.roots?.other?.children, 'other'),
    ...flattenNodes(json?.roots?.synced?.children, 'synced'),
  ]

  return {
    total: items.length,
    items,
  }
}

module.exports = {
  getDefaultChromeBookmarksPath,
  getEffectiveChromeBookmarksPath,
  getReadableStoredChromeBookmarksPath,
  parseChromeBookmarksText,
}
