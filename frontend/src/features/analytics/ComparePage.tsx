import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  GitCompare,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  Cpu,
  Layers,
  ArrowRight,
  Sliders,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import apiClient from '@/services/api'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import type { ComparisonResponse, SensitivityPoint, RunListItem } from '@/types'

export default function ComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  // Fetch completed runs for this workspace
  const { data: runsResponse, isLoading: runsLoading } = useQuery({
    queryKey: ['completed-runs', workspaceId],
    queryFn: () => runService.listWorkspaceRuns(workspaceId!, 'completed'),
    enabled: !!workspaceId,
  })
  const completedRuns: RunListItem[] = (Array.isArray(runsResponse) ? runsResponse : runsResponse?.data) || []

  // Fetch scenarios for sensitivity analysis & scenario names
  const { data: scenarios } = useQuery({
    queryKey: ['scenarios-all', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 100),
    enabled: !!workspaceId,
  })

  const scenarioMap = new Map(scenarios?.data?.map((s) => [s.id, s.name]) ?? [])

  const [runA, setRunA] = useState('')
  const [runB, setRunB] = useState('')
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)

  // Sensitivity analysis controls
  const [varyParam, setVaryParam] = useState('servers')
  const [senMin, setSenMin] = useState('1')
  const [senMax, setSenMax] = useState('6')
  const [senStep, setSenStep] = useState('1')
  const [senResults, setSenResults] = useState<SensitivityPoint[]>([])
  const [senLoading, setSenLoading] = useState(false)
  const [senScenarioId, setSenScenarioId] = useState('')
  const [senError, setSenError] = useState<string | null>(null)

  // Auto-initialize runA and runB from query params or the first two completed runs
  useEffect(() => {
    if (completedRuns.length >= 2) {
      const qA = searchParams.get('runA')
      const qB = searchParams.get('runB')

      const initialA = qA && completedRuns.some((r) => r.id === qA) ? qA : completedRuns[0].id
      const initialB =
        qB && completedRuns.some((r) => r.id === qB) && qB !== initialA
          ? qB
          : completedRuns.find((r) => r.id !== initialA)?.id || completedRuns[1]?.id

      if (!runA && initialA) setRunA(initialA)
      if (!runB && initialB) setRunB(initialB)
    }
  }, [completedRuns, searchParams])

  // Automatically trigger comparison whenever runA and runB change
  useEffect(() => {
    if (runA && runB && runA !== runB && workspaceId) {
      handleCompare(runA, runB)
    }
  }, [runA, runB, workspaceId])

  async function handleCompare(aId: string, bId: string) {
    if (!aId || !bId || !workspaceId) return
    setComparing(true)
    setCompareError(null)
    try {
      const res = await apiClient.get<ComparisonResponse>('/analytics/compare', {
        params: { run_ids: [aId, bId].join(','), workspace_id: workspaceId },
      })
      setComparison(res.data)
    } catch (err: any) {
      setCompareError(
        err?.response?.data?.detail || 'Could not execute comparison for specified runs.'
      )
    } finally {
      setComparing(false)
    }
  }

  async function handleSensitivity() {
    if (!senScenarioId || !senMin || !senMax || !senStep || !workspaceId) return
    setSenLoading(true)
    setSenError(null)
    try {
      const res = await apiClient.post(
        `/scenarios/${senScenarioId}/sensitivity`,
        {
          vary_param: varyParam,
          min_value: parseFloat(senMin),
          max_value: parseFloat(senMax),
          step: parseFloat(senStep),
        },
        { params: { workspace_id: workspaceId } }
      )
      setSenResults(res.data.points || [])
    } catch (err: any) {
      setSenError(
        err?.response?.data?.detail ||
          'Failed to run sensitivity simulation. Please ensure valid parameter ranges.'
      )
    } finally {
      setSenLoading(false)
    }
  }

  if (runsLoading) {
    return <PageLoader message="LOADING COMPARATIVE TELEMETRY DATA..." />
  }

  // If fewer than 2 completed runs exist, show clean empty state
  if (completedRuns.length < 2) {
    return (
      <div className="space-y-6 pb-12 w-full">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Decision Intelligence Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Scenario Comparison & Trade-off Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate parallel capacity trade-offs across server configurations, queue lengths, and waiting time reduction.
          </p>
        </div>

        <div className="bento-card text-center py-16 px-6 max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <GitCompare size={28} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            At Least 2 Completed Simulations Required
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Comparative analysis computes mathematical deltas, percentage improvements, and server
            utilization trade-offs between two or more actual completed simulation runs. Currently, your
            workspace has {completedRuns.length} completed run(s).
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => navigate('/scenarios')} className="btn-primary shadow-glow text-xs">
              <Play size={14} /> Run New Simulation
            </button>
            <button onClick={() => navigate('/admin')} className="btn-secondary text-xs">
              <Sparkles size={14} /> Seed Demo Scenarios in Admin
            </button>
          </div>
        </div>
      </div>
    )
  }

  const runItemA = completedRuns.find((r) => r.id === runA)
  const runItemB = completedRuns.find((r) => r.id === runB)

  const sideA = comparison?.side_by_side?.[0]
  const sideB = comparison?.side_by_side?.[1]

  const metricsA = sideA?.metrics || runItemA?.metrics
  const metricsB = sideB?.metrics || runItemB?.metrics

  const nameA = runItemA?.scenario_id ? scenarioMap.get(runItemA.scenario_id) || `Run #${runA.slice(0, 8)}` : `Run #${runA.slice(0, 8)}`
  const nameB = runItemB?.scenario_id ? scenarioMap.get(runItemB.scenario_id) || `Run #${runB.slice(0, 8)}` : `Run #${runB.slice(0, 8)}`

  // Compute recommendation dynamically based on wait time and utilization
  let recommendationText = ''
  let recommendedName = nameB
  if (metricsA && metricsB) {
    if (metricsB.avg_waiting_time < metricsA.avg_waiting_time) {
      const waitReduction = ((1 - metricsB.avg_waiting_time / (metricsA.avg_waiting_time || 1)) * 100).toFixed(1)
      recommendationText = `${nameB} delivers a ${waitReduction}% reduction in customer wait time while maintaining ${(metricsB.server_utilization * 100).toFixed(1)}% counter utilization.`
      recommendedName = nameB
    } else {
      const waitReduction = ((1 - metricsA.avg_waiting_time / (metricsB.avg_waiting_time || 1)) * 100).toFixed(1)
      recommendationText = `${nameA} delivers a ${waitReduction}% reduction in customer wait time with ${(metricsA.server_utilization * 100).toFixed(1)}% counter utilization.`
      recommendedName = nameA
    }
  }

  // Chart data comparing both runs
  const comparisonBarData = metricsA && metricsB ? [
    {
      kpi: 'Avg Wait (min)',
      [nameA]: parseFloat(metricsA.avg_waiting_time.toFixed(2)),
      [nameB]: parseFloat(metricsB.avg_waiting_time.toFixed(2)),
    },
    {
      kpi: 'Max Wait (min)',
      [nameA]: parseFloat(metricsA.max_waiting_time.toFixed(2)),
      [nameB]: parseFloat(metricsB.max_waiting_time.toFixed(2)),
    },
    {
      kpi: 'Avg Queue (cust)',
      [nameA]: parseFloat(metricsA.avg_queue_length.toFixed(1)),
      [nameB]: parseFloat(metricsB.avg_queue_length.toFixed(1)),
    },
    {
      kpi: 'Throughput (/hr)',
      [nameA]: parseFloat(metricsA.throughput.toFixed(1)),
      [nameB]: parseFloat(metricsB.throughput.toFixed(1)),
    },
  ] : []

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Decision Intelligence Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Scenario Comparison & Trade-off Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate parallel capacity trade-offs across server configurations, queue lengths, and waiting time reduction.
          </p>
        </div>
      </div>

      {/* Selector Ribbon */}
      <div className="bento-card bg-[#111B2B] border-[#24334A] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex-1 sm:w-64">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Baseline Run (A):</label>
            <select
              value={runA}
              onChange={(e) => setRunA(e.target.value)}
              className="input-field text-xs font-mono w-full"
            >
              {completedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {scenarioMap.get(r.scenario_id) || 'Run'} (#{r.id.slice(0, 8)}) - {new Date(r.created_at).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>

          <div className="text-slate-500 font-mono text-xs self-center hidden sm:block pt-4">VS</div>

          <div className="flex-1 sm:w-64">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Alternative Run (B):</label>
            <select
              value={runB}
              onChange={(e) => setRunB(e.target.value)}
              className="input-field text-xs font-mono w-full"
            >
              {completedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {scenarioMap.get(r.scenario_id) || 'Run'} (#{r.id.slice(0, 8)}) - {new Date(r.created_at).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => handleCompare(runA, runB)}
          disabled={comparing || !runA || !runB || runA === runB}
          className="btn-primary shadow-glow text-xs font-bold self-end md:self-center"
        >
          {comparing ? 'Analyzing...' : 'Execute Delta Comparison'}
        </button>
      </div>

      {compareError && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={15} /> {compareError}
        </div>
      )}

      {/* Best Performing Recommended Architecture Card */}
      {recommendationText && (
        <div className="bento-card-elevated border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-[#111B2B] to-[#162236]">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Data-Driven Architecture Recommendation
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                  {recommendedName}
                </span>
              </div>
              <p className="text-sm text-slate-200 font-medium mt-1">
                {recommendationText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Run A Card */}
        <div className="bento-card border-[#24334A] space-y-4">
          <div className="flex justify-between items-start pb-3 border-b border-[#24334A]">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block font-bold">
                Baseline (Run A)
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">{nameA}</h3>
              <span className="text-[11px] font-mono text-slate-500">ID: {runA}</span>
            </div>
          </div>

          {metricsA ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Avg Waiting Time:</span>
                <strong className="text-white">{metricsA.avg_waiting_time.toFixed(2)} min</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Max Waiting Time:</span>
                <span className="text-amber-400 font-semibold">{metricsA.max_waiting_time.toFixed(2)} min</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Avg Queue Line:</span>
                <span className="text-cyan-400 font-semibold">{metricsA.avg_queue_length.toFixed(1)} cust</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Counter Utilization:</span>
                <span className="text-teal-400 font-semibold">{(metricsA.server_utilization * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">System Throughput:</span>
                <span className="text-purple-400 font-semibold">{metricsA.throughput.toFixed(1)}/hr</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs font-mono">No metrics available.</div>
          )}
        </div>

        {/* Run B Card with Deltas */}
        <div className="bento-card border-blue-500/30 space-y-4">
          <div className="flex justify-between items-start pb-3 border-b border-[#24334A]">
            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block font-bold">
                Alternative (Run B)
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">{nameB}</h3>
              <span className="text-[11px] font-mono text-slate-500">ID: {runB}</span>
            </div>
          </div>

          {metricsB ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Avg Waiting Time:</span>
                <div className="flex items-center gap-2">
                  <strong className="text-white">{metricsB.avg_waiting_time.toFixed(2)} min</strong>
                  {sideB?.delta?.avg_waiting_time !== undefined && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                        sideB.delta.avg_waiting_time < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {sideB.delta.avg_waiting_time > 0 ? '+' : ''}
                      {sideB.delta.avg_waiting_time.toFixed(2)}m
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Max Waiting Time:</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-semibold">{metricsB.max_waiting_time.toFixed(2)} min</span>
                  {sideB?.delta?.max_waiting_time !== undefined && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                        sideB.delta.max_waiting_time < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {sideB.delta.max_waiting_time > 0 ? '+' : ''}
                      {sideB.delta.max_waiting_time.toFixed(2)}m
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Avg Queue Line:</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-semibold">{metricsB.avg_queue_length.toFixed(1)} cust</span>
                  {sideB?.delta?.avg_queue_length !== undefined && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                        sideB.delta.avg_queue_length < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {sideB.delta.avg_queue_length > 0 ? '+' : ''}
                      {sideB.delta.avg_queue_length.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#24334A]/40">
                <span className="text-slate-400">Counter Utilization:</span>
                <div className="flex items-center gap-2">
                  <span className="text-teal-400 font-semibold">{(metricsB.server_utilization * 100).toFixed(1)}%</span>
                  {sideB?.delta?.server_utilization !== undefined && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                      {sideB.delta.server_utilization > 0 ? '+' : ''}
                      {(sideB.delta.server_utilization * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">System Throughput:</span>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-semibold">{metricsB.throughput.toFixed(1)}/hr</span>
                  {sideB?.delta?.throughput !== undefined && (
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                        sideB.delta.throughput > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {sideB.delta.throughput > 0 ? '+' : ''}
                      {sideB.delta.throughput.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs font-mono">No metrics available.</div>
          )}
        </div>
      </div>

      {/* Comparison Visualizations: Grouped Charts */}
      {comparisonBarData.length > 0 && (
        <div className="bento-card">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white tracking-tight">
              Operational Performance Metrics Comparison
            </h3>
            <p className="text-xs text-slate-400">
              Side-by-side stochastic evaluation between baseline ({nameA}) and alternative ({nameB}).
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                <XAxis dataKey="kpi" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111B2B',
                    borderColor: '#24334A',
                    borderRadius: '10px',
                    color: '#F1F5F9',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey={nameA} fill="#22D3EE" radius={[4, 4, 0, 0]} />
                <Bar dataKey={nameB} fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sensitivity Analysis Studio */}
      <div className="bento-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#24334A] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-cyan-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Parametric Sensitivity Analysis Studio
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Sweep operational parameters across an active scenario to observe system phase shifts.
            </p>
          </div>
        </div>

        {senError && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} /> {senError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="label">Base Scenario</label>
            <select
              value={senScenarioId}
              onChange={(e) => setSenScenarioId(e.target.value)}
              className="input-field text-xs"
            >
              <option value="">Select Scenario...</option>
              {scenarios?.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Vary Parameter</label>
            <select
              value={varyParam}
              onChange={(e) => setVaryParam(e.target.value)}
              className="input-field text-xs"
            >
              <option value="servers">Number of Counters (c)</option>
              <option value="mean_interarrival">Mean Interarrival (λ)</option>
              <option value="service_mean">Service Mean Duration (μ)</option>
            </select>
          </div>

          <div>
            <label className="label">Range Min</label>
            <input
              type="number"
              value={senMin}
              onChange={(e) => setSenMin(e.target.value)}
              className="input-field font-mono text-xs"
            />
          </div>

          <div>
            <label className="label">Range Max</label>
            <input
              type="number"
              value={senMax}
              onChange={(e) => setSenMax(e.target.value)}
              className="input-field font-mono text-xs"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSensitivity}
              disabled={senLoading || !senScenarioId}
              className="btn-primary w-full text-xs font-bold"
            >
              {senLoading ? 'Computing...' : 'Compute Sensitivity'}
            </button>
          </div>
        </div>

        {senResults.length > 0 && (
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={senResults} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                <XAxis dataKey="value" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111B2B',
                    borderColor: '#24334A',
                    borderRadius: '10px',
                    color: '#F1F5F9',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="avg_waiting_time"
                  name="Avg Wait (min)"
                  stroke="#22D3EE"
                  strokeWidth={2.5}
                />
                <Line
                  type="monotone"
                  dataKey="server_utilization"
                  name="Utilization"
                  stroke="#4F8CFF"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
