const RECORD_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

// 失败结果页必须始终给用户一个可读标题和可点击出口，未知失败码也不能例外。
export function mapWorkflowFailureToResult(code) {
  switch (code) {
    case 'capture-cancelled':
      return {
        title: '截屏被取消',
        message: '你取消了截屏，这次流程没有继续往下执行。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
    case 'translation-failed':
      return {
        title: '翻译失败',
        message: '截屏已经完成，但翻译步骤没有成功。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
    case 'save-config-invalid':
      return {
        title: '保存配置还没准备好',
        message: '保存结果已开启，但还没有设置可写入的保存目录。',
        showRetry: false,
        showOpenSettings: true,
        showClose: true,
      }
    case 'save-failed':
      return {
        title: '结果保存失败',
        message: '翻译结果已经生成，但写入磁盘时出错了。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
    case 'pin-failed':
      return {
        title: '钉住失败',
        message: '这次没有把结果钉住到屏幕上。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
    case 'repin-failed':
      return {
        title: '重钉失败',
        message: '记录页里的重钉动作暂时没有完成。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
    default:
      return {
        title: '这次没有完成钉住',
        message: '流程执行失败，请重试。',
        showRetry: true,
        showOpenSettings: false,
        showClose: true,
      }
  }
}

// manifest 里的本地图片路径需要转成浏览器和 uTools 都能识别的 file URL。
function toRecordImagePath(imagePath) {
  if (imagePath.startsWith('file://')) {
    return imagePath
  }

  if (/^[A-Za-z]:[\\/]/.test(imagePath)) {
    return `file:///${encodeURI(imagePath.replace(/\\/g, '/'))}`
  }

  if (imagePath.startsWith('\\\\')) {
    return `file://${encodeURI(imagePath.replace(/\\/g, '/').replace(/^\/+/, ''))}`
  }

  if (imagePath.startsWith('/')) {
    return `file://${encodeURI(imagePath)}`
  }

  return imagePath
}

// 记录页不相信 manifest 时间字符串一定可信，脏时间统一回退成“时间未知”。
function formatRecordCreatedAtLabel(createdAt) {
  if (typeof createdAt !== 'string' || !createdAt.trim()) {
    return '时间未知'
  }

  const parsedDate = new Date(createdAt)
  return Number.isNaN(parsedDate.getTime()) ? '时间未知' : RECORD_DATE_FORMATTER.format(parsedDate)
}

// 记录页只吃最小卡片模型，不把 manifest 原始结构直接暴露给组件。
export function mapSavedRecordToViewRecord(record, index, saveDirectory) {
  if (!record || typeof record.id !== 'string' || typeof record.imageFilename !== 'string') {
    return null
  }

  const imageFilename = record.imageFilename.trim()
  if (!imageFilename) {
    return null
  }

  const hasAbsolutePrefix =
    imageFilename.startsWith('/') ||
    imageFilename.startsWith('file://') ||
    /^[A-Za-z]:[\\/]/.test(imageFilename) ||
    imageFilename.startsWith('\\\\')
  const normalizedDirectory = typeof saveDirectory === 'string' ? saveDirectory.trim().replace(/[\\/]+$/, '') : ''
  const absoluteImagePath = hasAbsolutePrefix
    ? imageFilename
    : normalizedDirectory
      ? `${normalizedDirectory}/${imageFilename.replace(/^[/\\]+/, '')}`
      : imageFilename

  return {
    id: record.id,
    imagePath: toRecordImagePath(absoluteImagePath),
    createdAtLabel: formatRecordCreatedAtLabel(record.createdAt),
    orderLabel: `#${String(index + 1).padStart(2, '0')}`,
  }
}
