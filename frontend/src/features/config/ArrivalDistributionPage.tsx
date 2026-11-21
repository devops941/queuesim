import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, Info, Calculator, CheckCircle2, Save, Sparkles, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export default function ArrivalDistributionPage() {
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const queryClient = useQueryClient()

  // Fetch scenarios from workspace
  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['scenarios-list-arrival', workspaceId],
    queryFn: () => scenarioService.list(workspaceId!, 0, 50),
    enabled: !!workspaceId,
  })

  const scenarios = scenariosData?.data ?? []
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [lambdaVal, setLambdaVal] = useState(20) // customers per hour
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
      if (scen?.config?.arrival?.mean_interarrival) {
        // λ = 60 / mean_interarrival
        const computedLambda = Math.round(60 / scen.config.arrival.mean_interarrival)
        setLambdaVal(Math.max(1, Math.min(60, computedLambda)))
      }
    }
  }, [selectedScenarioId, scenarios])

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId)
  const meanInterarrival = (60 / lambdaVal).toFixed(2)

  // Save to backend scenario
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScenario || !workspaceId) return
      const updatedConfig = {
        ...selectedScenario.config,
        arrival: {
          ...selectedScenario.config.arrival,
          distribution: 'exponential' as const,
          mean_interarrival: parseFloat(meanInterarrival),
        },
      }
      return scenarioService.update(selectedScenario.id, workspaceId, {
        name: selectedScenario.name,
        description: selectedScenario.description,
        service_type: selectedScenario.service_type,
        config: updatedConfig,
      })
    },
    onSuccess: () => {
      setSaveSuccess(`Arrival rate (λ = ${lambdaVal}/hr) saved to scenario "${selectedScenario?.name}".`)
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['scenarios-list-arrival'] })
      setTimeout(() => setSaveSuccess(null), 4000)
    },
    onError: (err: any) => {
      setSaveError(err?.message || 'Failed to save configuration.')
      setSaveSuccess(null)
    },
  })

  // PDF curve generation for Exponential distribution: f(t) = λ e^(-λt)
  const curveData = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((t) => {
    const ratePerMin = lambdaVal / 60
    const prob = ratePerMin * Math.exp(-ratePerMin * t)
    return {
      t: `${t}m`,
      density: parseFloat(prob.toFixed(4)),
    }
  })

  if (scenariosLoading) return <PageLoader message="LOADING ARRIVAL CONFIGURATION..." />

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Probability Mechanics
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Arrival Distribution Modeling
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explore stochastic Poisson processes, exponential inter-arrival distributions, and surge arrival rates.
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
            No scenarios found in this workspace. Create a scenario or seed demo data to calibrate arrival distributions.
          </p>
          <button onClick={() => navigate('/scenarios/new')} className="btn-primary shadow-glow text-xs">
            Create New Scenario
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bento-card space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Poisson Arrival Rate (λ)</h3>
            <p className="text-xs text-slate-400">
              Adjust arrival velocity to calibrate the inter-arrival probability density function for{' '}
              <strong className="text-cyan-400">{selectedScenario?.name}</strong>.
            </p>

            <div>
              <div className="flex justify-between text-xs font-mono text-slate-300 mb-2">
                <span>Arrival Rate (λ):</span>
                <strong className="text-cyan-400 font-bold">{lambdaVal} cust/hr</strong>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={lambdaVal}
                onChange={(e) => setLambdaVal(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A] space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Mean Interarrival Time (1/λ):</span>
                <strong className="text-white">{meanInterarrival} minutes</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Memoryless Property:</span>
                <span className="text-emerald-400 font-bold">P(T &gt; s+t | T &gt; s) = P(T &gt; t)</span>
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
              Exponential PDF f(t) = λ e^-(λt)
            </h3>
            <p className="text-xs text-slate-400 mb-3">Probability of next arrival occurring within t minutes.</p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#24334A" vertical={false} />
                  <XAxis dataKey="t" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
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
                    dataKey="density"
                    name="f(t)"
                    stroke="#22D3EE"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
