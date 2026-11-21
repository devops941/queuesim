import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowRight,
  StopCircle,
  ArrowLeft,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Cpu,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { runService } from '@/services/run.service'
import { scenarioService } from '@/services/scenario.service'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { QueueVisualizer } from '@/components/simulation/QueueVisualizer'

const TIMELINE_STEPS = ['queued', 'running', 'completed'] as const

function getStepIndex(status: string) {
  if (status === 'failed' || status === 'cancelled') return -1
  return TIMELINE_STEPS.indexOf(status as (typeof TIMELINE_STEPS)[number])
}

export default function RunMonitorPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const {
    data: run,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['run', runId, workspaceId],
    queryFn: () => runService.getRun(runId!, workspaceId!),
    enabled: !!runId && !!workspaceId,
  })

  // Also fetch scenario details for parameters
  const { data: scenario } = useQuery({
    queryKey: ['scenario-for-run', run?.scenario_id, workspaceId],
    queryFn: () => scenarioService.get(run!.scenario_id, workspaceId!),
    enabled: !!run?.scenario_id && !!workspaceId,
  })

  // Auto-refresh while active
  useEffect(() => {
    if (!run) return
    if (run.status === 'queued' || run.status === 'running') {
      const interval = setInterval(() => {
        refetch()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [run?.status, refetch])

  const cancelMutation = useMutation({
    mutationFn: () => runService.cancelRun(runId!, workspaceId!),
    onSuccess: () => refetch(),
  })

  if (isLoading) return <PageLoader message="CONNECTING TO SIMULATION RUN..." />
  if (error || !run) {
    return (
      <div className="bento-card text-center py-12 text-rose-400">
        Run not found or access denied.{' '}
        <button onClick={() => navigate('/scenarios')} className="underline ml-2 text-cyan-400">
          Return to scenarios
        </button>
      </div>
    )
  }

  const progress = run.progress ?? (run.status === 'completed' ? 100 : 45)
  const isActive = run.status === 'queued' || run.status === 'running'
  const isFailed = run.status === 'failed'
  const isCancelled = run.status === 'cancelled'

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/scenarios')}
            className="btn-ghost flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 -ml-2"
          >
            <ArrowLeft size={14} /> Back to Scenarios
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Real-Time Simulation Monitor
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Run ID: <span className="text-cyan-400">{run.id}</span> • Scenario:{' '}
            <span className="text-slate-300">{scenario?.name ?? run.scenario_id}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isActive && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="btn-secondary text-rose-400 hover:bg-rose-950/40 border-rose-500/30 text-xs"
            >
              <StopCircle size={14} /> Stop Run
            </button>
          )}

          {run.status === 'completed' && (
            <button
              onClick={() => navigate(`/runs/${run.id}/results`)}
              className="btn-primary shadow-glow text-xs font-bold"
            >
              <BarChart3 size={15} /> View Full Analytics Results <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress & Engine Telemetry Card */}
      <div className="bento-card-elevated flex flex-col md:flex-row md:items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-glow ${
              run.status === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : isFailed
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-blue-500/10 border-blue-500/30 text-cyan-400'
            }`}
          >
            {run.status === 'completed' ? (
              <CheckCircle size={28} />
            ) : run.status === 'running' ? (
              <Loader2 size={28} className="animate-spin text-cyan-400" />
            ) : (
              <Clock size={28} className="animate-pulse text-amber-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight capitalize">
                Simulation {run.status}
              </h3>
              <span className="text-xs font-mono text-cyan-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                SimPy Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              {run.status === 'queued' && 'Task scheduled in message broker queue...'}
              {run.status === 'running' && 'Processing discrete-event Monte Carlo replications across horizon window.'}
              {run.status === 'completed' && 'Execution completed! Metric distributions and replication statistics ready.'}
              {run.status === 'failed' && (run.error_summary || 'An error occurred during execution.')}
              {run.status === 'cancelled' && 'Simulation was halted by user.'}
            </p>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="w-full md:w-64 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Monte Carlo Progress:</span>
            <strong className="text-cyan-400">{progress}%</strong>
          </div>
          <div className="w-full bg-[#0D1422] rounded-full h-2.5 overflow-hidden border border-[#24334A]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                run.status === 'completed' ? 'bg-emerald-400' : 'bg-cyan-400 shadow-glow-cyan'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono block text-right">
            Replications: {scenario?.config?.replications ?? 10}
          </span>
        </div>
      </div>

      {/* Live Visualizer: Customer flow through service counters */}
      <QueueVisualizer
        initialServers={scenario?.config?.servers ?? 3}
        meanInterarrival={scenario?.config?.arrival?.mean_interarrival ?? 3}
        meanService={scenario?.config?.service?.mean ?? 6}
        isRealSimActive={isActive}
        simulationProgress={progress}
      />
    </div>
  )
}
