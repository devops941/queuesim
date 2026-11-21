import apiClient from './api'
import type { Run, RunMetrics, PaginatedResponse } from '@/types'

export const runService = {
  async createRun(workspaceId: string, scenarioId: string): Promise<Run> {
    const res = await apiClient.post(`/scenarios/${scenarioId}/runs`, {}, {
      params: { workspace_id: workspaceId }
    })
    return res.data
  },

  async getRun(runId: string, workspaceId: string): Promise<Run> {
    const res = await apiClient.get(`/runs/${runId}`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async getMetrics(runId: string, workspaceId: string): Promise<RunMetrics> {
    const res = await apiClient.get(`/runs/${runId}/metrics`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async getEvents(runId: string, workspaceId: string, skip = 0, limit = 50) {
    const res = await apiClient.get(`/runs/${runId}/events`, {
      params: { workspace_id: workspaceId, skip, limit }
    })
    return res.data
  },

  async listRuns(scenarioId: string, workspaceId: string, skip = 0, limit = 20): Promise<PaginatedResponse<Run>> {
    const res = await apiClient.get(`/scenarios/${scenarioId}/runs`, {
      params: { workspace_id: workspaceId, skip, limit }
    })
    return res.data
  },

  async listWorkspaceRuns(workspaceId: string, status?: string, skip = 0, limit = 50): Promise<PaginatedResponse<Run>> {
    const res = await apiClient.get('/runs', {
      params: { workspace_id: workspaceId, status: status && status !== 'all' ? status : undefined, skip, limit }
    })
    return res.data
  },

  async cancelRun(runId: string, workspaceId: string): Promise<{ cancelled: boolean }> {
    const res = await apiClient.post(`/runs/${runId}/cancel`, {}, { params: { workspace_id: workspaceId } })
    return res.data
  },
}
