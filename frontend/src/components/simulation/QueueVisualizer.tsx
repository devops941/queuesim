import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  FastForward,
  User,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

interface Customer {
  id: number
  state: 'arriving' | 'waiting' | 'serving' | 'completed'
  counterId?: number
  waitTime: number
  serviceTime: number
  totalTime: number
}

interface CounterState {
  id: number
  name: string
  busy: boolean
  currentCustomerId?: number
  currentCustomerProgress: number
  servedCount: number
}

interface QueueVisualizerProps {
  initialServers?: number
  meanInterarrival?: number
  meanService?: number
  isRealSimActive?: boolean
  simulationProgress?: number
  onComplete?: () => void
}

export function QueueVisualizer({
  initialServers = 3,
  meanInterarrival = 3,
  meanService = 6,
  isRealSimActive = false,
  simulationProgress,
}: QueueVisualizerProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState<number>(1) // 1x, 2x, 5x
  const [clock, setClock] = useState<number>(0) // in minutes
  const [arrivedTotal, setArrivedTotal] = useState<number>(18)
  const [servedTotal, setServedTotal] = useState<number>(14)
  const [queueList, setQueueList] = useState<Customer[]>([
    { id: 101, state: 'waiting', waitTime: 3.2, serviceTime: 5.0, totalTime: 0 },
    { id: 102, state: 'waiting', waitTime: 2.1, serviceTime: 4.8, totalTime: 0 },
    { id: 103, state: 'waiting', waitTime: 1.0, serviceTime: 6.2, totalTime: 0 },
    { id: 104, state: 'waiting', waitTime: 0.4, serviceTime: 5.5, totalTime: 0 },
  ])

  const [counters, setCounters] = useState<CounterState[]>([
    {
      id: 1,
      name: 'Counter #1',
      busy: true,
      currentCustomerId: 98,
      currentCustomerProgress: 65,
      servedCount: 5,
    },
    {
      id: 2,
      name: 'Counter #2',
      busy: true,
      currentCustomerId: 99,
      currentCustomerProgress: 40,
      servedCount: 5,
    },
    {
      id: 3,
      name: 'Counter #3',
      busy: true,
      currentCustomerId: 100,
      currentCustomerProgress: 85,
      servedCount: 4,
    },
  ])

  const [recentCompleted, setRecentCompleted] = useState<number[]>([95, 96, 97])

  // Simulation tick loop
  useEffect(() => {
    if (!isPlaying) return

    const tickInterval = 1000 / speed
    const timer = setInterval(() => {
      setClock((prev) => parseFloat((prev + 0.1 * speed).toFixed(1)))

      // Progress counter service
      setCounters((prevCounters) =>
        prevCounters.map((counter) => {
          if (!counter.busy) {
            // Check if queue has waiting customers
            return counter
          }

          const nextProgress = counter.currentCustomerProgress + 5 * speed
          if (nextProgress >= 100) {
            // Customer completed service!
            if (counter.currentCustomerId) {
              setRecentCompleted((prev) => [counter.currentCustomerId!, ...prev.slice(0, 4)])
              setServedTotal((s) => s + 1)
            }
            return {
              ...counter,
              busy: false,
              currentCustomerId: undefined,
              currentCustomerProgress: 0,
              servedCount: counter.servedCount + 1,
            }
          }

          return { ...counter, currentCustomerProgress: nextProgress }
        })
      )

      // Move next customer from queue to available counter
      setQueueList((prevQueue) => {
        if (prevQueue.length === 0) return prevQueue

        setCounters((prevCounters) => {
          const idleIndex = prevCounters.findIndex((c) => !c.busy)
          if (idleIndex !== -1 && prevQueue.length > 0) {
            const nextCustomer = prevQueue[0]
            const updated = [...prevCounters]
            updated[idleIndex] = {
              ...updated[idleIndex],
              busy: true,
              currentCustomerId: nextCustomer.id,
              currentCustomerProgress: 5,
            }
            return updated
          }
          return prevCounters
        })

        // Also probabilistically generate customer arrival
        if (Math.random() < 0.25 * speed) {
          const newId = 100 + Math.floor(Math.random() * 900)
          setArrivedTotal((a) => a + 1)
          return [
            ...prevQueue.slice(1),
            { id: newId, state: 'waiting', waitTime: 0, serviceTime: 5.5, totalTime: 0 },
          ]
        }

        return prevQueue
      })
    }, tickInterval)

    return () => clearInterval(timer)
  }, [isPlaying, speed])

  function handleReset() {
    setClock(0)
    setArrivedTotal(0)
    setServedTotal(0)
    setQueueList([
      { id: 201, state: 'waiting', waitTime: 0.5, serviceTime: 5.0, totalTime: 0 },
      { id: 202, state: 'waiting', waitTime: 0.1, serviceTime: 4.8, totalTime: 0 },
    ])
    setCounters([
      { id: 1, name: 'Counter #1', busy: false, currentCustomerProgress: 0, servedCount: 0 },
      { id: 2, name: 'Counter #2', busy: false, currentCustomerProgress: 0, servedCount: 0 },
      { id: 3, name: 'Counter #3', busy: false, currentCustomerProgress: 0, servedCount: 0 },
    ])
    setRecentCompleted([])
  }

  const activeCounters = counters.filter((c) => c.busy).length
  const utilization = Math.round((activeCounters / counters.length) * 100)

  return (
    <div className="bento-card relative overflow-hidden bg-gradient-to-b from-[#111B2B] to-[#0D1422] border-[#24334A] space-y-6">
      {/* Top Banner & Control Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24334A]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-glow-cyan" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Interactive Queue Simulation Engine
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
              Live Flow Model
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time entity progression across stochastic arrival, queue buffer, and service windows.
          </p>
        </div>

        {/* Visualizer Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`btn-primary px-3 py-1.5 text-xs font-semibold ${
              isPlaying ? 'bg-amber-600 border-amber-500/40' : 'bg-emerald-600 border-emerald-500/40'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={handleReset}
            className="btn-secondary px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
            title="Reset Simulation Model"
          >
            <RotateCcw size={14} />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center bg-[#162236] border border-[#24334A] rounded-xl p-0.5 text-xs font-mono">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  speed === s ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Flow Canvas: ARRIVAL → WAITING QUEUE → SERVICE COUNTERS → COMPLETED */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* 1. Arrival Stage (Span 2) */}
        <div className="md:col-span-2 p-4 rounded-xl bg-[#0D1422] border border-[#24334A] text-center space-y-2">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
            1. Arrival Stream
          </span>
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-cyan-400 shadow-glow">
            <User size={22} className="animate-bounce" />
          </div>
          <div className="font-mono text-xs text-slate-300">
            <span>λ: </span>
            <strong className="text-cyan-400">{(60 / meanInterarrival).toFixed(1)}/h</strong>
          </div>
          <span className="text-[10px] text-slate-400 block font-mono">
            Total In: {arrivedTotal}
          </span>
        </div>

        {/* Transition Arrow */}
        <div className="hidden md:flex justify-center text-slate-600">
          <ArrowRight size={16} />
        </div>

        {/* 2. Waiting Buffer Queue (Span 4) */}
        <div className="md:col-span-4 p-4 rounded-xl bg-[#0D1422] border border-[#24334A] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              2. Waiting Queue Buffer
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {queueList.length} in Line
            </span>
          </div>

          {/* Animated Queue Line */}
          <div className="flex items-center gap-2 min-h-[56px] overflow-x-auto p-2 bg-[#111B2B] border border-[#24334A] rounded-xl">
            {queueList.length > 0 ? (
              queueList.map((cust, idx) => (
                <div
                  key={cust.id}
                  className="flex flex-col items-center flex-shrink-0 animate-fadeIn"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs font-mono font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 mt-1">#{cust.id}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic mx-auto">Queue is empty</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Discipline: FIFO</span>
            <span>Avg Wait: ~3.2m</span>
          </div>
        </div>

        {/* Transition Arrow */}
        <div className="hidden md:flex justify-center text-slate-600">
          <ArrowRight size={16} />
        </div>

        {/* 3. Service Counters (Span 3) */}
        <div className="md:col-span-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              3. Service Counters
            </span>
            <span className="text-[10px] font-mono text-teal-400 font-bold">
              {activeCounters}/{counters.length} Busy
            </span>
          </div>

          <div className="space-y-2">
            {counters.map((c) => (
              <div
                key={c.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  c.busy
                    ? 'bg-[#162236] border-cyan-500/30 text-white'
                    : 'bg-[#0D1422] border-[#24334A] text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        c.busy ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="font-semibold">{c.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {c.busy ? `Serving #${c.currentCustomerId}` : 'IDLE'}
                  </span>
                </div>

                {/* Progress bar inside active counter */}
                {c.busy && (
                  <div className="w-full bg-[#0D1422] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${c.currentCustomerProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Completed Stream (Span 1) */}
        <div className="md:col-span-1 p-3 rounded-xl bg-[#0D1422] border border-[#24334A] text-center space-y-2">
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            4. Done
          </span>
          <div className="w-9 h-9 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
          <strong className="text-xs font-mono text-emerald-400 block">{servedTotal}</strong>
        </div>
      </div>

      {/* Live Operational Metrics Footer */}
      <div className="pt-4 border-t border-[#24334A] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Sim Time</span>
          <strong className="text-white text-sm">{clock} min</strong>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Queue Length</span>
          <strong className="text-amber-400 text-sm">{queueList.length}</strong>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Arrived</span>
          <strong className="text-cyan-400 text-sm">{arrivedTotal}</strong>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Completed</span>
          <strong className="text-emerald-400 text-sm">{servedTotal}</strong>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Counter Utilization</span>
          <strong className="text-teal-400 text-sm">{utilization}%</strong>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0D1422] border border-[#24334A]">
          <span className="text-[10px] text-slate-400 block">Engine State</span>
          <strong className="text-purple-400 text-sm">Synchronized</strong>
        </div>
      </div>
    </div>
  )
}
