import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Edit,
  Copy,
  Play,
  Archive,
  ArrowLeft,
  Eye,
  Clock,
  Layers,
  Cpu,
  TrendingDown,
  Sparkles,
  ChevronRight,
  Upload,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

export default function ScenarioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [activeTab, setActiveTab] = useState<'Overview' | 'Run History'>('Overview')

  const { data: scenario, isLoading, error } = useQuery({
    queryKey: ['scenario', id, workspaceId],
    queryFn: () => scenarioService.get(id!, workspaceId!),
    enabled: !!id && !!workspaceId,
  })

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['runs', id, workspaceId],
    queryFn: () => runService.listRuns(id!, workspaceId!, 0, 20),
    enabled: !!id && !!workspaceId,
  })

  const archiveMutation = useMutation({
    mutationFn: () => scenarioService.archive(id!, workspaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenario', id] })
      queryClient.invalidateQueries({ queryKey: ['scenarios'] })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: () =>
      scenarioService.duplicate(
        id!,
        workspaceId!,
        `${scenario?.name ?? 'Scenario'} (copy)`
      ),
    onSuccess: (data) => navigate(`/scenarios/${data.id}`),
  })

  async function handleRun() {
    if (!workspaceId || !id) return
    const run = await runService.createRun(workspaceId, id)
    navigate(`/runs/${run.id}`)
  }

  if (isLoading) return <PageLoader message="LOADING SCENARIO SPECIFICATIONS..." />
  if (error || !scenario) {
    return (
      <div className="bento-card text-center py-12 text-rose-400">
        Failed to load scenario.{' '}
        <button onClick={() => navigate('/scenarios')} className="underline ml-1 text-cyan-400">
          Return to scenarios
        </button>
      </div>
    )
  }

  const cfg = scenario.config

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/scenarios')}
          className="btn-ghost flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 -ml-2"
        >
          <ArrowLeft size={14} /> Back to Scenarios
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{scenario.name}</h1>
              <StatusBadge status={scenario.status} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Domain: <span className="font-mono text-cyan-400">{scenario.service_type}</span> • Created:{' '}
              {new Date(scenario.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/scenarios/${id}/edit`)}
              className="btn-secondary text-xs"
            >
              <Edit size={14} /> Edit
            </button>
            <button
              onClick={() => duplicateMutation.mutate()}
              className="btn-secondary text-xs"
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              onClick={() => navigate(`/scenarios/${id}/import`)}
              className="btn-secondary text-xs"
            >
              <Upload size={14} /> Import Data
            </button>
            <button
              onClick={handleRun}
              className="btn-primary shadow-glow text-xs font-bold"
            >
              <Play size={14} /> Execute Run
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#111B2B] border border-[#24334A] rounded-xl w-fit text-xs font-mono">
        {(['Overview', 'Run History'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Arrival & Service Config */}
          <div className="bento-card space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <TrendingDown size={15} className="text-cyan-400" /> Arrival & Service Mechanics
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Arrival Distribution:</span>
                <span className="text-white capitalize">{cfg.arrival.distribution}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Mean Interarrival Time:</span>
                <span className="text-cyan-400 font-bold">{cfg.arrival.mean_interarrival} min</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Service Distribution:</span>
                <span className="text-white capitalize">{cfg.service.distribution}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Mean Service Time:</span>
                <span className="text-purple-400 font-bold">{cfg.service.mean ?? '—'} min</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Standard Deviation (σ):</span>
                <span className="text-slate-300">{cfg.service.std_dev ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Topology & Horizon */}
          <div className="bento-card space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Cpu size={15} className="text-teal-400" /> Topology & Simulation Scope
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Parallel Counters (c):</span>
                <span className="text-teal-400 font-bold">{cfg.servers} Server Desks</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Simulation Horizon:</span>
                <span className="text-white">{cfg.horizon_minutes} minutes</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Warm-Up Window:</span>
                <span className="text-slate-300">{cfg.warm_up_minutes} minutes</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Replications:</span>
                <span className="text-purple-400 font-bold">{cfg.replications} Monte Carlo Runs</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Queue Discipline:</span>
                <span className="text-emerald-400 font-bold">FIFO</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Run History' && (
        <div className="bento-card overflow-hidden p-0 border-[#24334A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#0D1422] border-b border-[#24334A] text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Avg Wait</th>
                  <th className="py-3 px-4">Utilization</th>
                  <th className="py-3 px-4">Executed Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24334A]/50">
                {runs?.data && runs.data.length > 0 ? (
                  runs.data.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-[#162236]/40 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(r.status === 'completed' ? `/runs/${r.id}/results` : `/runs/${r.id}`)
                      }
                    >
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        #{r.id.slice(-8)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 font-mono text-white">
                        {r.metrics ? `${r.metrics.avg_waiting_time.toFixed(2)} min` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-teal-400">
                        {r.metrics ? `${(r.metrics.server_utilization * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            navigate(r.status === 'completed' ? `/runs/${r.id}/results` : `/runs/${r.id}`)
                          }
                          className="btn-ghost text-xs text-cyan-400"
                        >
                          View Results <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No simulation runs executed yet for this scenario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
