import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bento-card flex flex-col items-center justify-center py-16 px-6 text-center border-dashed border-[#24334A]">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#0D1422] border border-[#24334A] flex items-center justify-center mb-5 text-cyan-400 shadow-glow">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-100 mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary text-sm shadow-glow">
          {action.label}
        </button>
      )}
    </div>
  )
}
