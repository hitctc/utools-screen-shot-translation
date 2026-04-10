// 统一收口首页键盘导航决策，避免焦点和高亮逻辑散落在组件事件里。
export function getKeyboardNavigationResult({
  key,
  currentView,
  loading,
  hasError,
  highlightedIndex,
  entryCount,
  metaKey,
  ctrlKey,
  altKey,
}) {
  if (currentView !== 'home' || loading || hasError || metaKey || ctrlKey || altKey || entryCount <= 0) {
    return {
      action: 'noop',
      nextIndex: highlightedIndex,
      preventDefault: false,
      subInputBehavior: 'none',
    }
  }

  if (key === 'ArrowDown') {
    return {
      action: 'move',
      nextIndex: Math.min(highlightedIndex + 1, entryCount - 1),
      preventDefault: true,
      subInputBehavior: 'preserve',
    }
  }

  if (key === 'ArrowUp') {
    return {
      action: 'move',
      nextIndex: Math.max(highlightedIndex - 1, 0),
      preventDefault: true,
      subInputBehavior: 'preserve',
    }
  }

  if (key === 'Enter') {
    return {
      action: 'open-current',
      nextIndex: highlightedIndex,
      preventDefault: true,
      subInputBehavior: 'none',
    }
  }

  if (key === 'Escape') {
    return {
      action: 'focus-search',
      nextIndex: highlightedIndex,
      preventDefault: false,
      subInputBehavior: 'focus',
    }
  }

  return {
    action: 'noop',
    nextIndex: highlightedIndex,
    preventDefault: false,
    subInputBehavior: 'none',
  }
}
