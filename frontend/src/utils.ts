export function getStatusBadge(status: string): string {
  switch (status) {
    case 'NO_CONFIRMED_ALERT_OVERLAP_FOUND': return 'badge badge-clear'
    case 'UNDER_ENVIRONMENTAL_REVIEW': return 'badge badge-review'
    case 'INSPECTION_PENDING': return 'badge badge-pending'
    case 'CLEARED_DEMO': return 'badge badge-clear badge-demo'
    case 'FLAGGED_DEMO': return 'badge badge-flagged badge-demo'
    default: return 'badge badge-pending'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'NO_CONFIRMED_ALERT_OVERLAP_FOUND': return 'NO CONFIRMED ALERT OVERLAP FOUND'
    case 'UNDER_ENVIRONMENTAL_REVIEW': return 'UNDER ENVIRONMENTAL REVIEW'
    case 'INSPECTION_PENDING': return 'INSPECTION PENDING'
    case 'CLEARED_DEMO': return 'CLEARED (DEMO)'
    case 'FLAGGED_DEMO': return 'FLAGGED (DEMO)'
    default: return status
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}
