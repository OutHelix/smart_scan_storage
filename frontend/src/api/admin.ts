import type { ServiceLogsResponse } from '../types'
import { getErrorMessage, getToken } from './auth'

const API_BASE = '/api/v1'

export async function getServiceLogs(limit = 300): Promise<ServiceLogsResponse> {
  const token = getToken()
  if (!token) throw new Error('Sign in as admin to view logs')

  const res = await fetch(`${API_BASE}/admin/logs?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(getErrorMessage(data, 'Failed to load service logs'))
  return data as ServiceLogsResponse
}
