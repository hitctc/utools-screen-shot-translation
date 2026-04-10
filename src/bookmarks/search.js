import { pinyin } from 'pinyin-pro'

const TITLE_SEARCH_ALIAS_CACHE = new Map()

function toSafeText(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function normalizeAliasText(value) {
  return toSafeText(value).trim().toLowerCase()
}

function toSearchTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return []
  }

  return tokens.map(token => normalizeAliasText(token)).filter(Boolean)
}

function tokenMatchesText(token, text) {
  return normalizeAliasText(text).includes(token)
}

function hasChineseCharacter(text) {
  return /[\u3400-\u9fff]/u.test(text)
}

function getCharacterAliasParts(character) {
  const normalizedCharacter = normalizeAliasText(character)

  if (!normalizedCharacter) {
    return {
      fullPinyin: '',
      initials: '',
    }
  }

  if (!hasChineseCharacter(normalizedCharacter)) {
    return {
      fullPinyin: normalizedCharacter,
      initials: normalizedCharacter,
    }
  }

  return {
    fullPinyin: normalizeAliasText(
      pinyin(normalizedCharacter, { toneType: 'none' }).replace(/\s+/g, ''),
    ),
    initials: normalizeAliasText(
      pinyin(normalizedCharacter, { pattern: 'first', toneType: 'none' }).replace(/\s+/g, ''),
    ),
  }
}

// 标题拼音索引只在中文标题场景下生成，避免把英文标题也扩成额外搜索语义。
function getTitleSearchAliases(title) {
  const normalizedTitle = normalizeAliasText(title)

  if (!normalizedTitle) {
    return {
      normalizedTitle: '',
      fullPinyin: '',
      initials: '',
      fullPinyinRanges: [],
      initialsRanges: [],
    }
  }

  const cachedAliases = TITLE_SEARCH_ALIAS_CACHE.get(normalizedTitle)
  if (cachedAliases) {
    return cachedAliases
  }

  const aliases = {
    normalizedTitle,
    fullPinyin: '',
    initials: '',
    fullPinyinRanges: [],
    initialsRanges: [],
  }

  if (hasChineseCharacter(normalizedTitle)) {
    let fullPinyinOffset = 0
    let initialsOffset = 0

    for (let characterIndex = 0; characterIndex < normalizedTitle.length; characterIndex += 1) {
      const character = normalizedTitle[characterIndex]
      const characterAliases = getCharacterAliasParts(character)

      if (characterAliases.fullPinyin) {
        aliases.fullPinyinRanges.push({
          titleStart: characterIndex,
          titleEnd: characterIndex + 1,
          aliasStart: fullPinyinOffset,
          aliasEnd: fullPinyinOffset + characterAliases.fullPinyin.length,
        })
        aliases.fullPinyin += characterAliases.fullPinyin
        fullPinyinOffset += characterAliases.fullPinyin.length
      }

      if (characterAliases.initials) {
        aliases.initialsRanges.push({
          titleStart: characterIndex,
          titleEnd: characterIndex + 1,
          aliasStart: initialsOffset,
          aliasEnd: initialsOffset + characterAliases.initials.length,
        })
        aliases.initials += characterAliases.initials
        initialsOffset += characterAliases.initials.length
      }
    }
  }

  TITLE_SEARCH_ALIAS_CACHE.set(normalizedTitle, aliases)
  return aliases
}

function buildStableSegments(text) {
  return [{ text: toSafeText(text), matched: false }]
}

// 把用户输入拆成稳定的搜索 token，方便后续做 AND 匹配。
export function normalizeSearchTokens(query) {
  const text = toSafeText(query).trim()

  if (!text) {
    return []
  }

  return text.split(/\s+/).map(token => token.toLowerCase()).filter(Boolean)
}

// 尝试从书签 URL 里提取可展示的站点标签，解析失败时回退原始文本。
export function getBookmarkSiteLabel(url) {
  const text = toSafeText(url).trim()

  if (!text) {
    return ''
  }

  try {
    return new URL(text).host
  } catch {
    return text
  }
}

