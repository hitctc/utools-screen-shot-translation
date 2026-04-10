export type BookmarkSourceRoot = 'bookmark_bar' | 'other' | 'synced'
export type BookmarkThemeMode = 'system' | 'dark' | 'light'
export type BookmarkResolvedTheme = 'dark' | 'light'

export interface BookmarkItem {
  id: string
  title: string
  url: string
  folderPath: string[]
  sourceRoot: BookmarkSourceRoot
  dateAdded: string
}

export interface BookmarkCardItem extends BookmarkItem {
  isPinned: boolean
  openCount: number
}

export interface BookmarkRecentRecord {
  bookmarkId: string
  openedAt: number
  openCount: number
}

export interface BookmarkUiSettings {
  showRecentOpened: boolean
  showOpenCount: boolean
  themeMode: BookmarkThemeMode
  windowHeight: number
}

export interface BookmarkCardEntry {
  cardKey: string
  item: BookmarkCardItem
}

export interface BookmarkSection {
  key: string
  title: string
  entries: BookmarkCardEntry[]
}
