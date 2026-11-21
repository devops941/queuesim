interface BadgeProps {
  status: string
  className?: string
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    bg: 'bg-slate-800/60',
    text: 'text-slate-300',
    border: 'border-slate-700/60',
    dot: 'bg-slate-400',
  },
  ready: {
    label: 'Ready',
    bg: 'bg-cyan-950/40',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  validated: {
    label: 'Validated',
    bg: 'bg-blue-950/40',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  queued: {
    label: 'Queued',
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  running: {
    label: 'Running',
    bg: 'bg-blue-950/50',
    text: 'text-blue-300',
    border: 'border-blue-400/40',
    dot: 'bg-blue-400 animate-ping',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    bg: 'bg-rose-950/40',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-900/60',
    text: 'text-slate-400',
    border: 'border-slate-800',
    dot: 'bg-slate-500',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-slate-900/60',
    text: 'text-slate-500',
    border: 'border-slate-800',
    dot: 'bg-slate-600',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
}

export function StatusBadge({ status, className = '' }: BadgeProps) {
  const key = status?.toLowerCase() ?? 'draft'
  const config = STATUS_CONFIG[key] ?? STATUS_CONFIG['draft']

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