// 把目录路径格式化成统一的展示文本，空目录时回退到“未分类”。
export function getBookmarkFolderLabel(folderPath) {
  if (!Array.isArray(folderPath)) {
    return '未分类'
  }

  const labels = folderPath
    .map(segment => toSafeText(segment).trim())
    .filter(Boolean)

  return labels.length ? labels.join(' / ') : '未分类'
}

function getBookmarkRootLabel(sourceRoot) {
  if (sourceRoot === 'bookmark_bar') {
    return '书签栏'
  }

  if (sourceRoot === 'other') {
    return '其他书签'
  }

  if (sourceRoot === 'synced') {
    return '已同步'
  }

  return '未分类'
}

// 把 Chrome 书签真实目录路径格式化成可读文案，保留根目录和文件夹层级。
export function getBookmarkPathLabel(folderPath, sourceRoot) {
  const rootLabel = getBookmarkRootLabel(sourceRoot)
  const labels = Array.isArray(folderPath)
    ? folderPath.map(segment => toSafeText(segment).trim()).filter(Boolean)
    : []

  return [rootLabel, ...labels].join('/')
}

function applyMatchedRange(matchedFlags, start, end) {
  if (!Array.isArray(matchedFlags) || matchedFlags.length === 0) {
    return
  }

  const rangeStart = Math.max(0, start)
  const rangeEnd = Math.min(matchedFlags.length, end)

  for (let index = rangeStart; index < rangeEnd; index += 1) {
    matchedFlags[index] = true
  }
}

// 按 token 做大小写不敏感高亮，额外支持把拼音命中的中文字符范围并入标题高亮。
export function buildHighlightedSegments(text, tokens, extraMatchedRanges = []) {
  const sourceText = toSafeText(text)
  const searchTokens = toSearchTokens(tokens)

  if (!sourceText) {
    return [{ text: '', matched: false }]
  }

  if (!searchTokens.length) {
    return [{ text: sourceText, matched: false }]
  }

  const lowerText = sourceText.toLowerCase()
  const matchedFlags = Array.from({ length: sourceText.length }, () => false)

  for (const token of searchTokens) {
    let startIndex = 0

    while (startIndex < lowerText.length) {
      const foundIndex = lowerText.indexOf(token, startIndex)
      if (foundIndex === -1) {
        break
      }

      for (let index = foundIndex; index < foundIndex + token.length; index += 1) {
        matchedFlags[index] = true
      }

      startIndex = foundIndex + Math.max(token.length, 1)
    }
  }

  for (const range of extraMatchedRanges) {
    if (!range || typeof range.start !== 'number' || typeof range.end !== 'number') {
      continue
    }

    applyMatchedRange(matchedFlags, range.start, range.end)
  }

  const segments = []
  let segmentStart = 0
  let segmentMatched = matchedFlags[0]

  for (let index = 1; index < sourceText.length; index += 1) {
    if (matchedFlags[index] !== segmentMatched) {
      segments.push({
        text: sourceText.slice(segmentStart, index),
        matched: segmentMatched,
      })
      segmentStart = index
      segmentMatched = matchedFlags[index]
    }
  }

  segments.push({
    text: sourceText.slice(segmentStart),
    matched: segmentMatched,
  })

  return segments
}

function getFieldSegments(text, shouldHighlight, tokens, extraMatchedRanges = []) {
  return shouldHighlight ? buildHighlightedSegments(text, tokens, extraMatchedRanges) : buildStableSegments(text)
}

function getTitleAliasMatchRange(token, aliasText, aliasRanges) {
  if (!token || !aliasText || !Array.isArray(aliasRanges) || !aliasRanges.length) {
    return null
  }

  for (const boundary of aliasRanges) {
    const aliasStart = boundary.aliasStart

    if (!aliasText.startsWith(token, aliasStart)) {
      continue
    }

    const aliasEnd = aliasStart + token.length
    let titleStart = Number.POSITIVE_INFINITY
    let titleEnd = -1

    for (const range of aliasRanges) {
      if (range.aliasEnd <= aliasStart || range.aliasStart >= aliasEnd) {
        continue
      }

      titleStart = Math.min(titleStart, range.titleStart)
      titleEnd = Math.max(titleEnd, range.titleEnd)
    }

    if (!Number.isFinite(titleStart) || titleEnd === -1) {
      continue
    }

    return {
      start: titleStart,
      end: titleEnd,
    }
  }

  return null
}

