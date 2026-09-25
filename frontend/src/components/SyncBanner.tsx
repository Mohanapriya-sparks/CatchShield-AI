import { useState, useEffect } from 'react'
import { getPendingBatches } from '../offlineQueue'

export function SyncBanner() {
  const [pendingCount, setPendingCount] = useState(0)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    let prev = 0
    const check = async () => {
      try {
        const items = await getPendingBatches()
        const pending = items.filter(i => i.status === 'PENDING_SYNC').length
        if (prev > 0 && pending === 0) setJustSynced(true)
        prev = pending
        setPendingCount(pending)
      } catch {
        // IndexedDB not available (e.g. SSR)
      }
    }
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (justSynced) {
      const t = setTimeout(() => setJustSynced(false), 3000)
      return () => clearTimeout(t)
    }
  }, [justSynced])

  if (justSynced) {
    return (
      <div className="sync-banner sync-done">
        ✓ All records synced
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="sync-banner sync-pending">
        ⏳ PENDING SYNC ({pendingCount} record{pendingCount > 1 ? 's' : ''})
      </div>
    )
  }

  return null
}
