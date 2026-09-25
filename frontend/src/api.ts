/**
 * API client for CatchShield AI backend.
 * All role-gated calls pass X-Role header.
 */

const BASE = '/api'

export type Role = 'operator' | 'officer' | 'inspector' | 'admin'

async function req(method: string, path: string, body?: unknown, role?: Role, isForm = false) {
  const headers: Record<string, string> = {}
  if (role) headers['X-Role'] = role
  
  let fetchBody: BodyInit | undefined
  if (body) {
    if (isForm) {
      fetchBody = body as FormData
    } else {
      headers['Content-Type'] = 'application/json'
      fetchBody = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: fetchBody })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Batches
export const registerBatch = (form: FormData) =>
  req('POST', '/batches', form, 'operator', true)

export const listBatches = () =>
  req('GET', '/batches', undefined, 'inspector')

export const getFingerprint = (batchId: string) =>
  req('GET', `/batches/${batchId}/fingerprint`)

// Alerts
export const screenImage = (file: File) => {
  const form = new FormData()
  form.append('image', file)
  return req('POST', '/alerts/screen-image', form, 'officer', true)
}

export const confirmAlert = (body: object) =>
  req('POST', '/alerts/confirm', body, 'officer')

export const rejectAlert = (body: object) =>
  req('POST', '/alerts/reject', body, 'officer')

export const listAlerts = () =>
  req('GET', '/alerts', undefined, 'officer')

// Matching
export const getMatchingDashboard = () =>
  req('GET', '/matching', undefined, 'officer')

// Inspections
export const recordInspection = (body: object) =>
  req('POST', '/inspections', body, 'inspector')

export const listInspections = () =>
  req('GET', '/inspections', undefined, 'inspector')

// Public
export const publicLookup = (batchId: string) =>
  req('GET', `/public/${batchId}`)

// Advisory
export const getAdvisory = (zone: string) =>
  req('GET', `/advisory?zone=${encodeURIComponent(zone)}`)

export const getConditions = (zone: string, time: string) =>
  req('GET', `/public/conditions?zone=${encodeURIComponent(zone)}&time=${encodeURIComponent(time)}`)
