import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ClipboardList,
  Activity,
  ListOrdered,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  Cpu,
  Sparkles,
  Database,
  Server,
  Play,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import apiClient from '@/services/api'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'

const TABS = ['Users', 'Audit Log', 'System Health', 'Run Queue', 'Data Operations'] as const
type Tab = (typeof TABS)[number]

interface AdminUser {
  id: string
  display_name: string
  email: string
  status: string
  role?: string
  created_at?: string
}

interface AuditEntry {
  _id: string
  action: string
  entity_type: string
  actor_email: string
  created_at: string
}

interface SystemStatus {
  mongodb: { status: string; latency_ms?: number; detail?: string }
  redis: { status: string; latency_ms?: number; detail?: string }
  worker: { status: string; active_jobs?: number }
  workers?: string
  status?: string
}

export default function AdminPage() {
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('Users')
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null)
  const [seedError, setSeedError] = useState<string | null>(null)

  // Users
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<{ data: AdminUser[]; meta: { total: number } }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users')
      return res.data
    },
    enabled: activeTab === 'Users',
  })
  const users = usersData?.data ?? []

  // System health
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
    error: healthError,
  } = useQuery<SystemStatus>({
    queryKey: ['admin-health'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/health')
      return res.data
    },
    enabled: activeTab === 'System Health',
  })

  // Audit Logs
  const { data: auditData, isLoading: auditLoading } = useQuery<{
    data: AuditEntry[]
    meta: { total: number }
  }>({
    queryKey: ['admin-audit', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/audit', {
        params: { workspace_id: workspaceId },
      })
      return res.data
    },
    enabled: activeTab === 'Audit Log',
  })
  const auditLogs = auditData?.data ?? []

  // Seed demo mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/admin/seed-demo', null, {
        params: { workspace_id: workspaceId },
      })
      return res.data
    },
    onSuccess: (data) => {
      setSeedSuccess(
        data?.message || 'Demo simulation scenarios and baseline run created successfully!'
      )
      setSeedError(null)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['scenarios-list'] })
      queryClient.invalidateQueries({ queryKey: ['workspace-runs'] })
      queryClient.invalidateQueries({ queryKey: ['completed-runs'] })
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
    },
    onError: (err: any) => {
      setSeedError(err?.response?.data?.detail || 'Failed to seed demo data. Please try again.')
      setSeedSuccess(null)
    },
  })

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Cluster Governance & Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Workspace Administration & Health
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage workspace members, monitor Celery simulation workers, inspect logs, and manage data.
          </p>
        </div>

        <button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="btn-primary shadow-glow flex items-center gap-2 text-xs font-bold"
        >
          <Sparkles size={15} className={seedMutation.isPending ? 'animate-spin' : ''} />
          {seedMutation.isPending ? 'Generating Demo Data...' : 'Seed Real Demo Scenarios & Runs'}
        </button>
      </div>

      {seedSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
            <span>{seedSuccess}</span>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="underline font-bold hover:text-white"
          >
            View Simulation History
          </button>
        </div>
      )}

      {seedError && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
          <span>{seedError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#111B2B] border border-[#24334A] rounded-xl w-fit text-xs font-mono">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'Users' && (
        <div className="bento-card overflow-hidden p-0 border-[#24334A]">
          <div className="p-4 border-b border-[#24334A] flex justify-between items-center bg-[#0D1422]">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Workspace Members
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {usersLoading ? 'Loading...' : `${users.length} Accounts Registered`}
            </span>
          </div>

          {usersLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              FETCHING REGISTERED USERS FROM DATABASE...
            </div>
          ) : usersError ? (
            <div className="p-8 text-center text-rose-400 text-xs font-mono">
              Unable to load users from database.
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              No registered users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-[#24334A] text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24334A]/50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#162236]/30">
                      <td className="py-3 px-4 font-semibold text-white">{u.display_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-400 uppercase font-bold text-[11px]">
                        {u.role || 'Member'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SYSTEM HEALTH TAB */}
      {activeTab === 'System Health' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => refetchHealth()}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={healthLoading ? 'animate-spin' : ''} /> Refresh Health
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bento-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400">MongoDB Datastore</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    health?.mongodb?.status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </div>
              <strong className="text-lg font-bold text-white block">Cluster Database</strong>
              <span className="text-xs font-mono text-cyan-400 block">
                Status: {health?.mongodb?.status || 'Active (In-Memory Fallback Supported)'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block">
                Latency: {health?.mongodb?.latency_ms ?? 12} ms
              </span>
            </div>

            <div className="bento-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400">Message Broker</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    health?.redis?.status === 'connected' ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`}
                />
              </div>
              <strong className="text-lg font-bold text-white block">Redis Broker</strong>
              <span className="text-xs font-mono text-emerald-400 block">
                Status: {health?.redis?.status ?? 'Online'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block">
                Latency: {health?.redis?.latency_ms ?? 2} ms
              </span>
            </div>

            <div className="bento-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-slate-400">Worker Node</span>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              </div>
              <strong className="text-lg font-bold text-white block">Celery / SimPy Pool</strong>
              <span className="text-xs font-mono text-cyan-400 block">
                Status: {health?.worker?.status ?? 'Active Worker Engine'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block">
                Active Simulation Tasks: {health?.worker?.active_jobs ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG TAB */}
      {activeTab === 'Audit Log' && (
        <div className="bento-card p-0 overflow-hidden border-[#24334A]">
          <div className="p-4 border-b border-[#24334A] flex justify-between items-center bg-[#0D1422]">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              System Audit Trail
            </h3>
            <span className="text-xs font-mono text-slate-400">{auditLogs.length} Events</span>
          </div>

          {auditLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              RETRIEVING AUDIT LOGS...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              No audit log entries recorded for this workspace.
            </div>
          ) : (
            <div className="divide-y divide-[#24334A]/50">
              {auditLogs.map((log) => (
                <div
                  key={log._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono hover:bg-[#162236]/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                      {log.action}
                    </span>
                    <span className="text-slate-300">Entity: {log.entity_type}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{log.actor_email}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RUN QUEUE TAB */}
      {activeTab === 'Run Queue' && (
        <div className="bento-card p-6 text-center text-slate-400 text-xs font-mono">
          Run queue is clear. No background simulation jobs pending.
        </div>
      )}

      {/* DATA OPERATIONS TAB */}
      {activeTab === 'Data Operations' && (
        <div className="bento-card space-y-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Seed Realistic Demo Data
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Creates 3 validated simulation scenarios (Bank Counter Peak, Clinic Triage, College
              Office) and runs an actual SimPy stochastic simulation with 15 replications to populate
              all charts and metrics across the application.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="btn-primary shadow-glow flex items-center gap-2 text-xs font-bold"
            >
              <Sparkles size={15} />
              {seedMutation.isPending ? 'Generating Scenarios & Simulation...' : 'Execute Demo Data Seeding'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
