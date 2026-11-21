import apiClient from './api'
import type { Report, ReportFormat } from '@/types'

export const reportService = {
  async createReport(runId: string, workspaceId: string, format: ReportFormat): Promise<Report> {
    const res = await apiClient.post('/reports', { run_id: runId, format, workspace_id: workspaceId })
    return res.data
  },

  async getReport(reportId: string, workspaceId: string): Promise<Report> {
    const res = await apiClient.get(`/reports/${reportId}`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async listByRun(runId: string, workspaceId: string): Promise<Report[]> {
    const res = await apiClient.get(`/runs/${runId}/reports`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  getDownloadUrl(reportId: string, workspaceId: string): string {
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
    return `${base}/reports/${reportId}/download?workspace_id=${workspaceId}`
  },
}