function getTitleExtraHighlightRanges(tokenMatches) {
  if (!Array.isArray(tokenMatches) || !tokenMatches.length) {
    return []
  }

  return tokenMatches.flatMap(entry => {
    const ranges = []

    if (entry.titleFullPinyinRange) {
      ranges.push(entry.titleFullPinyinRange)
    }

    if (entry.titleInitialsRange) {
      ranges.push(entry.titleInitialsRange)
    }

    return ranges
  })
}

// 搜索结果只展示一个最主要的命中来源，避免卡片底部堆出多枚标签影响扫描效率。
function getPrimaryMatchMeta(tokenMatches, matches) {
  if (!matches || !Array.isArray(tokenMatches) || !tokenMatches.length) {
    return {
      label: '',
      token: '',
    }
  }

  if (tokenMatches.some(entry => entry.titleText)) {
    return {
      label: '标题',
      token: '',
    }
  }

  // 拼音标签继续细分成全拼和简拼，方便用户判断这次结果到底是怎么被召回的。
  const fullPinyinMatch = tokenMatches.find(entry => entry.titleFullPinyinRange)
  if (fullPinyinMatch) {
    return {
      label: '全拼',
      token: fullPinyinMatch.token,
    }
  }

  const initialsMatch = tokenMatches.find(entry => entry.titleInitialsRange)
  if (initialsMatch) {
    return {
      label: '简拼',
      token: initialsMatch.token,
    }
  }

  if (tokenMatches.some(entry => entry.site)) {
    return {
      label: '域名',
      token: '',
    }
  }

  if (tokenMatches.some(entry => entry.folder || entry.path)) {
    return {
      label: '路径',
      token: '',
    }
  }

  return {
    label: '',
    token: '',
  }
}

// 汇总一个书签的可搜索信息，并判断它是否满足多关键词 AND 搜索。
export function getBookmarkSearchMeta(item, tokens) {
  const searchTokens = toSearchTokens(tokens)
  const title = toSafeText(item?.title).trim() || '未命名书签'
  const url = toSafeText(item?.url).trim()
  const folderLabel = getBookmarkFolderLabel(item?.folderPath)
  const siteLabel = getBookmarkSiteLabel(url)
  const pathLabel = getBookmarkPathLabel(item?.folderPath, item?.sourceRoot)
  const titleAliases = getTitleSearchAliases(title)

  const tokenMatches = searchTokens.map(token => ({
    token,
    titleText: tokenMatchesText(token, titleAliases.normalizedTitle),
    titleFullPinyinRange: getTitleAliasMatchRange(token, titleAliases.fullPinyin, titleAliases.fullPinyinRanges),
    titleInitialsRange: getTitleAliasMatchRange(token, titleAliases.initials, titleAliases.initialsRanges),
    folder: tokenMatchesText(token, folderLabel),
    site: tokenMatchesText(token, siteLabel),
    path: tokenMatchesText(token, pathLabel),
  }))

  const matches = searchTokens.length
    ? tokenMatches.every(
        entry =>
          entry.titleText
          || entry.titleFullPinyinRange
          || entry.titleInitialsRange
          || entry.folder
          || entry.site
          || entry.path,
      )
    : true

  const urlOnlyMatch = false

  const primaryMatchMeta = getPrimaryMatchMeta(tokenMatches, matches)

  return {
    matches,
    urlOnlyMatch,
    primaryMatchLabel: primaryMatchMeta.label,
    primaryMatchToken: primaryMatchMeta.token,
    title,
    url,
    folderLabel,
    siteLabel,
    pathLabel,
    highlightedTitleSegments: getFieldSegments(title, matches, searchTokens, getTitleExtraHighlightRanges(tokenMatches)),
    highlightedUrlSegments: getFieldSegments(url, matches, searchTokens),
    highlightedFolderSegments: getFieldSegments(folderLabel, matches, searchTokens),
    highlightedSiteSegments: getFieldSegments(siteLabel, matches, searchTokens),
    highlightedPathSegments: getFieldSegments(pathLabel, matches, searchTokens),
  }
}
