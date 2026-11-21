import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  accentColor?: 'blue' | 'cyan' | 'teal' | 'purple' | 'amber' | 'green' | 'rose'
  sparklineData?: number[]
}

const ACCENT_STYLES = {
  blue: {
    border: 'hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    glow: 'from-blue-500/10',
    bar: 'bg-blue-500',
  },
  cyan: {
    border: 'hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    glow: 'from-cyan-500/10',
    bar: 'bg-cyan-400',
  },
  teal: {
    border: 'hover:border-teal-500/40',
    iconBg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    glow: 'from-teal-500/10',
    bar: 'bg-teal-400',
  },
  purple: {
    border: 'hover:border-purple-500/40',
    iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    glow: 'from-purple-500/10',
    bar: 'bg-purple-400',
  },
  amber: {
    border: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    glow: 'from-amber-500/10',
    bar: 'bg-amber-400',
  },
  green: {
    border: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    glow: 'from-emerald-500/10',
    bar: 'bg-emerald-400',
  },
  rose: {
    border: 'hover:border-rose-500/40',
    iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    glow: 'from-rose-500/10',
    bar: 'bg-rose-400',
  },
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  trend,
  trendValue,
  accentColor = 'blue',
  sparklineData,
}: KpiCardProps) {
  const styles = ACCENT_STYLES[accentColor] || ACCENT_STYLES.blue

  return (
    <div
      className={`bento-card relative overflow-hidden group flex flex-col justify-between p-5 ${styles.border}`}
    >
      {/* Subtle top corner gradient glow */}
      <div
        className={`absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-br ${styles.glow} to-transparent blur-2xl pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity`}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {label}
          </span>
          {icon && (
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${styles.iconBg} transition-transform group-hover:scale-105`}
            >
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#24334A]/60 flex items-center justify-between">
        {sub ? (
          <p className="text-xs text-slate-400 line-clamp-1">{sub}</p>
        ) : (
          <span className="text-xs text-slate-500">Realtime telemetry</span>
        )}

        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded ${
              trend === 'up'
                ? 'text-emerald-400 bg-emerald-500/10'
                : trend === 'down'
                ? 'text-rose-400 bg-rose-500/10'
                : 'text-slate-400 bg-slate-800'
            }`}
          >
            {trend === 'up' && <TrendingUp size={12} />}
            {trend === 'down' && <TrendingDown size={12} />}
            {trend === 'neutral' && <Minus size={12} />}
            {trendValue}
          </span>
        )}

        {/* Optional mini sparkline bars if provided */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="flex items-end gap-0.5 h-4">
            {sparklineData.slice(-6).map((val, idx) => (
              <div
                key={idx}
                className={`w-1 rounded-sm opacity-70 group-hover:opacity-100 transition-all ${styles.bar}`}
                style={{ height: `${Math.max(15, Math.min(100, val))}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
