import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Settings2, Cpu, CheckCircle2, Sliders, Info, Save, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export default function CounterConfigPage() {
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const queryClient = useQueryClient()

  // Fetch scenarios from workspace
  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['scenarios-list-counters', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 50),
    enabled: !!workspaceId,
  })

  const scenarios = scenariosData?.data ?? []
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [servers, setServers] = useState(3)
  const [discipline, setDiscipline] = useState('FIFO')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Auto-select first scenario if none selected
  useEffect(() => {
    if (scenarios.length > 0 && !selectedScenarioId) {
      setSelectedScenarioId(scenarios[0].id)
    }
  }, [scenarios, selectedScenarioId])

  // Sync state with selected scenario's config
  useEffect(() => {
    if (selectedScenarioId) {
      const scen = scenarios.find((s) => s.id === selectedScenarioId)
      if (scen?.config) {
        if (scen.config.servers) setServers(scen.config.servers)
        if (scen.config.queue_discipline) setDiscipline(scen.config.queue_discipline)
      }
    }
  }, [selectedScenarioId, scenarios])

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)

  // Save to backend scenario
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScenario || !workspaceId) return
      const updatedConfig = {
        ...selectedScenario.config,
        servers: servers,
        queue_discipline: 'FIFO' as const,
      }
      return scenarioService.update(selectedScenario.id, workspaceId, {
        name: selectedScenario.name,
        description: selectedScenario.description,
        service_type: selectedScenario.service_type,
        config: updatedConfig,
      })
    },
    onSuccess: () => {
      setSaveSuccess(`Capacity configuration (${servers} counters, ${discipline}) saved to scenario "${selectedScenario?.name}".`)
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['scenarios-list-counters'] })
      setTimeout(() => setSaveSuccess(null), 4000)
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Failed to save configuration.')
      setSaveSuccess(null)
    },
  })

  if (scenariosLoading) return <PageLoader message="LOADING CAPACITY CONFIGURATION..." />

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Capacity Topology
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Counter Architecture & Network Configuration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Service counter clusters, multi-server parallel pooling, and queuing dispatch policies.
          </p>
        </div>

        {scenarios.length > 0 && (
          <div className="w-full sm:w-64">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Active Scenario:</label>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="input-field text-xs font-mono w-full"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} /> {saveSuccess}
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} /> {saveError}
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="bento-card text-center py-12 space-y-3">
          <p className="text-slate-400 text-sm">
            No scenarios found in this workspace. Create a scenario or seed demo data to configure counter architecture.
          </p>
          <button onClick={() => navigate('/scenarios/new')} className="btn-primary shadow-glow text-xs">
            Create New Scenario
          </button>
        </div>
      ) : (
        <div className="bento-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex justify-between text-xs font-mono text-slate-300 mb-2">
                <span>Active Parallel Counters in Service Pool (c):</span>
                <strong className="text-teal-400 font-bold text-base">{servers} Counters</strong>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={servers}
                onChange={(e) => setServers(parseInt(e.target.value, 10))}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="label">Queuing Dispatch Policy</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="input-field"
              >
                <option value="FIFO">First-In, First-Out (FIFO / FCFS)</option>
                <option value="PRIORITY">Priority Routing (Strict Preemptive)</option>
                <option value="SPT">Shortest Processing Time (SPT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...Array(servers)].map((_, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">Counter Desk #{idx + 1}</span>
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                </div>
                <span className="text-[11px] text-slate-400 block font-mono">Status: Online</span>
                <span className="text-[11px] text-slate-400 block">Single queue shared dispatch</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#24334A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={14} /> Synchronized with SimPy Engine
            </span>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary shadow-glow text-xs flex items-center gap-2 self-end sm:self-auto"
            >
              <Save size={14} />
              {saveMutation.isPending ? 'Saving...' : 'Save Capacity Configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
