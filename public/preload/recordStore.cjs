const RECORD_MANIFEST_FILENAME = '.screen-translation-records.json'
const RECORD_MANIFEST_VERSION = 1

// 记录清单只保留一个固定文件名，方便后续统一清理和迁移。
function getManifestFilename() {
  return RECORD_MANIFEST_FILENAME
}

// 空清单用于目录缺失、文件损坏或首次初始化时的兜底返回。
function getEmptyRecordManifest() {
  return {
    version: RECORD_MANIFEST_VERSION,
    updatedAt: '',
    records: [],
  }
}

// 钉住位置只接受完整的有限数值，避免把窗口脏态写进 manifest。
function normalizePinBounds(bounds) {
  const candidate = bounds && typeof bounds === 'object' ? bounds : {}
  const x = Math.round(Number(candidate.x))
  const y = Math.round(Number(candidate.y))
  const width = Math.round(Number(candidate.width))
  const height = Math.round(Number(candidate.height))

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

// 目录必须存在才能进行清理或重写，避免把 no-op 变成意外写盘。
function hasUsableSaveDirectory({ fs, directoryPath }) {
  if (!directoryPath || typeof directoryPath !== 'string') {
    return false
  }

  try {
    return fs.statSync(directoryPath).isDirectory()
  } catch {
    return false
  }
}

// 清单里只认 ISO 时间字符串，越新的记录排在越前面。
function sortRecordsByCreatedAtDesc(records) {
  return [...(Array.isArray(records) ? records : [])].sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
  )
}

// 统一把记录文件名解析成实际路径，并拒绝越过保存目录边界的路径。
function resolveRecordPath({ path, directoryPath, record }) {
  const filename = record && typeof record.imageFilename === 'string' ? record.imageFilename : ''

  if (!filename) {
    return null
  }

  const rootPath = path.resolve(directoryPath)
  const resolvedPath = path.resolve(rootPath, filename)
  const relativePath = path.relative(rootPath, resolvedPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }

  return resolvedPath
}

