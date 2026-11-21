import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  FlaskConical,
  Play,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  TrendingDown,
  Cpu,
  Clock,
  Sparkles,
  Sliders,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Activity,
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  X,
  CheckCircle,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import apiClient from '@/services/api'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { ImportRecord, DistributionType, ServiceConfig } from '@/types'

// Validation Schema
const schema = z.object({
  name: z.string().min(2, 'Name is required (min 2 characters)'),
  description: z.string().optional(),
  service_type: z.string().default('custom'),
  arrival_distribution: z.enum(['exponential', 'fixed']),
  mean_interarrival: z.coerce.number().positive('Mean inter-arrival time must be positive'),
  service_distribution: z.enum(['exponential', 'fixed', 'normal', 'uniform']),
  service_mean: z.coerce.number().positive().optional(),
  service_std_dev: z.coerce.number().positive().optional(),
  service_min_time: z.coerce.number().positive().optional(),
  service_max_time: z.coerce.number().positive().optional(),
  servers: z.coerce.number().int().min(1, 'Minimum 1 counter').max(50, 'Maximum 50 counters'),
  horizon_minutes: z.coerce.number().positive('Duration must be positive'),
  warm_up_minutes: z.coerce.number().min(0, 'Warm-up cannot be negative'),
  replications: z.coerce.number().int().min(1).max(100),
  seed: z.coerce.number().int().optional(),
})

type FormData = z.infer<typeof schema>

const PRESET_TEMPLATES: Record<string, Partial<FormData>> = {
  bank_counter: {
    name: 'Bank Counter Peak Model',
    description: '3-teller counter configuration simulating peak morning deposits and withdrawals.',
    service_type: 'bank_counter',
    arrival_distribution: 'exponential',
    mean_interarrival: 3,
    service_distribution: 'exponential',
    service_mean: 5,
    servers: 3,
    horizon_minutes: 480,
    warm_up_minutes: 30,
    replications: 15,
    seed: 1234,
  },
  clinic_registration: {
    name: 'Clinic Triage & Registration',
    description: '2-desk outpatient clinic registration with Gaussian service distribution.',
    service_type: 'clinic_registration',
    arrival_distribution: 'exponential',
    mean_interarrival: 5,
    service_distribution: 'normal',
    service_mean: 8,
    service_std_dev: 2,
    servers: 2,
    horizon_minutes: 360,
    warm_up_minutes: 20,
    replications: 10,
    seed: 5678,
  },
  college_office: {
    name: 'College Admissions Counter',
    description: 'Single-counter academic document verification with uniform service variation.',
    service_type: 'college_office',
    arrival_distribution: 'exponential',
    mean_interarrival: 6,
    service_distribution: 'uniform',
    service_min_time: 4,
    service_max_time: 14,
    servers: 1,
    horizon_minutes: 240,
    warm_up_minutes: 15,
    replications: 10,
    seed: 9012,
  },
  ticket_counter: {
    name: 'Transit Terminal Ticket Hub',
    description: '4-server booking terminal during rush hour departure surge.',
    service_type: 'ticket_counter',
    arrival_distribution: 'exponential',
    mean_interarrival: 2,
    service_distribution: 'exponential',
    service_mean: 4.5,
    servers: 4,
    horizon_minutes: 300,
    warm_up_minutes: 15,
    replications: 20,
    seed: 42,
  },
}

