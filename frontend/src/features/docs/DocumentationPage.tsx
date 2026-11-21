import { HelpCircle, BookOpen, Calculator, Layers, Zap, CheckCircle2 } from 'lucide-react'

export default function DocumentationPage() {
  return (
    <div className="space-y-6 pb-12 w-full">
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle size={15} className="text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
            Operations Research Manual
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Documentation & Queuing Theory Principles
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Mathematical reference formulas, Kendall's notation, and stochastic simulation rules.
        </p>
      </div>

      <div className="space-y-4">
        {/* Section 1: Kendall's Notation */}
        <div className="bento-card space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              1. Kendall's Notation: A / S / c / K / N / D
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            QueueSim classifies service counters according to standard Operations Research notation:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-2">
            <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <strong className="text-cyan-400 block mb-1">A = Arrival Model</strong>
              <span className="text-slate-400">M: Markovian (Exponential)</span>
              <span className="text-slate-400 block">D: Deterministic</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <strong className="text-purple-400 block mb-1">S = Service Model</strong>
              <span className="text-slate-400">M: Exponential</span>
              <span className="text-slate-400 block">G: General / Normal</span>
            </div>
            <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A]">
              <strong className="text-teal-400 block mb-1">c = Server Count</strong>
              <span className="text-slate-400">Number of parallel counters sharing 1 queue line</span>
            </div>
          </div>
        </div>

        {/* Section 2: Little's Law */}
        <div className="bento-card space-y-3">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              2. Fundamental Law of Queues: Little's Theorem
            </h3>
          </div>
          <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] font-mono text-center text-emerald-400 text-lg font-bold">
            L = λ · W &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp; Lq = λ · Wq
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The long-term average number of customers in a stationary queuing system (L) equals the long-term
            average effective arrival rate (λ) multiplied by the average time that a customer spends in the system (W).
          </p>
        </div>

        {/* Section 3: Traffic Intensity & Stability */}
        <div className="bento-card space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              3. Traffic Intensity & Stability Condition
            </h3>
          </div>
          <div className="p-3 rounded-xl bg-[#0D1422] border border-[#24334A] font-mono text-center text-amber-400 text-base font-bold">
            ρ = λ / (c · μ) &lt; 1.0
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            For any queuing system to attain steady-state equilibrium, the aggregate service rate (c · μ)
            must strictly exceed customer arrival velocity (λ). If ρ ≥ 1, the queue will explode to infinity over time.
          </p>
        </div>
      </div>
    </div>
  )
}
