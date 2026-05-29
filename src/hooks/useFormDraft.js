import { useEffect, useRef, useState } from 'react'

/**
 * useFormDraft — auto-save form state to localStorage with unsaved-change protection.
 *
 * Features:
 *   - Auto-saves form state to localStorage on every change (debounced 500ms)
 *   - Restores draft on mount if one exists (caller decides whether to apply it)
 *   - Warns user on tab close / refresh if there are unsaved changes
 *   - Provides `clearDraft()` for after successful save
 *   - Provides `hasUnsavedChanges` flag for in-app navigation guards
 *
 * Usage:
 *   const { savedDraft, isDirty, clearDraft, markClean } = useFormDraft({
 *     key: 'truckquote-new-quote-draft',
 *     userId: profile?.id,
 *     form,
 *     installs,  // any additional state to persist alongside
 *   })
 *
 *   // On mount, if savedDraft is non-null, prompt user to restore
 *   // On successful save, call clearDraft()
 */
export function useFormDraft({ key, userId, ...stateToWatch }) {
  // Compose the actual storage key (per-user if provided)
  const storageKey = userId ? `${key}::${userId}` : key

  // Track whether the form has been modified since last save/clear
  const [isDirty, setIsDirty] = useState(false)

  // Hold the draft that was loaded on mount (so the caller can decide to restore it)
  const [savedDraft, setSavedDraft] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  // Debounced auto-save to localStorage
  const debounceTimer = useRef(null)
  const isFirstRun = useRef(true)

  useEffect(() => {
    // Skip the very first run so we don't immediately mark clean state dirty
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    setIsDirty(true)

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({
          ...stateToWatch,
          _savedAt: new Date().toISOString(),
        }))
      } catch (e) {
        console.error('useFormDraft: localStorage save failed', e)
      }
    }, 500)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
    // We intentionally serialize stateToWatch to detect deep changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stateToWatch), storageKey])

  // beforeunload warning — fires on tab close, refresh, hard navigation
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      // Most modern browsers ignore custom messages but require returnValue to be set
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function clearDraft() {
    try {
      window.localStorage.removeItem(storageKey)
    } catch (e) {
      console.error('useFormDraft: localStorage clear failed', e)
    }
    setSavedDraft(null)
    setIsDirty(false)
  }

  function markClean() {
    setIsDirty(false)
  }

  function dismissDraft() {
    // User chose "start fresh" — clear from storage AND drop from state
    clearDraft()
  }

  return {
    savedDraft,    // null or the previously-saved draft object (with _savedAt timestamp)
    isDirty,       // true if state has changed since last save/clear
    clearDraft,    // call after successful submit
    markClean,     // mark dirty -> clean without removing storage (rare)
    dismissDraft,  // user chose not to restore the saved draft
  }
}