export default function ScenarioBuilderPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [activeTab, setActiveTab] = useState<'details' | 'arrival' | 'service' | 'counters' | 'advanced' | 'csv'>('details')
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(id ?? null)
  const [validationResult, setValidationResult] = useState<{ status: string; message: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDragging, setCsvDragging] = useState(false)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportRecord | null>(null)
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<{ arrival: string; service: string }>>([])
  const [csvStats, setCsvStats] = useState<{ count: number; meanArrival: number; meanService: number; maxHorizon: number } | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvApplied, setCsvApplied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!id

  const { data: existingScenario, isLoading: scenarioLoading } = useQuery({
    queryKey: ['scenario', id, workspaceId],
    queryFn: () => scenarioService.get(id!, workspaceId!),
    enabled: !!id && !!workspaceId,
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      service_type: 'custom',
      arrival_distribution: 'exponential',
      mean_interarrival: 4,
      service_distribution: 'exponential',
      service_mean: 6,
      service_std_dev: 1.5,
      service_min_time: 3,
      service_max_time: 12,
      servers: 3,
      horizon_minutes: 480,
      warm_up_minutes: 30,
      replications: 15,
      seed: 42,
    },
  })

  // Watch fields for live theoretical OR calculations
  const values = watch()
  const arrivalDist = watch('arrival_distribution')
  const serviceDist = watch('service_distribution')
  const interarrival = watch('mean_interarrival') || 1
  const serviceMean =
    serviceDist === 'uniform'
      ? ((watch('service_min_time') || 1) + (watch('service_max_time') || 5)) / 2
      : watch('service_mean') || 1
  const serverCount = watch('servers') || 1
  const horizon = watch('horizon_minutes') || 480

  // Operations Research Estimates (M/M/c approximation):
  // λ = arrival rate per minute
  // μ = service rate per server per minute
  const lambda = 1 / Math.max(0.001, interarrival)
  const mu = 1 / Math.max(0.001, serviceMean)
  const totalCapacity = serverCount * mu
  // Traffic intensity ρ = λ / (c * μ)
  const rho = lambda / Math.max(0.001, totalCapacity)
  const estimatedArrivals = Math.round(lambda * horizon)

  // System stability assessment
  const isStable = rho < 1.0
  const isOptimal = rho >= 0.65 && rho <= 0.88
  const isSevereCongestion = rho >= 1.0

  // Apply query parameter template
  useEffect(() => {
    const templateKey = searchParams.get('template')
    if (templateKey && PRESET_TEMPLATES[templateKey]) {
      reset({ ...values, ...PRESET_TEMPLATES[templateKey] })
    }
  }, [searchParams])

  // Populate form when editing existing scenario
  useEffect(() => {
    if (existingScenario) {
      reset({
        name: existingScenario.name,
        description: existingScenario.description || '',
        service_type: existingScenario.service_type,
        arrival_distribution: existingScenario.config.arrival.distribution,
        mean_interarrival: existingScenario.config.arrival.mean_interarrival,
        service_distribution: existingScenario.config.service.distribution,
        service_mean: existingScenario.config.service.mean ?? 6,
        service_std_dev: existingScenario.config.service.std_dev ?? 1.5,
        service_min_time: existingScenario.config.service.min_time ?? 3,
        service_max_time: existingScenario.config.service.max_time ?? 12,
        servers: existingScenario.config.servers,
        horizon_minutes: existingScenario.config.horizon_minutes,
        warm_up_minutes: existingScenario.config.warm_up_minutes,
        replications: existingScenario.config.replications,
        seed: existingScenario.config.seed ?? 42,
      })
    }
  }, [existingScenario])

  function buildPayload(data: FormData) {
    const servers = Math.max(1, Math.min(100, Number(data.servers) || 3))
    const horizon_minutes = Math.max(10, Number(data.horizon_minutes) || 120)
    let warm_up_minutes = Math.max(0, Number(data.warm_up_minutes) || 0)
    if (warm_up_minutes >= horizon_minutes) {
      warm_up_minutes = Math.max(0, Math.floor(horizon_minutes * 0.1))
    }
    const replications = Math.max(1, Math.min(100, Number(data.replications) || 15))
    const seed = Number(data.seed) || 42
    const mean_interarrival = Math.max(0.01, Number(data.mean_interarrival) || 4.0)

    const dist = (data.service_distribution || 'exponential') as DistributionType
    const servicePayload: ServiceConfig = {
      distribution: dist,
      ...(dist === 'normal'
        ? {
            mean: Math.max(0.01, Number(data.service_mean) || 8.0),
            std_dev: Math.max(0.01, Number(data.service_std_dev) || 2.0),
          }
        : dist === 'uniform'
        ? {
            min_time: Math.max(0.01, Number(data.service_min_time) || 3.0),
            max_time: Math.max(
              Math.max(0.01, Number(data.service_min_time) || 3.0) + 0.1,
              Number(data.service_max_time) || 12.0
            ),
          }
        : {
            mean: Math.max(0.01, Number(data.service_mean) || 5.0),
          }),
    }

    return {
      name: (data.name || 'Simulation Scenario').trim(),
      description: data.description || '',
      service_type: data.service_type || 'custom',
      config: {
        servers,
        horizon_minutes,
        warm_up_minutes,
        replications,
        seed,
        queue_discipline: 'FIFO' as const,
        arrival: {
          distribution: (data.arrival_distribution || 'exponential') as 'fixed' | 'exponential',
          mean_interarrival,
        },
        service: servicePayload,
      },
    }
  }

  function formatApiError(err: any, fallback: string): string {
    const errData = err?.response?.data?.error
    if (errData?.details && Array.isArray(errData.details)) {
      const details = errData.details
        .map((d: any) => {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : 'field'
          return `${loc}: ${d.msg}`
        })
        .join('; ')
      return `${errData.message || 'Validation error'} (${details})`
    }
    return errData?.message || err?.response?.data?.detail || fallback
  }

  // Save Scenario (Create or Update)
  async function handleSaveScenario(data: FormData) {
    const wsId = workspaceId || '000000000000000000000002'
    setSubmitError(null)
    try {
      const payload = buildPayload(data)
      let scenarioId = savedScenarioId
      if (scenarioId) {
        await scenarioService.update(scenarioId, wsId, payload)
      } else {
        const created = await scenarioService.create(wsId, payload)
        scenarioId = created.id
        setSavedScenarioId(scenarioId)
      }
      return scenarioId
    } catch (err: any) {
      setSubmitError(formatApiError(err, 'Failed to save scenario.'))
      return null
    }
  }

  // Run Simulation CTA (Saves & Triggers Run immediately)
  async function handleRunSimulation(data: FormData) {
    if (!workspaceId) return
    setIsLaunching(true)
    const scenarioId = await handleSaveScenario(data)
    if (!scenarioId) {
      setIsLaunching(false)
      return
    }

    try {
      // Validate configuration with backend
      await scenarioService.validate(scenarioId, workspaceId)
      // Create simulation run
      const run = await runService.createRun(workspaceId, scenarioId)
      navigate(`/runs/${run.id}`)
    } catch (err: any) {
      setSubmitError('Failed to initialize simulation run. Please verify parameters.')
      setIsLaunching(false)
    }
  }

  // Validate Only
  async function handleValidateOnly(data: FormData) {
    const scenarioId = await handleSaveScenario(data)
    if (!scenarioId || !workspaceId) return
    try {
      const result = await scenarioService.validate(scenarioId, workspaceId)
      setValidationResult(result)
    } catch (err) {
      setSubmitError('Validation check failed.')
    }
  }

  function downloadSampleCSV() {
    const csvContent = `arrival_timestamp,service_duration
1.2,4.5
2.8,3.8
4.5,6.2
6.1,2.9
8.4,5.1
10.2,4.0
12.7,3.5
15.0,7.2
17.3,4.8
19.1,5.5
`
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_queue_data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function parseCSVFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) {
        setCsvError('CSV file must have a header and at least one data row.')
        return
      }

      const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
      let arrIdx = header.findIndex((h) => h.includes('arrival'))
      let srvIdx = header.findIndex((h) => h.includes('service') || h.includes('duration'))
      if (arrIdx === -1 && header.length >= 1) arrIdx = 0
      if (srvIdx === -1 && header.length >= 2) srvIdx = 1

      const preview: Array<{ arrival: string; service: string }> = []
      const arrivals: number[] = []
      const services: number[] = []

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim())
        const arr = parseFloat(parts[arrIdx])
        const srv = parseFloat(parts[srvIdx])
        if (!isNaN(arr) && !isNaN(srv)) {
          arrivals.push(arr)
          services.push(srv)
          if (preview.length < 5) {
            preview.push({ arrival: String(arr), service: String(srv) })
          }
        }
      }

      setCsvPreviewRows(preview)

      if (arrivals.length > 0) {
        const interarrivals: number[] = []
        for (let i = 1; i < arrivals.length; i++) {
          const diff = arrivals[i] - arrivals[i - 1]
          if (diff > 0) interarrivals.push(diff)
        }
        const meanInterarrival = interarrivals.length > 0
          ? interarrivals.reduce((a, b) => a + b, 0) / interarrivals.length
          : (arrivals[arrivals.length - 1] / arrivals.length)
        const meanService = services.reduce((a, b) => a + b, 0) / services.length
        const maxHorizon = Math.ceil(arrivals[arrivals.length - 1] + meanService * 2)

        setCsvStats({
          count: arrivals.length,
          meanArrival: parseFloat(meanInterarrival.toFixed(2)),
          meanService: parseFloat(meanService.toFixed(2)),
          maxHorizon: Math.max(60, maxHorizon),
        })
      }
    }
    reader.readAsText(file)
  }

  function handleCSVFileSelect(selected: File) {
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Only .csv files are supported.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setCsvError('File must be smaller than 10MB.')
      return
    }
    setCsvError(null)
    setCsvFile(selected)
    setCsvApplied(false)
    setCsvResult(null)
    parseCSVFile(selected)
  }

  async function handleApplyCSV() {
    if (!csvStats || !csvFile) return
    setCsvUploading(true)
    setCsvError(null)

    // 1. Auto-fill form values with safe, validated defaults
    const cleanFileName = csvFile.name.replace(/\.csv$/i, '').replace(/_/g, ' ')
    const generatedName = `Empirical Data: ${cleanFileName}`
    const horizon = Math.max(60, Math.ceil(csvStats.maxHorizon))
    const warmUp = Math.min(15, Math.floor(horizon * 0.1))

    setValue('name', generatedName)
    setValue('description', `Scenario calibrated from uploaded dataset "${csvFile.name}" (${csvStats.count} records).`)
    setValue('arrival_distribution', 'exponential')
    setValue('mean_interarrival', csvStats.meanArrival)
    setValue('service_distribution', 'exponential')
    setValue('service_mean', csvStats.meanService)
    setValue('horizon_minutes', horizon)
    setValue('warm_up_minutes', warmUp)

    const wsId = workspaceId || '000000000000000000000002'

    // 2. Persist scenario to get scenarioId if not exists
    let scenId = savedScenarioId
    const curValues = getValues()
    const payload = buildPayload({
      ...curValues,
      name: curValues.name || generatedName,
      arrival_distribution: 'exponential',
      mean_interarrival: csvStats.meanArrival,
      service_distribution: 'exponential',
      service_mean: csvStats.meanService,
      horizon_minutes: horizon,
      warm_up_minutes: warmUp,
    })

    try {
      if (scenId) {
        await scenarioService.update(scenId, wsId, payload)
      } else {
        const created = await scenarioService.create(wsId, payload)
        scenId = created.id
        setSavedScenarioId(scenId)
      }
    } catch (e: any) {
      setCsvError(formatApiError(e, 'Failed to initialize scenario.'))
      setCsvUploading(false)
      return
    }

    // 3. Upload CSV to /imports
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('scenario_id', scenId || 'unlinked')
      formData.append('workspace_id', wsId)
      const res = await apiClient.post('/imports', formData, {
        params: { workspace_id: wsId },
      })
      setCsvResult(res.data)
      setCsvApplied(true)
      setCsvError(null)
    } catch (err: any) {
      setCsvError(formatApiError(err, 'Failed to upload dataset.'))
    } finally {
      setCsvUploading(false)
    }
  }

  if (scenarioLoading) {
    return <LoadingSpinner message="Loading scenario configuration..." />
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Simulation Modeling Studio
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-mono text-slate-400">
              {isEdit ? `Editing Scenario #${id?.slice(-6)}` : 'New Model Configuration'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isEdit ? 'Configure Simulation Scenario' : 'New Simulation Workspace'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Construct operational counter models, assign probability distributions, and execute Monte Carlo replications.
          </p>
        </div>

        {/* Quick Template Picker & CSV Action */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Upload size={13} className="text-cyan-400" /> Upload CSV Dataset
          </button>

          <select
            onChange={(e) => {
              const tmpl = PRESET_TEMPLATES[e.target.value]
              if (tmpl) reset({ ...values, ...tmpl })
            }}
            className="input-field text-xs py-1.5 px-3 bg-[#111B2B] text-slate-300 border-[#24334A]"
            defaultValue=""
          >
            <option value="" disabled>Load Architecture Template...</option>
            <option value="bank_counter">Bank Counter Peak (3 Counters)</option>
            <option value="clinic_registration">Clinic Triage (2 Counters, Normal)</option>
            <option value="college_office">College Office (1 Counter, Uniform)</option>
            <option value="ticket_counter">Transit Box (4 Counters, High Surge)</option>
          </select>
        </div>
      </div>

      {submitError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3">
          <ShieldAlert size={18} className="text-rose-400 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Two-Column Bento Layout */}
      <form onSubmit={handleSubmit(handleRunSimulation)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Configuration Panel (Span 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Navigation Tabs for Configuration Sections */}
          <div className="flex items-center gap-1.5 p-1 bg-[#111B2B] border border-[#24334A] rounded-xl overflow-x-auto text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'details'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <Info size={14} /> General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('arrival')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'arrival'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <TrendingDown size={14} /> Arrival λ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('service')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'service'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <Layers size={14} /> Service μ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('counters')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'counters'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <Cpu size={14} /> Counters
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('advanced')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'advanced'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <Sliders size={14} /> Horizon & Runs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'csv'
                  ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                  : 'text-cyan-400 hover:text-white hover:bg-[#162236]'
              }`}
            >
              <Upload size={14} /> Import Dataset (CSV)
            </button>
          </div>

          {/* TAB 1: General Details */}
          {activeTab === 'details' && (
            <div className="bento-card space-y-4">
              <div className="border-b border-[#24334A] pb-3 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Info size={16} className="text-cyan-400" /> Simulation Metadata
                </h3>
                <p className="text-xs text-slate-400">
                  Assign identifying tags and operational scope to this simulation run.
                </p>
              </div>

              <div>
                <label className="label">Scenario Name *</label>
                <input
                  {...register('name')}
                  placeholder="e.g. Bank Morning Peak Surge (3 Counters)"
                  className="input-field"
                />
                {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="label">Description & Operational Notes</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Describe target objectives, peak assumptions, and counter staff shifts..."
                  className="input-field resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Service Counter Domain</label>
                  <select {...register('service_type')} className="input-field">
                    <option value="custom">Custom Operations Model</option>
                    <option value="bank_counter">Retail Banking Counter</option>
                    <option value="clinic_registration">Hospital Triage & Registration</option>
                    <option value="college_office">Academic Administrative Desk</option>
                    <option value="ticket_counter">Transit Passenger Terminal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Queue Discipline</label>
                  <input
                    disabled
                    value="FIFO (First-In, First-Out)"
                    className="input-field text-slate-400 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Arrival Distribution */}
          {activeTab === 'arrival' && (
            <div className="bento-card space-y-4">
              <div className="border-b border-[#24334A] pb-3 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingDown size={16} className="text-blue-400" /> Customer Arrival Process
                </h3>
                <p className="text-xs text-slate-400">
                  Define inter-arrival timing mechanics between consecutive customer entries.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Arrival Distribution</label>
                  <select {...register('arrival_distribution')} className="input-field">
                    <option value="exponential">Exponential (Poisson Arrivals)</option>
                    <option value="fixed">Fixed / Deterministic Schedule</option>
                  </select>
                </div>

                <div>
                  <label className="label">Mean Inter-Arrival Time (Minutes) *</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('mean_interarrival')}
                    className="input-field font-mono"
                  />
                  {errors.mean_interarrival && (
                    <p className="text-xs text-rose-400 mt-1">{errors.mean_interarrival.message}</p>
                  )}
                </div>
              </div>

              {/* Slider for Interarrival */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Quick Adjust Interarrival:</span>
                  <span className="font-mono text-cyan-400 font-semibold">{interarrival} min / customer</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={interarrival}
                  onChange={(e) => setValue('mean_interarrival', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] text-xs text-slate-400 space-y-1">
                <div className="flex justify-between font-mono">
                  <span>Effective Arrival Rate (λ):</span>
                  <strong className="text-cyan-400">{(60 / interarrival).toFixed(1)} customers / hr</strong>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Exponential inter-arrival times model random, memoryless customer entrances (classic M/M/c setup).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Service Distribution */}
          {activeTab === 'service' && (
            <div className="bento-card space-y-4">
              <div className="border-b border-[#24334A] pb-3 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Layers size={16} className="text-purple-400" /> Service Time Mechanics
                </h3>
                <p className="text-xs text-slate-400">
                  Configure how long transactions take at individual service desks.
                </p>
              </div>

              <div>
                <label className="label">Service Distribution</label>
                <select {...register('service_distribution')} className="input-field">
                  <option value="exponential">Exponential (Variable Stochastic)</option>
                  <option value="normal">Normal / Gaussian (Clustered Variance)</option>
                  <option value="uniform">Uniform Range [Min, Max]</option>
                  <option value="fixed">Fixed / Deterministic Constant</option>
                </select>
              </div>

              {/* Dynamic inputs based on distribution */}
              {serviceDist === 'exponential' && (
                <div>
                  <label className="label">Mean Service Duration (Minutes) *</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('service_mean')}
                    className="input-field font-mono"
                  />
                  {errors.service_mean && (
                    <p className="text-xs text-rose-400 mt-1">{errors.service_mean.message}</p>
                  )}
                </div>
              )}

              {serviceDist === 'normal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Mean Service Time (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('service_mean')}
                      className="input-field font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Standard Deviation (σ)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('service_std_dev')}
                      className="input-field font-mono"
                    />
                  </div>
                </div>
              )}

              {serviceDist === 'uniform' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Minimum Time (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('service_min_time')}
                      className="input-field font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Maximum Time (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('service_max_time')}
                      className="input-field font-mono"
                    />
                  </div>
                </div>
              )}

              {serviceDist === 'fixed' && (
                <div>
                  <label className="label">Constant Service Duration (Minutes)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('service_mean')}
                    className="input-field font-mono"
                  />
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] text-xs text-slate-400">
                <div className="flex justify-between font-mono">
                  <span>Single Counter Capacity (μ):</span>
                  <strong className="text-purple-400">{(60 / serviceMean).toFixed(1)} customers / hr</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Counters Configuration */}
          {activeTab === 'counters' && (
            <div className="bento-card space-y-4">
              <div className="border-b border-[#24334A] pb-3 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Cpu size={16} className="text-teal-400" /> Counter Architecture
                </h3>
                <p className="text-xs text-slate-400">
                  Specify physical or virtual service windows available in parallel.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Active Parallel Counters (c):</span>
                  <span className="font-mono text-teal-400 font-bold text-sm">{serverCount} Counters</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={serverCount}
                  onChange={(e) => setValue('servers', parseInt(e.target.value, 10))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </div>

              {/* Counter Grid Visualization Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {[...Array(serverCount)].map((_, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-slate-200">Counter #{i + 1}</span>
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Parallel FIFO Server</span>
                    <span className="text-[10px] font-mono text-cyan-400 mt-1">
                      Cap: ~{(60 / serviceMean).toFixed(0)} cust/hr
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Horizon & Replications */}
          {activeTab === 'advanced' && (
            <div className="bento-card space-y-4">
              <div className="border-b border-[#24334A] pb-3 mb-4">
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Sliders size={16} className="text-amber-400" /> Horizon & Monte Carlo Settings
                </h3>
                <p className="text-xs text-slate-400">
                  Execution duration, warm-up stabilization window, and statistical replication count.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Simulation Horizon (Minutes)</label>
                  <input
                    type="number"
                    {...register('horizon_minutes')}
                    className="input-field font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    e.g. 480 min = standard 8-hour shift
                  </span>
                </div>

                <div>
                  <label className="label">Warm-Up Period (Minutes)</label>
                  <input
                    type="number"
                    {...register('warm_up_minutes')}
                    className="input-field font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Initial transients excluded from final metrics
                  </span>
                </div>

                <div>
                  <label className="label">Monte Carlo Replications (1 - 100)</label>
                  <input
                    type="number"
                    {...register('replications')}
                    className="input-field font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Higher runs produce narrower 95% Confidence Intervals
                  </span>
                </div>

                <div>
                  <label className="label">Pseudo-Random Seed</label>
                  <input
                    type="number"
                    {...register('seed')}
                    className="input-field font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Guarantees reproducible experiment results
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CSV Dataset Ingestion */}
          {activeTab === 'csv' && (
            <div className="bento-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24334A] pb-3 mb-2">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Upload size={16} className="text-cyan-400" /> Empirical Dataset Ingestion (CSV)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload empirical arrival timestamps and service durations to calibrate this simulation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Download size={13} className="text-cyan-400" /> Sample CSV
                </button>
              </div>

              {csvError && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
                  <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {csvApplied && (
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                    <span>
                      Dataset <strong>{csvFile?.name}</strong> successfully validated ({csvStats?.count} records). Model calibrated!
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="underline font-bold text-cyan-300 hover:text-white"
                  >
                    Run Simulation Now →
                  </button>
                </div>
              )}

              {/* Drag & Drop Zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleCSVFileSelect(f)
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setCsvDragging(true)
                }}
                onDragLeave={() => setCsvDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setCsvDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleCSVFileSelect(f)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  csvDragging
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : csvFile
                    ? 'border-teal-500/50 bg-[#0D1422]'
                    : 'border-[#24334A] hover:border-cyan-500/50 bg-[#0D1422]/60 hover:bg-[#111B2B]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} />
                </div>
                {csvFile ? (
                  <div>
                    <span className="text-sm font-bold text-white block">{csvFile.name}</span>
                    <span className="text-xs font-mono text-cyan-400 block mt-1">
                      {(csvFile.size / 1024).toFixed(1)} KB • {csvStats?.count ?? '—'} data points detected
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-2">
                      Click to choose a different CSV file
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Click to upload or drag & drop CSV file
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      Supports <code className="text-cyan-400 font-mono">arrival_timestamp,service_duration</code> (Max 10 MB)
                    </span>
                  </div>
                )}
              </div>

              {/* Detected Metrics & First 5 Rows Preview */}
              {csvStats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 bg-[#0D1422] border border-[#24334A] rounded-xl">
                      <span className="text-slate-400 text-[10px] block">Detected Customers</span>
                      <strong className="text-white text-sm">{csvStats.count} entities</strong>
                    </div>
                    <div className="p-3 bg-[#0D1422] border border-[#24334A] rounded-xl">
                      <span className="text-slate-400 text-[10px] block">Mean Inter-Arrival</span>
                      <strong className="text-cyan-400 text-sm">{csvStats.meanArrival} min</strong>
                    </div>
                    <div className="p-3 bg-[#0D1422] border border-[#24334A] rounded-xl">
                      <span className="text-slate-400 text-[10px] block">Mean Service Time</span>
                      <strong className="text-purple-400 text-sm">{csvStats.meanService} min</strong>
                    </div>
                    <div className="p-3 bg-[#0D1422] border border-[#24334A] rounded-xl">
                      <span className="text-slate-400 text-[10px] block">Suggested Horizon</span>
                      <strong className="text-teal-400 text-sm">{csvStats.maxHorizon} min</strong>
                    </div>
                  </div>

                  {/* Preview Rows Table */}
                  {csvPreviewRows.length > 0 && (
                    <div className="border border-[#24334A] rounded-xl overflow-hidden bg-[#0D1422]">
                      <div className="px-4 py-2 bg-[#162236]/60 border-b border-[#24334A] flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">First 5 Sample Records Preview</span>
                        <span className="text-[11px] text-slate-400">Total: {csvStats.count} rows</span>
                      </div>
                      <table className="w-full text-xs font-mono text-left">
                        <thead>
                          <tr className="border-b border-[#24334A]/80 text-slate-400 text-[11px]">
                            <th className="py-2 px-4">Row #</th>
                            <th className="py-2 px-4">Arrival Timestamp (min)</th>
                            <th className="py-2 px-4">Service Duration (min)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#24334A]/40 text-slate-300">
                          {csvPreviewRows.map((r, i) => (
                            <tr key={i} className="hover:bg-[#162236]/20">
                              <td className="py-1.5 px-4 text-slate-500">#{i + 1}</td>
                              <td className="py-1.5 px-4 text-cyan-400">{r.arrival}</td>
                              <td className="py-1.5 px-4 text-purple-400">{r.service}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      Ready to auto-calibrate scenario parameters
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyCSV}
                      disabled={csvUploading}
                      className="btn-primary shadow-glow text-xs flex items-center gap-2 font-bold"
                    >
                      <Sparkles size={14} className={csvUploading ? 'animate-spin' : ''} />
                      {csvUploading ? 'Processing & Calibrating...' : 'Auto-Calibrate Scenario from CSV'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isLaunching}
              className="btn-primary shadow-glow px-6 py-2.5 text-sm font-bold"
            >
              <Play size={16} /> {isLaunching ? 'INITIALIZING ENGINE...' : 'RUN SIMULATION NOW'}
            </button>

            <button
              type="button"
              onClick={handleSubmit(handleSaveScenario)}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              <Save size={15} /> Save Scenario
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Upload size={14} className="text-cyan-400" /> Upload CSV Data
            </button>

            <button
              type="button"
              onClick={handleSubmit(handleValidateOnly)}
              className="btn-ghost text-xs text-slate-300"
            >
              Check Validation
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Simulation Preview & Operations Card (Span 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bento-card-elevated space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#2E4160]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Live Operations Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                Analytical M/M/c
              </span>
            </div>

            {/* Traffic Intensity Stability Gauge */}
            <div className="p-4 rounded-xl bg-[#0D1422] border border-[#24334A] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Traffic Intensity (ρ):</span>
                <strong
                  className={`text-base font-bold ${
                    isSevereCongestion
                      ? 'text-rose-400'
                      : isOptimal
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  ρ = {rho.toFixed(2)}
                </strong>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#162236] rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isSevereCongestion
                      ? 'bg-rose-500'
                      : isOptimal
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, rho * 100)}%` }}
                />
              </div>

              {/* Stability status badge */}
              <div className="flex items-center gap-2 text-xs">
                {isSevereCongestion ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
                    <ShieldAlert size={14} /> System Unstable (Queue will grow infinitely!)
                  </span>
                ) : isOptimal ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 size={14} /> Optimal Balance (High throughput, minimal delay)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                    <AlertTriangle size={14} /> Stable but Light Load (Consider fewer counters)
                  </span>
                )}
              </div>
            </div>

            {/* OR Operational Key Metrics Table */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-[#24334A]/50">
                <span className="text-slate-400">Total Customer Volume:</span>
                <span className="text-white font-bold">~{estimatedArrivals} customers</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#24334A]/50">
                <span className="text-slate-400">Arrival Velocity (λ):</span>
                <span className="text-cyan-400 font-bold">{(lambda * 60).toFixed(1)} / hr</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#24334A]/50">
                <span className="text-slate-400">Total Service Capacity (cμ):</span>
                <span className="text-teal-400 font-bold">{(totalCapacity * 60).toFixed(1)} / hr</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#24334A]/50">
                <span className="text-slate-400">Total Counter Windows:</span>
                <span className="text-white font-bold">{serverCount} Parallel Desks</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#24334A]/50">
                <span className="text-slate-400">Observation Window:</span>
                <span className="text-white font-bold">{horizon} minutes</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Replication Confidence:</span>
                <span className="text-purple-400 font-bold">{values.replications} runs (95% CI)</span>
              </div>
            </div>

            {/* Validation Banner if validated */}
            {validationResult && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-300 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Configuration Validated:</strong>
                  <span>{validationResult.message}</span>
                </div>
              </div>
            )}

            {/* Live Recommendation */}
            <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200 block mb-1">Architect Recommendation:</strong>
              {isSevereCongestion
                ? `Arrival rate (${(lambda * 60).toFixed(1)}/hr) exceeds aggregate counter capacity (${(totalCapacity * 60).toFixed(1)}/hr). Increase counters to at least ${Math.ceil(lambda / mu)} to stabilize.`
                : `System configuration is well-dimensioned. Ready for Monte Carlo stochastic execution across ${values.replications} replications.`}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
