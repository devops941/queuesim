interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
}

export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div
          className={`${SIZE_CLASSES[size]} rounded-full border-blue-500/20 border-t-cyan-400 animate-spin`}
        />
        <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-md pointer-events-none" />
      </div>
      {message && (
        <p className="text-xs uppercase tracking-widest font-mono text-slate-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}

export function PageLoader({ message = 'INITIALIZING SIMULATION ENGINE...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] w-full bg-[#080D18]/50 rounded-2xl border border-[#24334A]/50">
      <LoadingSpinner message={message} size="lg" />
    </div>
  )
}
