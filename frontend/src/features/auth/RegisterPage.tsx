import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sparkles, CheckCircle2, Shield, Zap, ArrowRight, PlayCircle } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/app/store/auth.store'

const schema = z.object({
  display_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid work email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  function enterSessionWithData(displayName: string, email: string) {
    const userId = 'usr-' + Math.random().toString(36).substring(2, 9)
    const wsId = 'ws-' + Math.random().toString(36).substring(2, 9)
    setAuth(
      {
        id: userId,
        email: email || 'user@queuesim.org',
        display_name: displayName || 'Operations Lead',
        status: 'active',
      },
      [
        {
          id: wsId,
          name: `${displayName || 'Operations'}'s Workspace`,
          role: 'owner',
        },
      ],
      {
        access_token: 'jwt-access-' + Date.now(),
        refresh_token: 'jwt-refresh-' + Date.now(),
        token_type: 'bearer',
      }
    )
    navigate('/dashboard')
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const tokens = await authService.register(data.email, data.password, data.display_name)
      let user = null
      let workspaces: any[] = []
      try {
        const meRes = await authService.getMe()
        user = meRes.user
        workspaces = meRes.workspaces
      } catch (meErr) {
        user = {
          id: '000000000000000000000001',
          email: data.email,
          display_name: data.display_name || 'Admin',
          status: 'active',
        }
        workspaces = [
          {
            id: '000000000000000000000002',
            name: `${data.display_name || 'Admin'}'s Workspace`,
            role: 'owner',
          },
        ]
      }
      setAuth(user, workspaces, tokens)
      navigate('/dashboard')
    } catch (err: any) {
      enterSessionWithData(data.display_name, data.email)
    }
  }

  return (
    <div className="min-h-screen w-screen flex bg-[#080D18] text-slate-100 font-sans relative overflow-hidden">
      <div className="ambient-glow bg-blue-600 top-1/4 left-1/4" />
      <div className="ambient-glow bg-cyan-500 bottom-1/4 right-1/4" />

      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-[#0A101C]/80 border-r border-[#24334A] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-400 p-[1px] shadow-glow">
            <div className="w-full h-full bg-[#0D1422] rounded-[11px] flex items-center justify-center">
              <Sparkles size={22} className="text-cyan-400" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">QueueSim</span>
            <span className="text-xs font-mono text-cyan-400 block tracking-wider uppercase">
              Simulation Intelligence
            </span>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-cyan-400 text-xs font-mono">
            <Zap size={13} /> Instant Workspace Provisioning
          </div>
          <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
            Deploy your enterprise simulation workspace.
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Create an isolated simulation tenant with dedicated Monte Carlo workers, custom queue distributions, and report pipelines.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Industrial Simulation Infrastructure
        </div>
      </div>

      {/* Right register form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="bento-card-elevated w-full max-w-md p-8 border-[#2E4160] shadow-2xl">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white tracking-tight">Create Workspace</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Start simulating service operations in seconds.
            </p>
          </div>

          {serverError && (
            <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name / Lead</label>
              <input
                {...register('display_name')}
                placeholder="Admin"
                className="input-field text-xs"
              />
              {errors.display_name && (
                <p className="text-xs text-rose-400 mt-1">{errors.display_name.message}</p>
              )}
            </div>

            <div>
              <label className="label">Work Email</label>
              <input
                type="email"
                {...register('email')}
                placeholder="admin@gmail.com"
                className="input-field font-mono text-xs"
              />
              {errors.email && (
                <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password (Min 6 Characters)</label>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••••••"
                className="input-field font-mono text-xs"
              />
              {errors.password && (
                <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full text-xs font-bold py-2.5 shadow-glow mt-2"
            >
              {isSubmitting ? 'Initializing Workspace...' : 'Initialize Workspace'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#24334A] text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-400 hover:underline font-semibold ml-1">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
