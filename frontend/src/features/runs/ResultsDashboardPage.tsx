import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
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
  Clock,
  Users,
  Activity,
  TrendingUp,
  ArrowLeft,
  FileDown,
  FileText,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  GitCompare,
  BarChart3,
  Sliders,
  Info,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { runService } from '@/services/run.service'
import { reportService } from '@/services/report.service'
import { KpiCard } from '@/components/ui/KpiCard'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import type { ReportFormat } from '@/types'

const TABS = [
  'Overview',
  'Queue Analytics',
  'Waiting Time',
  'Counter Utilization',
  'Arrival & Service',
  'Statistical Summary',
] as const
type Tab = (typeof TABS)[number]

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function fmt(v: number | undefined, decimals = 2) {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

export default function ResultsDashboardPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportSuccess, setReportSuccess] = useState<string | null>(null)

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['run', runId, workspaceId],
    queryFn: () => runService.getRun(runId!, workspaceId!),
    enabled: !!runId && !!workspaceId,
  })

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', runId, workspaceId],
    queryFn: () => runService.getMetrics(runId!, workspaceId!),
    enabled: !!runId && !!workspaceId && run?.status === 'completed',
  })

  const reportMutation = useMutation({
    mutationFn: (format: ReportFormat) =>
      reportService.createReport(runId!, workspaceId!, format),
    onSuccess: (report) => {
      setReportSuccess(`Report generated successfully (${report.format.toUpperCase()})`)
      const url = reportService.getDownloadUrl(report.id, workspaceId!)
      window.open(url, '_blank')
    },
    onError: () => setReportError('Failed to generate report. Please try again.'),
  })

  if (runLoading || metricsLoading) return <PageLoader message="COMPUTING MONTE CARLO STATISTICAL METRICS..." />
  if (!run) {
    return (
      <div className="bento-card text-center py-12 text-rose-400">
        Run not found.{' '}
        <button onClick={() => navigate('/scenarios')} className="underline ml-1 text-cyan-400">
          Go back
        </button>
      </div>
    )
  }

  const m = metrics
  const firstRep = m?.replication_summaries?.[0]

  const queueSeries = firstRep?.queue_length_series ?? []

  const waitHistogram = firstRep?.wait_histogram ?? []

  const repComparison =
    m?.replication_summaries?.map((r) => ({
      rep: `Rep ${r.replication_no}`,
      avg_waiting_time: parseFloat(r.avg_waiting_time.toFixed(3)),
      server_utilization: parseFloat((r.server_utilization * 100).toFixed(1)),
      max_queue_length: r.max_queue_length,
      throughput: parseFloat(r.throughput.toFixed(1)),
    })) ?? []

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(`/runs/${runId}`)}
            className="btn-ghost flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 -ml-2"
          >
            <ArrowLeft size={14} /> Back to Live Monitor
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Simulation Analytics & Results
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Run ID: <span className="text-cyan-400">{run.id}</span> • Replications:{' '}
            <span className="text-white font-bold">{m?.replications ?? '—'}</span> • Horizon:{' '}
            <span className="text-slate-300">Completed</span>
          </p>
        </div>

        {/* Export & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => reportMutation.mutate('pdf')}
            disabled={reportMutation.isPending}
            className="btn-secondary text-xs"
          >
            <FileText size={14} className="text-rose-400" /> Export PDF
          </button>
          <button
            onClick={() => reportMutation.mutate('csv')}
            disabled={reportMutation.isPending}
            className="btn-secondary text-xs"
          >
            <FileDown size={14} className="text-emerald-400" /> Export CSV Data
          </button>
          <button
            onClick={() => navigate(`/compare?runA=${runId}`)}
            className="btn-primary shadow-glow text-xs"
          >
            <GitCompare size={14} /> Compare Scenario
          </button>
        </div>
      </div>

      {reportSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={15} /> {reportSuccess}
        </div>
      )}
      {reportError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={15} /> {reportError}
        </div>
      )}

      {/* KPI Cards Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Avg Waiting Time"
          value={fmt(m?.avg_waiting_time)}
          unit="min"
          sub="Queue buffer delay"
          icon={<Clock size={16} />}
          accentColor="cyan"
          trend="up"
          trendValue="95% CI"
        />
        <KpiCard
          label="Max Waiting Time"
          value={fmt(m?.max_waiting_time)}
          unit="min"
          sub="Worst-case customer"
          icon={<TrendingUp size={16} />}
          accentColor="amber"
        />
        <KpiCard
          label="Avg Queue Size"
          value={fmt(m?.avg_queue_length, 1)}
          unit="cust"
          sub="Mean length in line"
          icon={<Users size={16} />}
          accentColor="purple"
        />
        <KpiCard
          label="Max Queue Size"
          value={m?.max_queue_length ?? '—'}
          unit="cust"
          sub="Peak queue spike"
          icon={<Layers size={16} />}
          accentColor="rose"
        />
        <KpiCard
          label="Server Utilization"
          value={m != null ? pct(m.server_utilization) : '—'}
          sub="Active counter work"
          icon={<Cpu size={16} />}
          accentColor="teal"
        />
        <KpiCard
          label="Throughput"
          value={fmt(m?.throughput, 1)}
          unit="cust/h"
          sub="Completed rate"
          icon={<Activity size={16} />}
          accentColor="green"
        />
      </div>

      {/* Multi-Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[#111B2B] border border-[#24334A] rounded-xl overflow-x-auto text-xs font-mono">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#162236]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bento-card">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              Replication Performance Across Runs
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Mean waiting time and server utilization across Monte Carlo seeds.
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                  <XAxis dataKey="rep" stroke="#64748B" fontSize={11} tickLine={false} />
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
                  <Bar dataKey="avg_waiting_time" name="Avg Wait (min)" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="server_utilization" name="Utilization (%)" fill="#4F8CFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bento-card space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Key Stochastic Findings</h3>
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
                <strong className="text-cyan-400 block mb-1">Confidence Interval (95% CI):</strong>
                <span>
                  [{fmt(m?.ci_lower_waiting)} min – {fmt(m?.ci_upper_waiting)} min]
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
                <strong className="text-emerald-400 block mb-1">System Stability Verdict:</strong>
                <span>
                  {m && m.server_utilization < 0.85
                    ? 'Counters operated with comfortable headroom (low queue congestion risk).'
                    : 'Counters operated close to capacity. Peak surge buffers recommended.'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
                <strong className="text-purple-400 block mb-1">Entity Completion Rate:</strong>
                <span>
                  Arrived: {m?.customers_arrived ?? '—'} | Served: {m?.customers_served ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUEUE ANALYTICS */}
      {activeTab === 'Queue Analytics' && (
        <div className="bento-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Simulated Queue Trajectory L(t)
              </h3>
              <p className="text-xs text-slate-400">
                Number of entities queuing in the buffer over simulation horizon minutes.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Replication #1 Event Log
            </span>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={queueSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="resQueueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} unit="m" />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111B2B',
                    borderColor: '#24334A',
                    borderRadius: '10px',
                    color: '#F1F5F9',
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="queue_length"
                  name="Queue Size"
                  stroke="#22D3EE"
                  strokeWidth={2.5}
                  fill="url(#resQueueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB 3: WAITING TIME */}
      {activeTab === 'Waiting Time' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 bento-card">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              Customer Delay Density Distribution
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Discrete bucket histogram of time elapsed prior to counter service.
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waitHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#64748B" fontSize={11} tickLine={false} unit="m" />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111B2B',
                      borderColor: '#24334A',
                      borderRadius: '10px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Bar dataKey="count" name="Customers" fill="#4F8CFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bento-card space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Percentile Metrics</h3>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Median (P50):</span>
                <span className="text-white font-bold">{fmt(m?.median_waiting_time)} min</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">90th Percentile (P90):</span>
                <span className="text-cyan-400 font-bold">{fmt(m?.p90_waiting_time)} min</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#24334A]">
                <span className="text-slate-400">Maximum Observed:</span>
                <span className="text-amber-400 font-bold">{fmt(m?.max_waiting_time)} min</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Standard Deviation:</span>
                <span className="text-purple-400 font-bold">±{fmt(m?.std_waiting_time)} min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COUNTER UTILIZATION */}
      {activeTab === 'Counter Utilization' && (
        <div className="bento-card space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">
            Server Workload Distribution Across Monte Carlo Replications
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={repComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                <XAxis dataKey="rep" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111B2B',
                    borderColor: '#24334A',
                    borderRadius: '10px',
                    color: '#F1F5F9',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="server_utilization"
                  name="Utilization %"
                  stroke="#14B8A6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB 5: ARRIVAL & SERVICE */}
      {activeTab === 'Arrival & Service' && (
        <div className="bento-card space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">System Flow Balances</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <span className="text-slate-400 block mb-1">Customers Ingested</span>
              <span className="text-2xl font-bold text-white">{m?.customers_arrived ?? '—'}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <span className="text-slate-400 block mb-1">Customers Discharged</span>
              <span className="text-2xl font-bold text-emerald-400">{m?.customers_served ?? '—'}</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <span className="text-slate-400 block mb-1">Average System Time (W)</span>
              <span className="text-2xl font-bold text-cyan-400">{fmt(m?.avg_system_time)} min</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: STATISTICAL SUMMARY */}
      {activeTab === 'Statistical Summary' && (
        <div className="bento-card space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">Full Statistical Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#24334A] text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Metric Name</th>
                  <th className="py-2.5 px-3">Mean Value</th>
                  <th className="py-2.5 px-3">Std Dev</th>
                  <th className="py-2.5 px-3">95% CI Lower</th>
                  <th className="py-2.5 px-3">95% CI Upper</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24334A]/50 text-slate-200">
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-cyan-400">Customer Waiting Time (Wq)</td>
                  <td className="py-2.5 px-3">{fmt(m?.avg_waiting_time)} min</td>
                  <td className="py-2.5 px-3">±{fmt(m?.std_waiting_time)}</td>
                  <td className="py-2.5 px-3">{fmt(m?.ci_lower_waiting)}</td>
                  <td className="py-2.5 px-3">{fmt(m?.ci_upper_waiting)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-purple-400">Queue Buffer Length (Lq)</td>
                  <td className="py-2.5 px-3">{fmt(m?.avg_queue_length)} cust</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-teal-400">Server Utilization (ρ)</td>
                  <td className="py-2.5 px-3">{m != null ? pct(m.server_utilization) : '—'}</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-semibold text-emerald-400">System Throughput</td>
                  <td className="py-2.5 px-3">{fmt(m?.throughput)} /hr</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                  <td className="py-2.5 px-3">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
