import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const {
  getManifestFilename,
  getEmptyRecordManifest,
  sortRecordsByCreatedAtDesc,
  reconcileRecords,
  readRecordManifest,
  writeRecordManifest,
  listSavedRecords,
  deleteSavedRecord,
} = require('../../public/preload/recordStore.cjs')

function createFsMock({ manifestByPath = new Map(), existingPaths = new Set() } = {}) {
  const writes = []
  const unlinks = []

  return {
    fs: {
      existsSync(filePath) {
        return manifestByPath.has(filePath) || existingPaths.has(filePath)
      },
      promises: {
        async readFile(filePath, encoding) {
          assert.equal(encoding, 'utf8')
          if (!manifestByPath.has(filePath)) {
            throw new Error(`unexpected readFile: ${filePath}`)
          }

          return manifestByPath.get(filePath)
        },
        async writeFile(filePath, contents, encoding) {
          assert.equal(encoding, 'utf8')
          writes.push({ filePath, contents })
          manifestByPath.set(filePath, contents)
        },
        async unlink(filePath) {
          unlinks.push(filePath)
          existingPaths.delete(filePath)
        },
      },
    },
    writes,
    unlinks,
  }
}

test('getManifestFilename returns the saved record manifest name', () => {
  assert.equal(getManifestFilename(), '.screen-translation-records.json')
})

test('sortRecordsByCreatedAtDesc keeps newest record first', () => {
  const sorted = sortRecordsByCreatedAtDesc([
    { id: 'a', createdAt: '2026-04-10T10:00:00.000Z' },
    { id: 'b', createdAt: '2026-04-10T12:00:00.000Z' },
  ])

  assert.deepEqual(sorted.map((item) => item.id), ['b', 'a'])
})

test('reconcileRecords drops entries whose image file is missing', async () => {
  const result = await reconcileRecords({
    records: [{ id: 'a', imageFilename: 'missing.png', createdAt: '2026-04-10T12:00:00.000Z' }],
    fileExists: async () => false,
  })

  assert.deepEqual(result.records, [])
})

test('readRecordManifest returns an empty manifest when the file is missing', async () => {
  const { fs } = createFsMock({
    existingPaths: new Set(['/tmp/save']),
  })

  const result = await readRecordManifest({
    fs,
    path,
    directoryPath: '/tmp/save',
  })

  assert.deepEqual(result, getEmptyRecordManifest())
})

