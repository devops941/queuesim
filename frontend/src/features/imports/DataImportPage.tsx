import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  X,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import apiClient from '@/services/api'
import type { ImportRecord } from '@/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const SAMPLE_CSV = `arrival_timestamp,service_duration
0.8,3.2
2.4,5.1
4.1,2.7
6.0,4.5
7.5,3.8
9.2,6.1
11.0,2.9
12.8,4.2
14.5,5.0
16.2,3.5
`

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'queuesim_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataImportPage() {
  const { id: scenarioId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(selected: File) {
    if (selected.type !== 'text/csv' && !selected.name.endsWith('.csv')) {
      setError('Only .csv files are accepted.')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('File must be under 10 MB.')
      return
    }
    setError(null)
    setResult(null)
    setFile(selected)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }, [])

  async function handleUpload() {
    if (!file || !workspaceId || !scenarioId) return
    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('scenario_id', scenarioId)
    formData.append('workspace_id', workspaceId)

    try {
      const res = await apiClient.post('/imports', formData, {
        params: { workspace_id: workspaceId },
      })
      setResult(res.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Upload failed. Please try again.'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  const summary = result?.validation_summary
  const hasErrors = (summary?.error_rows ?? 0) > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <button
          onClick={() => navigate(`/scenarios/${scenarioId}`)}
          className="btn-ghost flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2 -ml-2"
        >
          <ArrowLeft size={14} /> Back to Scenario
        </button>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Trace Data Ingestion
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Upload empirical arrival and service timestamps to calibrate trace-driven queue simulations.
        </p>
      </div>

      <div className="bento-card space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#24334A]">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            CSV File Upload
          </span>
          <button
            onClick={downloadSampleCSV}
            className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-mono"
          >
            <Download size={13} /> Sample CSV Template
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-cyan-400 bg-cyan-950/20 shadow-glow-cyan'
              : file
              ? 'border-blue-500/50 bg-[#162236]/60'
              : 'border-[#24334A] hover:border-[#2E4160] bg-[#0D1422]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-[#111B2B] border border-[#24334A] text-cyan-400 mx-auto flex items-center justify-center mb-3">
            <Upload size={20} />
          </div>

          {file ? (
            <div>
              <p className="text-sm font-bold text-white font-mono">{file.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {(file.size / 1024).toFixed(1)} KB • Ready to ingest
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Click to browse or drop CSV file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Required columns: <code className="font-mono text-cyan-400">arrival_time</code>,{' '}
                <code className="font-mono text-cyan-400">service_time</code> (Max 10MB)
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setFile(null)
              setResult(null)
            }}
            className="btn-secondary flex-1 text-xs"
          >
            Clear
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary flex-1 text-xs font-bold shadow-glow"
          >
            {uploading ? 'Processing Dataset...' : 'Ingest & Validate Data'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bento-card-elevated space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Ingestion Validation Summary
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center font-mono text-xs">
            <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
              <span className="text-[10px] text-slate-400 block">Total Rows</span>
              <strong className="text-white text-base">{summary?.total_rows ?? 0}</strong>
            </div>
            <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
              <span className="text-[10px] text-slate-400 block">Valid Rows</span>
              <strong className="text-emerald-400 text-base">{summary?.valid_rows ?? 0}</strong>
            </div>
            <div className="p-3 bg-[#0D1422] rounded-xl border border-[#24334A]">
              <span className="text-[10px] text-slate-400 block">Invalid Rows</span>
              <strong className="text-rose-400 text-base">{summary?.error_rows ?? 0}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
