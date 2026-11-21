import apiClient from './api'
import type { Scenario, ScenarioConfig, PaginatedResponse } from '@/types'

export interface ScenarioCreateBody {
  name: string
  description?: string
  service_type?: string
  config: ScenarioConfig
}

export interface ScenarioUpdateBody {
  name?: string
  description?: string
  service_type?: string
  config?: ScenarioConfig
}

export const scenarioService = {
  async list(workspaceId: string, skip = 0, limit = 20, status?: string): Promise<PaginatedResponse<Scenario>> {
    const params: Record<string, unknown> = { workspace_id: workspaceId, skip, limit }
    if (status) params.status = status
    const res = await apiClient.get('/scenarios', { params })
    return res.data
  },

  async create(workspaceId: string, body: ScenarioCreateBody): Promise<Scenario> {
    const res = await apiClient.post('/scenarios', body, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async get(id: string, workspaceId: string): Promise<Scenario> {
    const res = await apiClient.get(`/scenarios/${id}`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async update(id: string, workspaceId: string, body: ScenarioUpdateBody): Promise<Scenario> {
    const res = await apiClient.patch(`/scenarios/${id}`, body, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async validate(id: string, workspaceId: string): Promise<{ status: string; message: string }> {
    const res = await apiClient.post(`/scenarios/${id}/validate`, {}, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async duplicate(id: string, workspaceId: string, newName: string): Promise<Scenario> {
    const res = await apiClient.post(`/scenarios/${id}/duplicate`, {}, {
      params: { workspace_id: workspaceId, new_name: newName }
    })
    return res.data
  },

  async archive(id: string, workspaceId: string): Promise<{ status: string }> {
    const res = await apiClient.post(`/scenarios/${id}/archive`, {}, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async delete(id: string, workspaceId: string): Promise<{ deleted: boolean }> {
    const res = await apiClient.delete(`/scenarios/${id}`, { params: { workspace_id: workspaceId } })
    return res.data
  },

  async listPresets(): Promise<Array<{ key: string; name: string }>> {
    const res = await apiClient.get('/scenarios/presets')
    return res.data.data
  },
}
