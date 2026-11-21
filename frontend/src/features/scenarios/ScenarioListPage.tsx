import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Play,
  Archive,
  Trash2,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Cpu,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'
import { scenarioService } from '@/services/scenario.service'
import { runService } from '@/services/run.service'
import { StatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_OPTIONS = ['all', 'draft', 'validated', 'ready', 'archived']
const PAGE_SIZE = 9

export default function ScenarioListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId)

  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const skip = page * PAGE_SIZE

  const { data, isLoading, error } = useQuery({
    queryKey: ['scenarios', workspaceId, statusFilter, page],
    queryFn: () =>
      scenarioService.list(
        workspaceId!,
        skip,
        PAGE_SIZE,
        statusFilter !== 'all' ? statusFilter : undefined
      ),
    enabled: !!workspaceId,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => scenarioService.archive(id, workspaceId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scenarioService.delete(id, workspaceId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      scenarioService.duplicate(id, workspaceId!, `${name} (copy)`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  async function handleRun(scenarioId: string) {
    if (!workspaceId) return
    const run = await runService.createRun(workspaceId, scenarioId)
    navigate(`/runs/${run.id}`)
  }

  const filtered =
    data?.data?.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
    ) ?? []

  const total = data?.meta?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (isLoading) return <PageLoader message="LOADING SIMULATION SCENARIOS..." />

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Operational Scenarios
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Simulation Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create, manage, and test parameterized service counter and queue environments.
          </p>
        </div>

        <button
          onClick={() => navigate('/scenarios/new')}
          className="btn-primary shadow-glow text-xs font-bold"
        >
          <Plus size={16} /> New Scenario
        </button>
      </div>

      {/* Filter and Search Ribbon */}
      <div className="bento-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status filters */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0D1422] border border-[#24334A] rounded-xl overflow-x-auto w-full sm:w-auto text-xs font-mono">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status)
                setPage(0)
              }}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scenarios by name..."
            className="input-field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Scenario Bento Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={32} />}
          title="No scenarios found"
          description="Create your first queue simulation scenario or adjust your search filter."
          action={{
            label: 'Create New Scenario',
            onClick: () => navigate('/scenarios/new'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bento-card relative group flex flex-col justify-between hover:border-blue-500/40 transition-all cursor-pointer"
              onClick={() => navigate(`/scenarios/${s.id}`)}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-base truncate group-hover:text-cyan-400 transition-colors">
                      {s.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mt-0.5">
                      {s.service_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={s.status} />

                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                        className="btn-ghost p-1.5 text-slate-400 hover:text-white"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openMenuId === s.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-8 z-30 w-44 bg-[#162236] rounded-xl shadow-2xl border border-[#2E4160] py-1 text-xs font-mono">
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                navigate(`/scenarios/${s.id}/edit`)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-slate-300 hover:text-white hover:bg-[#1E2D47] text-left"
                            >
                              <Edit size={13} /> Edit Scenario
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                duplicateMutation.mutate({ id: s.id, name: s.name })
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-slate-300 hover:text-white hover:bg-[#1E2D47] text-left"
                            >
                              <Copy size={13} /> Duplicate
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                handleRun(s.id)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-cyan-400 hover:bg-[#1E2D47] text-left font-bold"
                            >
                              <Play size={13} /> Execute Run
                            </button>
                            <hr className="my-1 border-[#24334A]" />
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                deleteMutation.mutate(s.id)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-rose-400 hover:bg-rose-950/40 text-left"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                  {s.description || 'No description provided for this operational setup.'}
                </p>

                {/* Parameters specs summary */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A] text-center font-mono text-[11px] mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Counters</span>
                    <strong className="text-white">{s.config?.servers ?? 1}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Horizon</span>
                    <strong className="text-cyan-400">{s.config?.horizon_minutes ?? 480}m</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Runs</span>
                    <strong className="text-purple-400">{s.config?.replications ?? 10}</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div
                className="pt-3 border-t border-[#24334A] flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(s.updated_at).toLocaleDateString()}
                </span>

                <button
                  onClick={() => handleRun(s.id)}
                  className="btn-primary text-xs py-1.5 px-3 font-semibold shadow-glow"
                >
                  <Play size={13} /> Run Simulation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#24334A] text-xs font-mono">
          <span className="text-slate-400">
            Showing Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong> ({total} total)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1 px-3 text-xs"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary py-1 px-3 text-xs"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