test('writeRecordManifest sorts records and stamps a fresh updatedAt value', async () => {
  const { fs, writes } = createFsMock({
    existingPaths: new Set(['/tmp/save']),
  })

  const result = await writeRecordManifest({
    fs,
    path,
    directoryPath: '/tmp/save',
    manifest: {
      records: [
        { id: 'a', createdAt: '2026-04-10T10:00:00.000Z' },
        { id: 'b', createdAt: '2026-04-10T12:00:00.000Z' },
      ],
    },
  })

  assert.equal(result.version, 1)
  assert.match(result.updatedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(result.records.map((item) => item.id), ['b', 'a'])
  assert.equal(writes.length, 1)
})

test('listSavedRecords reconciles missing files before returning the manifest', async () => {
  const manifestPath = path.join('/tmp/save', getManifestFilename())
  const { fs, writes } = createFsMock({
    manifestByPath: new Map([
      [
        manifestPath,
        JSON.stringify({
          version: 1,
          updatedAt: '2026-04-10T12:00:00.000Z',
          records: [
            { id: 'a', imageFilename: '/tmp/save/a.png', createdAt: '2026-04-10T10:00:00.000Z' },
            { id: 'b', imageFilename: '/tmp/save/b.png', createdAt: '2026-04-10T12:00:00.000Z' },
          ],
        }),
      ],
    ]),
    existingPaths: new Set(['/tmp/save', '/tmp/save/b.png']),
  })

  const result = await listSavedRecords({
    fs,
    path,
    settings: { saveDirectory: '/tmp/save' },
  })

  assert.deepEqual(result.records.map((item) => item.id), ['b'])
  assert.equal(writes.length, 1)
  assert.deepEqual(JSON.parse(writes[0].contents).records.map((item) => item.id), ['b'])
})

test('deleteSavedRecord removes the targeted record and its image file', async () => {
  const manifestPath = path.join('/tmp/save', getManifestFilename())
  const { fs, writes, unlinks } = createFsMock({
    manifestByPath: new Map([
      [
        manifestPath,
        JSON.stringify({
          version: 1,
          updatedAt: '2026-04-10T12:00:00.000Z',
          records: [
            { id: 'a', imageFilename: '/tmp/save/a.png', createdAt: '2026-04-10T10:00:00.000Z' },
            { id: 'b', imageFilename: '/tmp/save/b.png', createdAt: '2026-04-10T12:00:00.000Z' },
          ],
        }),
      ],
    ]),
    existingPaths: new Set(['/tmp/save', '/tmp/save/a.png', '/tmp/save/b.png']),
  })

  const result = await deleteSavedRecord({
    fs,
    path,
    settings: { saveDirectory: '/tmp/save' },
    recordId: 'a',
  })

  assert.deepEqual(result.records.map((item) => item.id), ['b'])
  assert.equal(unlinks.length, 1)
  assert.equal(unlinks[0], '/tmp/save/a.png')
  assert.equal(writes.length, 1)
})

test('deleteSavedRecord rejects absolute paths outside the save directory', async () => {
  const manifestPath = path.join('/tmp/save', getManifestFilename())
  const { fs, writes, unlinks } = createFsMock({
    manifestByPath: new Map([
      [
        manifestPath,
        JSON.stringify({
          version: 1,
          updatedAt: '2026-04-10T12:00:00.000Z',
          records: [
            { id: 'a', imageFilename: '/tmp/outside/a.png', createdAt: '2026-04-10T12:00:00.000Z' },
          ],
        }),
      ],
    ]),
    existingPaths: new Set(['/tmp/save', '/tmp/outside/a.png']),
  })

  const result = await deleteSavedRecord({
    fs,
    path,
    settings: { saveDirectory: '/tmp/save' },
    recordId: 'a',
  })

  assert.deepEqual(result.records, [])
  assert.equal(unlinks.length, 0)
  assert.equal(writes.length, 1)
})

test('deleteSavedRecord rejects traversal paths outside the save directory', async () => {
  const manifestPath = path.join('/tmp/save', getManifestFilename())
  const { fs, writes, unlinks } = createFsMock({
    manifestByPath: new Map([
      [
        manifestPath,
        JSON.stringify({
          version: 1,
          updatedAt: '2026-04-10T12:00:00.000Z',
          records: [
            { id: 'a', imageFilename: '../escape/a.png', createdAt: '2026-04-10T12:00:00.000Z' },
          ],
        }),
      ],
    ]),
    existingPaths: new Set(['/tmp/save', path.resolve('/tmp/save', '../escape/a.png')]),
  })

  const result = await deleteSavedRecord({
    fs,
    path,
    settings: { saveDirectory: '/tmp/save' },
    recordId: 'a',
  })

  assert.deepEqual(result.records, [])
  assert.equal(unlinks.length, 0)
  assert.equal(writes.length, 1)
})

test('deleteSavedRecord returns a no-op manifest when the save directory is missing', async () => {
  const { fs, writes, unlinks } = createFsMock()

  const result = await deleteSavedRecord({
    fs,
    path,
    settings: { saveDirectory: '/tmp/missing' },
    recordId: 'a',
  })

  assert.deepEqual(result, getEmptyRecordManifest())
  assert.equal(unlinks.length, 0)
  assert.equal(writes.length, 0)
})

test('deleteSavedRecord surfaces unlink failures other than missing files', async () => {
  const manifestPath = path.join('/tmp/save', getManifestFilename())
  const { fs } = createFsMock({
    manifestByPath: new Map([
      [
        manifestPath,
        JSON.stringify({
          version: 1,
          updatedAt: '2026-04-10T12:00:00.000Z',
          records: [
            { id: 'a', imageFilename: '/tmp/save/a.png', createdAt: '2026-04-10T12:00:00.000Z' },
          ],
        }),
      ],
    ]),
    existingPaths: new Set(['/tmp/save', '/tmp/save/a.png']),
  })

  fs.promises.unlink = async () => {
    const error = new Error('permission denied')
    error.code = 'EACCES'
    throw error
  }

  await assert.rejects(
    deleteSavedRecord({
      fs,
      path,
      settings: { saveDirectory: '/tmp/save' },
      recordId: 'a',
    }),
    (error) => error && error.code === 'EACCES',
  )
})
