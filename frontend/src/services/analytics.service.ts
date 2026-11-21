import apiClient from './api'
import type { RunMetrics } from '@/types'

export interface DashboardData {
  total_scenarios: number
  total_runs: number
  recent_runs: Array<{
    id: string
    scenario_id: string
    status: string
    created_at: string
    progress?: number
    metrics?: {
      avg_waiting_time?: number
      avg_queue_length?: number
      server_utilization?: number
      max_waiting_time?: number
      customers_served?: number
      customers_arrived?: number
      throughput?: number
      [key: string]: any
    }
    completed_at?: string
  }>
  recent_scenarios: Array<{ id: string; name: string; status: string; updated_at: string }>
}

export const analyticsService = {
  async getDashboard(workspaceId: string): Promise<DashboardData> {
    const res = await apiClient.get('/analytics/dashboard', { params: { workspace_id: workspaceId } })
    return res.data
  },

  async getRunSummary(runId: string, workspaceId: string): Promise<RunMetrics> {
    const res = await apiClient.get(`/analytics/runs/${runId}/summary`, {
      params: { workspace_id: workspaceId }
    })
    return res.data
  },
}
