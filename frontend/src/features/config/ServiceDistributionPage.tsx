import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Layers, Info, CheckCircle2, Save, Sparkles, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export default function ServiceDistributionPage() {
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const queryClient = useQueryClient()

  // Fetch scenarios from workspace
  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['scenarios-list-service', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 50),
    enabled: !!workspaceId,
  })

  const scenarios = scenariosData?.data ?? []
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [distType, setDistType] = useState('exponential')
  const [meanService, setMeanService] = useState(6)
  const [stdDev, setStdDev] = useState(1.5)
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
      if (scen?.config?.service) {
        const srv = scen.config.service
        setDistType(srv.distribution || 'exponential')
        if (srv.mean) setMeanService(srv.mean)
        if (srv.std_dev) setStdDev(srv.std_dev)
      }
    }
  }, [selectedScenarioId, scenarios])

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)

  // Save to backend scenario
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScenario || !workspaceId) return
      const serviceConfig: any = {
        distribution: distType,
        mean: meanService,
      }
      if (distType === 'normal') {
        serviceConfig.std_dev = stdDev
      } else if (distType === 'uniform') {
        serviceConfig.min_time = Math.max(1, meanService - 3)
        serviceConfig.max_time = meanService + 3
      }

      const updatedConfig = {
        ...selectedScenario.config,
        service: serviceConfig,
      }
      return scenarioService.update(selectedScenario.id, workspaceId, {
        name: selectedScenario.name,
        description: selectedScenario.description,
        service_type: selectedScenario.service_type,
        config: updatedConfig,
      })
    },
    onSuccess: () => {
      setSaveSuccess(
        `Service distribution (${distType}, mean = ${meanService} min) saved to scenario "${selectedScenario?.name}".`
      )
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['scenarios-list-service'] })
      setTimeout(() => setSaveSuccess(null), 4000)
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Failed to save configuration.')
      setSaveSuccess(null)
    },
  })

  // Dynamic distribution bins based on selected law and mean service duration
  const bins = useMemo(() => {
    if (distType === 'exponential') {
      const muRate = 1 / meanService
      return [2, 4, 6, 8, 10, 12, 14, 16].map((t) => ({
        time: `${t}m`,
        count: Math.max(1, Math.round(60 * Math.exp(-muRate * t))),
      }))
    }
    if (distType === 'uniform') {
      return [2, 4, 6, 8, 10, 12, 14, 16].map((t) => ({
        time: `${t}m`,
        count: 22,
      }))
    }
    if (distType === 'fixed') {
      return [2, 4, 6, 8, 10, 12, 14, 16].map((t) => ({
        time: `${t}m`,
        count: Math.abs(t - Math.round(meanService)) <= 1 ? 55 : 2,
      }))
    }
    // Normal / Gaussian default
    const sd = stdDev || 1.5
    return [2, 4, 6, 8, 10, 12, 14, 16].map((t) => {
      const z = (t - meanService) / sd
      const density = Math.exp(-0.5 * z * z)
      return {
        time: `${t}m`,
        count: Math.max(1, Math.round(density * 42)),
      }
    })
  }, [distType, meanService, stdDev])

  if (scenariosLoading) return <PageLoader message="LOADING SERVICE CONFIGURATION..." />

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Transaction Dynamics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Service Distribution Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure transaction durations across Exponential (M), Gaussian / Normal (G), and Uniform ranges.
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
            No scenarios found in this workspace. Create a scenario or seed demo data to calibrate service distributions.
          </p>
          <button onClick={() => navigate('/scenarios/new')} className="btn-primary shadow-glow text-xs">
            Create New Scenario
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bento-card space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Distribution Selector</h3>

            <div className="space-y-3">
              <div>
                <label className="label">Mathematical Law</label>
                <select
                  value={distType}
                  onChange={(e) => setDistType(e.target.value)}
                  className="input-field"
                >
                  <option value="exponential">Exponential (Markovian M/M/c)</option>
                  <option value="normal">Normal / Gaussian (M/G/c)</option>
                  <option value="uniform">Uniform Continuous Range</option>
                  <option value="fixed">Fixed Deterministic (M/D/c)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Mean Service Time (μ^-1):</span>
                  <strong className="text-purple-400 font-bold">{meanService} min</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={meanService}
                  onChange={(e) => setMeanService(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              {distType === 'normal' && (
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>Standard Deviation (σ):</span>
                    <strong className="text-teal-400 font-bold">{stdDev} min</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.1"
                    value={stdDev}
                    onChange={(e) => setStdDev(parseFloat(e.target.value))}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A] text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Single Server Capacity (μ):</span>
                <strong className="text-white">{(60 / meanService).toFixed(1)} cust/hr</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Variance Type:</span>
                <span className="text-slate-300">
                  {distType === 'exponential' ? 'Memoryless (Var = μ²)' : distType === 'normal' ? 'Gaussian' : 'Deterministic'}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="btn-primary shadow-glow text-xs flex items-center gap-2"
              >
                <Save size={14} />
                {saveMutation.isPending ? 'Saving...' : 'Save to Scenario in Database'}
              </button>
            </div>
          </div>

          <div className="md:col-span-6 bento-card">
            <h3 className="text-base font-bold text-white tracking-tight mb-1">
              Simulated Duration Density Bins
            </h3>
            <p className="text-xs text-slate-400 mb-3">Service duration probability density profile.</p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bins} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111B2B',
                      borderColor: '#24334A',
                      borderRadius: '10px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Bar dataKey="count" name="Frequency" fill="#A855F7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