// 新记录文件名固定带时间戳和记录 id，既稳定可读，也方便人工排查目录内容。
function buildRecordImageFilename({ createdAt, recordId }) {
  const safeRecordId = String(recordId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
  const date = new Date(createdAt)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  const millisecond = String(date.getUTCMilliseconds()).padStart(3, '0')

  return `screen-translation-${year}${month}${day}-${hour}${minute}${second}-${millisecond}-${safeRecordId || 'record'}.png`
}

// 读完 manifest 后，先把缺文件的记录剔掉，再按时间倒序返回。
async function reconcileRecords({ records, fileExists }) {
  const validRecords = []
  const sourceRecords = Array.isArray(records) ? records : []

  for (const record of sourceRecords) {
    if (!record || typeof record !== 'object') {
      continue
    }

    if (typeof fileExists === 'function' && (await fileExists(record.imageFilename))) {
      validRecords.push(record)
    }
  }

  return { records: sortRecordsByCreatedAtDesc(validRecords) }
}

// manifest 文件只存一份，读取失败时统一回退到空清单，避免上层直接炸掉。
async function readRecordManifest({ fs, path, directoryPath }) {
  if (!hasUsableSaveDirectory({ fs, directoryPath })) {
    return getEmptyRecordManifest()
  }

  const manifestPath = path.join(directoryPath, getManifestFilename())

  if (!fs.existsSync(manifestPath)) {
    return getEmptyRecordManifest()
  }

  try {
    const parsed = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
    const records = Array.isArray(parsed.records) ? parsed.records : []

    return {
      version: RECORD_MANIFEST_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      records: sortRecordsByCreatedAtDesc(records),
    }
  } catch {
    return getEmptyRecordManifest()
  }
}

// 写回 manifest 前先统一排序，保证目录总清单始终是稳定顺序。
async function writeRecordManifest({ fs, path, directoryPath, manifest }) {
  if (!hasUsableSaveDirectory({ fs, directoryPath })) {
    return getEmptyRecordManifest()
  }

  const manifestPath = path.join(directoryPath, getManifestFilename())
  const nextManifest = {
    version: RECORD_MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    records: sortRecordsByCreatedAtDesc(manifest && manifest.records),
  }

  await fs.promises.writeFile(manifestPath, JSON.stringify(nextManifest, null, 2), 'utf8')
  return nextManifest
}

// list 接口会先清理缺失图片，再把整理后的总清单返回给上层。
async function listSavedRecords({ fs, path, settings }) {
  const directoryPath = settings && typeof settings.saveDirectory === 'string' ? settings.saveDirectory.trim() : ''
  if (!hasUsableSaveDirectory({ fs, directoryPath })) {
    return getEmptyRecordManifest()
  }

  const manifest = await readRecordManifest({ fs, path, directoryPath })
  const reconciled = await reconcileRecords({
    records: manifest.records,
    fileExists: async (filename) => {
      const recordPath = resolveRecordPath({
        path,
        directoryPath,
        record: { imageFilename: filename },
      })

      return recordPath ? fs.existsSync(recordPath) : false
    },
  })

  const changed =
    reconciled.records.length !== manifest.records.length ||
    reconciled.records.some((record, index) => record !== manifest.records[index])

  if (changed) {
    return writeRecordManifest({
      fs,
      path,
      directoryPath,
      manifest: {
        ...manifest,
        records: reconciled.records,
      },
    })
  }

  return {
    ...manifest,
    records: reconciled.records,
  }
}

// 删除单条记录时，先删图片文件，再把 manifest 里的对应条目同步清理掉。
async function deleteSavedRecord({ fs, path, settings, recordId }) {
  const directoryPath = settings && typeof settings.saveDirectory === 'string' ? settings.saveDirectory.trim() : ''

  if (!recordId || !hasUsableSaveDirectory({ fs, directoryPath })) {
    return getEmptyRecordManifest()
  }

  const manifest = await readRecordManifest({ fs, path, directoryPath })
  const reconciled = await reconcileRecords({
    records: manifest.records,
    fileExists: async (filename) => {
      const recordPath = resolveRecordPath({
        path,
        directoryPath,
        record: { imageFilename: filename },
      })

      return recordPath ? fs.existsSync(recordPath) : false
    },
  })

  const targetRecord = reconciled.records.find((record) => record && record.id === recordId)
  const nextRecords = reconciled.records.filter((record) => record && record.id !== recordId)

  if (targetRecord) {
    const recordPath = resolveRecordPath({ path, directoryPath, record: targetRecord })
    if (recordPath && fs.existsSync(recordPath)) {
      try {
        await fs.promises.unlink(recordPath)
      } catch (error) {
        if (!error || error.code !== 'ENOENT') {
          throw error
        }
      }
    }
  }

  return writeRecordManifest({
    fs,
    path,
    directoryPath,
    manifest: {
      ...manifest,
      records: nextRecords,
    },
  })
}

// 记录页和重钉桥接都需要按 id 取单条记录，这里统一复用清理后的 manifest 结果。
async function getSavedRecord({ fs, path, settings, recordId }) {
  if (!recordId || typeof recordId !== 'string') {
    return null
  }

  const manifest = await listSavedRecords({ fs, path, settings })
  return manifest.records.find((record) => record && record.id === recordId) ?? null
}

// 保存翻译结果时，同步把图片文件和记录清单一起落盘，避免两边状态分叉。
async function saveTranslatedRecord({
  fs,
  path,
  settings,
  translationResult,
  bounds,
  createId = () => `record-${Date.now()}`,
  now = () => new Date(),
}) {
  const directoryPath = settings && typeof settings.saveDirectory === 'string' ? settings.saveDirectory.trim() : ''
  const normalizedBounds = normalizePinBounds(bounds)
  const imageBase64 =
    translationResult && typeof translationResult.translatedImageBase64 === 'string'
      ? translationResult.translatedImageBase64.trim()
      : ''

  if (!hasUsableSaveDirectory({ fs, directoryPath }) || !normalizedBounds || !imageBase64) {
    return null
  }

  const createdAt = now().toISOString()
  const recordId = String(createId()).trim() || `record-${Date.now()}`
  const imageFilename = buildRecordImageFilename({ createdAt, recordId })
  const imagePath = path.join(directoryPath, imageFilename)
  const imageBuffer = Buffer.from(imageBase64, 'base64')
  const manifest = await readRecordManifest({ fs, path, directoryPath })
  const record = {
    id: recordId,
    imageFilename,
    createdAt,
    lastPinnedAt: createdAt,
    lastPinBounds: normalizedBounds,
  }

  await fs.promises.writeFile(imagePath, imageBuffer)
  const nextManifest = await writeRecordManifest({
    fs,
    path,
    directoryPath,
    manifest: {
      ...manifest,
      records: [...manifest.records.filter((item) => item && item.id !== recordId), record],
    },
  })

  return {
    manifest: nextManifest,
    record,
  }
}

// 钉住窗口拖动或关闭后，只更新最后一次成功存在的位置，不改动创建时间和图片文件。
async function updateSavedRecordPinState({
  fs,
  path,
  settings,
  recordId,
  bounds,
  now = () => new Date(),
}) {
  const directoryPath = settings && typeof settings.saveDirectory === 'string' ? settings.saveDirectory.trim() : ''
  const normalizedBounds = normalizePinBounds(bounds)

  if (!recordId || !hasUsableSaveDirectory({ fs, directoryPath }) || !normalizedBounds) {
    return null
  }

  const manifest = await listSavedRecords({ fs, path, settings: { saveDirectory: directoryPath } })
  let updatedRecord = null
  const nextRecords = manifest.records.map((record) => {
    if (!record || record.id !== recordId) {
      return record
    }

    updatedRecord = {
      ...record,
      lastPinnedAt: now().toISOString(),
      lastPinBounds: normalizedBounds,
    }

    return updatedRecord
  })

  if (!updatedRecord) {
    return null
  }

  await writeRecordManifest({
    fs,
    path,
    directoryPath,
    manifest: {
      ...manifest,
      records: nextRecords,
    },
  })

  return updatedRecord
}

module.exports = {
  getManifestFilename,
  getEmptyRecordManifest,
  normalizePinBounds,
  sortRecordsByCreatedAtDesc,
  reconcileRecords,
  readRecordManifest,
  writeRecordManifest,
  listSavedRecords,
  deleteSavedRecord,
  getSavedRecord,
  saveTranslatedRecord,
  updateSavedRecordPinState,
}
