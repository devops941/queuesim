import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  Plus,
  FileText,
  FileSpreadsheet,
  Printer,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  Clock,
  Cpu,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { reportService } from '@/services/report.service'
import { analyticsService } from '@/services/analytics.service'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import apiClient from '@/services/api'
import type { Report, ReportFormat } from '@/types'

function FormatIcon({ format }: { format: string }) {
  if (format === 'pdf') return <FileText size={16} className="text-rose-400" />
  return <FileSpreadsheet size={16} className="text-emerald-400" />
}

export default function ReportsPage() {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const queryClient = useQueryClient()

  const [selectedRunId, setSelectedRunId] = useState('')
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf')
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportSuccess, setReportSuccess] = useState<string | null>(null)

  // Fetch recent runs to populate run selector
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard-for-reports', workspaceId],
    queryFn: () => analyticsService.getDashboard(workspaceId!),
    enabled: !!workspaceId,
  })

  // Fetch scenarios to label runs with scenario names
  const { data: scenarios } = useQuery({
    queryKey: ['scenarios-for-reports', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 100),
    enabled: !!workspaceId,
  })
  const scenarioMap = new Map(scenarios?.data?.map((s) => [s.id, s]) ?? [])

  // List existing reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports-list', workspaceId],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/reports', {
          params: { workspace_id: workspaceId },
        })
        return res.data as Report[]
      } catch {
        return []
      }
    },
    enabled: !!workspaceId,
  })

  // Fetch all completed runs in workspace
  const { data: runsList } = useQuery({
    queryKey: ['completed-runs-for-reports', workspaceId],
    queryFn: () => runService.listWorkspaceRuns(workspaceId!, 'completed'),
    enabled: !!workspaceId,
  })

  const completedRuns = runsList && (Array.isArray(runsList) ? runsList : runsList.data)?.length > 0
    ? (Array.isArray(runsList) ? runsList : runsList.data)
    : (dashboard?.recent_runs?.filter((r) => r.status === 'completed') ?? [])

  const generateMutation = useMutation({
    mutationFn: (fmt: ReportFormat) => {
      const runIdToUse = selectedRunId || completedRuns[0]?.id
      if (!runIdToUse) throw new Error('No completed run selected')
      return reportService.createReport(runIdToUse, workspaceId!, fmt)
    },
    onSuccess: (report) => {
      setReportSuccess(`Report generated! Click download to view.`)
      queryClient.invalidateQueries({ queryKey: ['reports-list'] })
      const url = reportService.getDownloadUrl(report.id, workspaceId!)
      window.open(url, '_blank')
    },
    onError: () => setReportError('Failed to generate report. Ensure run is completed.'),
  })

  if (isLoading) return <PageLoader message="LOADING REPORT CENTER..." />

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Executive Dossiers & Exports
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Report Generation Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate publication-ready Operations Research summaries, percentile metrics, and audit datasets.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="btn-secondary text-xs"
        >
          <Printer size={15} /> Print Dashboard
        </button>
      </div>

      {reportSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} /> {reportSuccess}
        </div>
      )}
      {reportError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} /> {reportError}
        </div>
      )}

      {/* Generator Bento Card */}
      <div className="bento-card-elevated space-y-5">
        <div className="flex items-center justify-between border-b border-[#2E4160] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Generate Simulation Dossier
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">PDF Engine v1.0</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6">
            <label className="label">Select Simulation Run</label>
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="input-field text-xs font-mono"
            >
              <option value="">Select a completed simulation run...</option>
              {completedRuns.map((r) => {
                const scName = scenarioMap.get(r.scenario_id)?.name ?? 'Bank Morning Peak Surge (3 Counters)'
                const displayId = r.id.startsWith('run-') ? r.id.replace('run-', 'rn-') : r.id.slice(-8)
                return (
                  <option key={r.id} value={r.id}>
                    #{displayId} • {scName}
                  </option>
                )
              })}

            </select>
          </div>

          <div className="md:col-span-3">
            <label className="label">Output Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'pdf'
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-[#0D1422] border-[#24334A] text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={14} className="text-rose-400" /> PDF Document
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'csv'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#0D1422] border-[#24334A] text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet size={14} className="text-emerald-400" /> Raw CSV
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              onClick={() => generateMutation.mutate(selectedFormat)}
              disabled={generateMutation.isPending}
              className="btn-primary w-full text-xs font-bold py-2.5 shadow-glow"
            >
              <Download size={14} />{' '}
              {generateMutation.isPending ? 'Generating Report...' : 'Compile & Export'}
            </button>
          </div>
        </div>

        {/* Report Sections Breakdown Overview */}
        <div className="mt-4 pt-4 border-t border-[#2E4160]/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
          <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
            <strong className="text-white block mb-0.5">1. Exec Summary</strong>
            <span>Simulation metadata & key parameters</span>
          </div>
          <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
            <strong className="text-cyan-400 block mb-0.5">2. Queue Dynamics</strong>
            <span>L(t) profiles & 95% CI bands</span>
          </div>
          <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
            <strong className="text-teal-400 block mb-0.5">3. Counter Labor</strong>
            <span>Individual desk utilization rates</span>
          </div>
          <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
            <strong className="text-purple-400 block mb-0.5">4. Statistical Table</strong>
            <span>Wq, Lq, ρ, and P90 percentiles</span>
          </div>
        </div>
      </div>

      {/* Generated Reports Archive Table */}
      <div className="bento-card space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">Recent Generated Exports</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-[#24334A] text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Report ID</th>
                <th className="py-3 px-4">Associated Run</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Compiled At</th>
                <th className="py-3 px-4 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334A]/50">
              {reports && reports.length > 0 ? (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-[#162236]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-cyan-400">
                      #{r.id.slice(-8)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      Run #{r.run_id.slice(-8)}
                    </td>
                    <td className="py-3 px-4 uppercase font-mono font-semibold">
                      <span className="flex items-center gap-1.5">
                        <FormatIcon format={r.format} />
                        {r.format}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={reportService.getDownloadUrl(r.id, workspaceId!)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost text-xs text-cyan-400 hover:text-white"
                      >
                        <Download size={14} /> Download
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No exported reports compiled yet. Select a completed simulation run above to compile your first report.
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
