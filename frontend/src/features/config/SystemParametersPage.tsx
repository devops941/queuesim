import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Sliders, Save, RotateCcw, CheckCircle2, Cpu, Clock, Layers, ShieldCheck, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import apiClient from '@/services/api'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export default function SystemParametersPage() {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [horizon, setHorizon] = useState('480')
  const [warmUp, setWarmUp] = useState('30')
  const [replications, setReplications] = useState('20')
  const [confidence, setConfidence] = useState('95')
  const [timeUnit, setTimeUnit] = useState('minutes')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch persisted parameters from backend
  const { data: initialSettings, isLoading } = useQuery({
    queryKey: ['system-parameters', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get('/admin/system-parameters', {
        params: { workspace_id: workspaceId },
      })
      return res.data?.data || res.data
    },
    enabled: !!workspaceId,
  })

  useEffect(() => {
    if (initialSettings) {
      const h = initialSettings.horizon_minutes || initialSettings.default_horizon
      const w = initialSettings.warm_up_minutes !== undefined ? initialSettings.warm_up_minutes : initialSettings.default_warm_up
      const r = initialSettings.default_replications
      const c = initialSettings.confidence_level
      const t = initialSettings.time_unit
      if (h) setHorizon(String(h))
      if (w !== undefined) setWarmUp(String(w))
      if (r) setReplications(String(r))
      if (c) setConfidence(String(c))
      if (t) setTimeUnit(String(t))
    }
  }, [initialSettings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        horizon_minutes: parseInt(horizon, 10),
        default_horizon: parseInt(horizon, 10),
        warm_up_minutes: parseInt(warmUp, 10),
        default_warm_up: parseInt(warmUp, 10),
        default_replications: parseInt(replications, 10),
        confidence_level: parseInt(confidence, 10),
        time_unit: timeUnit,
      }
      const res = await apiClient.put('/admin/system-parameters', payload, {
        params: { workspace_id: workspaceId },
      })
      return res.data
    },
    onSuccess: () => {
      setSavedMessage('System parameters successfully synchronized with database & simulation engine.')
      setErrorMessage(null)
      setTimeout(() => setSavedMessage(null), 4000)
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.detail || 'Failed to persist parameters to database.')
      setSavedMessage(null)
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    saveMutation.mutate()
  }

  if (isLoading) return <PageLoader message="LOADING SYSTEM CALIBRATION SETTINGS..." />

  return (
    <div className="space-y-6 pb-12 w-full">
      <div>
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
            Engine Calibration
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          System Parameters & Engine Defaults
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Global execution limits, random number seed generation policies, and simulation horizon benchmarks.
        </p>
      </div>

      {savedMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} /> {savedMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      <form onSubmit={handleSave} className="bento-card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label">Default Horizon Window (Minutes)</label>
            <input
              type="number"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="input-field font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Typical service shift (480 min = 8 hrs, 720 min = 12 hrs).
            </span>
          </div>

          <div>
            <label className="label">Warm-Up Transient Exclusion (Minutes)</label>
            <input
              type="number"
              value={warmUp}
              onChange={(e) => setWarmUp(e.target.value)}
              className="input-field font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Discard initial state statistics to eliminate cold-start bias.
            </span>
          </div>

          <div>
            <label className="label">Default Monte Carlo Replications</label>
            <input
              type="number"
              min="1"
              max="100"
              value={replications}
              onChange={(e) => setReplications(e.target.value)}
              className="input-field font-mono"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Recommended: 15–30 replications for stable 95% Confidence Intervals.
            </span>
          </div>

          <div>
            <label className="label">Statistical Confidence Level</label>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="input-field"
            >
              <option value="90">90% Confidence Level (z = 1.645)</option>
              <option value="95">95% Confidence Level (z = 1.960)</option>
              <option value="99">99% Confidence Level (z = 2.576)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-[#24334A] flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
            <ShieldCheck size={14} className="text-emerald-400" /> Database-backed persistence
          </span>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary shadow-glow flex items-center gap-2 text-xs font-bold"
          >
            <Save size={14} />
            {saveMutation.isPending ? 'Saving Parameters...' : 'Save Parameters to Database'}
          </button>
        </div>
      </form>
    </div>
  )
}
