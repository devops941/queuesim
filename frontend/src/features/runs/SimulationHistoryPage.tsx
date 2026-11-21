import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Search,
  Filter,
  Play,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { analyticsService } from '@/services/analytics.service'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'

interface HistoryRow {
  id: string
  name: string
  scenarioId: string
  counters: number
  arrivalDist: string
  serviceDist: string
  avgWait: string
  avgQueue: string
  status: string
  createdAt: string
}

export default function SimulationHistoryPage() {
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)

  // Fetch real runs from backend
  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['workspace-runs-history', workspaceId, statusFilter, page],
    queryFn: () => runService.listWorkspaceRuns(workspaceId!, statusFilter, page * 10, 10),
    enabled: !!workspaceId,
  })

  // Fetch scenarios to label runs with scenario names and counter configs
  const { data: scenarios, isLoading: scenLoading } = useQuery({
    queryKey: ['scenarios-for-history', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 100),
    enabled: !!workspaceId,
  })

  if (runsLoading || scenLoading) return <PageLoader message="LOADING SIMULATION AUDIT HISTORY..." />

  const scenarioMap = new Map(scenarios?.data?.map((s) => [s.id, s]) ?? [])
  const rawRuns = runsData?.data ?? []
  const totalCount = runsData?.meta?.total ?? 0

  const mappedRuns: HistoryRow[] = rawRuns.map((r) => {
    const sc = scenarioMap.get(r.scenario_id)
    const arr = sc?.config?.arrival
    const srv = sc?.config?.service
    const arrStr = arr
      ? `${arr.distribution.charAt(0).toUpperCase() + arr.distribution.slice(1)} (${arr.mean_interarrival ? `λ=${arr.mean_interarrival}` : 'param'})`
      : 'Exponential (λ=3.0)'
    const srvStr = srv
      ? `${srv.distribution.charAt(0).toUpperCase() + srv.distribution.slice(1)} (${srv.mean ? `μ=${srv.mean}` : srv.distribution})`
      : 'Exponential (μ=5.0)'

    return {
      id: r.id,
      name: sc?.name ?? `Scenario #${r.scenario_id.slice(-6)}`,
      scenarioId: r.scenario_id,
      counters: sc?.config?.servers ?? 3,
      arrivalDist: arrStr,
      serviceDist: srvStr,
      avgWait: r.metrics?.avg_waiting_time != null
        ? `${r.metrics.avg_waiting_time.toFixed(2)} min`
        : (r.status === 'completed' ? 'Completed' : '—'),
      avgQueue: r.metrics?.avg_queue_length != null
        ? `${r.metrics.avg_queue_length.toFixed(1)} cust`
        : (r.status === 'completed' ? 'Completed' : '—'),
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toLocaleString() : 'Just now',
    }
  })

  const filtered = mappedRuns.filter((row) => {
    const matchesSearch =
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.id.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Simulation Execution Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Simulation History & Audit Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Full chronological archive of executed Monte Carlo runs, statistical distributions, and historical outcomes.
          </p>
        </div>

        <button
          onClick={() => navigate('/scenarios/new')}
          className="btn-primary shadow-glow text-xs font-bold"
        >
          <Play size={14} /> New Simulation Run
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bento-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-[#0D1422] border border-[#24334A] rounded-xl text-xs font-mono">
          {['all', 'completed', 'running', 'queued', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                statusFilter === st ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by simulation or run ID..."
            className="input-field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="bento-card overflow-hidden p-0 border-[#24334A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0D1422] border-b border-[#24334A] text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Run ID</th>
                <th className="py-3.5 px-4">Simulation Name</th>
                <th className="py-3.5 px-4">Counters</th>
                <th className="py-3.5 px-4">Arrival Model</th>
                <th className="py-3.5 px-4">Service Model</th>
                <th className="py-3.5 px-4">Avg Wait</th>
                <th className="py-3.5 px-4">Avg Queue</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334A]/50 font-sans">
              {filtered.length > 0 ? (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#162236]/50 transition-colors cursor-pointer group"
                    onClick={() =>
                      navigate(row.status === 'completed' ? `/runs/${row.id}/results` : `/runs/${row.id}`)
                    }
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 text-xs">
                      #{row.id.startsWith('run-') ? row.id.replace('run-', 'rn-') : row.id.slice(-8)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {row.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {row.counters} Desks
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {row.arrivalDist}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {row.serviceDist}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {row.avgWait}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-purple-400">
                      {row.avgQueue}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      {row.createdAt}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          navigate(row.status === 'completed' ? `/runs/${row.id}/results` : `/runs/${row.id}`)
                        }
                        className="btn-ghost text-xs text-cyan-400 hover:text-white"
                      >
                        View Results <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <History size={32} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No simulation runs executed yet</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create or select a scenario in the workspace and click "Run Simulation" to record execution logs.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  )
}
