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

// 清单里只认 ISO 时间字符串，越新的记录排在越前面。
function sortRecordsByCreatedAtDesc(records) {
  return [...(Array.isArray(records) ? records : [])].sort((left, right) =>
    String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
  )
}

// 统一把记录文件名解析成实际路径，兼容绝对路径和相对路径两种写法。
function resolveRecordPath({ path, directoryPath, record }) {
  const filename = record && typeof record.imageFilename === 'string' ? record.imageFilename : ''

  if (!filename) {
    return ''
  }

  if (path.isAbsolute(filename)) {
    return filename
  }

  return path.join(directoryPath, filename)
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
  if (!directoryPath) {
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
  if (!directoryPath) {
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

  if (!directoryPath || !recordId) {
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
      } catch {
        // 图片文件已经不存在时，删除记录仍然要继续推进。
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

module.exports = {
  getManifestFilename,
  getEmptyRecordManifest,
  sortRecordsByCreatedAtDesc,
  reconcileRecords,
  readRecordManifest,
  writeRecordManifest,
  listSavedRecords,
  deleteSavedRecord,
}
