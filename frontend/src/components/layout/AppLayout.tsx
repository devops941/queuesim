import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  FlaskConical,
  GitCompare,
  History,
  Sliders,
  TrendingDown,
  Layers,
  Settings2,
  LineChart,
  Network,
  Cpu,
  FileText,
  Shield,
  HelpCircle,
  LogOut,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '@/app/store/auth.store'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'SIMULATION',
    items: [
      { to: '/scenarios/new', label: 'New Simulation', icon: PlusCircle, badge: 'PRO' },
      { to: '/scenarios', label: 'Simulation Workspace', icon: FlaskConical },
      { to: '/compare', label: 'Scenario Comparison', icon: GitCompare },
      { to: '/history', label: 'Simulation History', icon: History },
    ],
  },
  {
    title: 'CONFIGURATION',
    items: [
      { to: '/config/system', label: 'System Parameters', icon: Sliders },
      { to: '/config/arrival', label: 'Arrival Distribution', icon: TrendingDown },
      { to: '/config/service', label: 'Service Distribution', icon: Layers },
      { to: '/config/counters', label: 'Counter Config', icon: Settings2 },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { to: '/analytics', label: 'Performance Analytics', icon: LineChart },
      { to: '/analytics/queue', label: 'Queue Analysis', icon: Network },
      { to: '/analytics/utilization', label: 'Utilization Analysis', icon: Cpu },
      { to: '/reports', label: 'Reports & Exports', icon: FileText },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/admin', label: 'Settings', icon: Shield },
      { to: '/docs', label: 'Help & Docs', icon: HelpCircle },
    ],
  },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeWorkspaceId = useAuthStore((s) => s.activeWorkspaceId)
  const logout = useAuthStore((s) => s.logout)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Determine current page title and breadcrumbs
  const getBreadcrumb = () => {
    const path = location.pathname
    if (path.includes('/dashboard')) return { section: 'Overview', title: 'Intelligence Dashboard' }
    if (path.includes('/scenarios/new')) return { section: 'Simulation', title: 'New Simulation Workspace' }
    if (path.includes('/scenarios/') && path.includes('/edit')) return { section: 'Simulation', title: 'Edit Scenario' }
    if (path.includes('/scenarios/')) return { section: 'Simulation', title: 'Scenario Detail' }
    if (path.includes('/scenarios')) return { section: 'Simulation', title: 'Simulation Workspace' }
    if (path.includes('/compare')) return { section: 'Simulation', title: 'Scenario Comparison & Sensitivity' }
    if (path.includes('/history')) return { section: 'Simulation', title: 'Simulation History' }
    if (path.includes('/runs/') && path.includes('/results')) return { section: 'Analytics', title: 'Simulation Results' }
    if (path.includes('/runs/')) return { section: 'Simulation', title: 'Real-time Run Monitor' }
    if (path.includes('/analytics/queue')) return { section: 'Analytics', title: 'Queue Dynamics Analysis' }
    if (path.includes('/analytics/utilization')) return { section: 'Analytics', title: 'Counter Utilization Insights' }
    if (path.includes('/analytics')) return { section: 'Analytics', title: 'Performance Analytics Hub' }
    if (path.includes('/config/system')) return { section: 'Configuration', title: 'System Parameters' }
    if (path.includes('/config/arrival')) return { section: 'Configuration', title: 'Arrival Distribution Modeling' }
    if (path.includes('/config/service')) return { section: 'Configuration', title: 'Service Distribution Engine' }
    if (path.includes('/config/counters')) return { section: 'Configuration', title: 'Counter Network Architecture' }
    if (path.includes('/reports')) return { section: 'Analytics', title: 'Report Generation & Data Exports' }
    if (path.includes('/admin')) return { section: 'System', title: 'Workspace Settings & Access' }
    if (path.includes('/docs')) return { section: 'System', title: 'Operations Research & Documentation' }
    return { section: 'Engine', title: 'Queue Intelligence' }
  }

  const breadcrumb = getBreadcrumb()

  const notifications = [
    {
      id: 1,
      title: 'Simulation Completed',
      desc: 'Bank Counter Peak Hours finished 20 replications.',
      time: '5m ago',
      unread: true,
    },
    {
      id: 2,
      title: 'Optimal Counter Match',
      desc: 'Sensitivity test suggests 3 counters for < 2.5m wait.',
      time: '1h ago',
      unread: false,
    },
  ]

  const isItemActive = (to: string) => {
    const cur = location.pathname
    if (to === '/dashboard') return cur === '/dashboard' || cur === '/'
    if (to === '/scenarios/new') return cur === '/scenarios/new'
    if (to === '/scenarios') {
      return (cur === '/scenarios' || cur.startsWith('/scenarios/')) && cur !== '/scenarios/new'
    }
    if (to === '/compare') return cur === '/compare'
    if (to === '/history') return cur === '/history'
    if (to === '/analytics') return cur === '/analytics'
    if (to === '/analytics/queue') return cur === '/analytics/queue'
    if (to === '/analytics/utilization') return cur === '/analytics/utilization'
    if (to === '/reports') return cur === '/reports'
    if (to.startsWith('/config/')) return cur === to
    if (to === '/admin') return cur === '/admin'
    if (to === '/docs') return cur === '/docs'
    return cur === to
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div
        className={`flex items-center gap-3 px-5 py-4 border-b border-[#24334A] transition-all ${
          collapsed ? 'justify-center px-2' : ''
        }`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-400 p-[1px] shadow-glow">
            <div className="w-full h-full bg-[#0D1422] rounded-[11px] flex items-center justify-center">
              <Sparkles size={18} className="text-cyan-400 animate-pulse-slow" />
            </div>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0A101C]" />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-white tracking-tight">QueueSim</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20 font-semibold">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase truncate">
              Simulation Intelligence
            </p>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed && (
              <p className="px-3 text-[10px] font-mono font-bold text-slate-400/90 uppercase tracking-wider pt-2 pb-1">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isItemActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-150 border ${
                      active
                        ? 'bg-[#162236] text-cyan-400 border-cyan-500/40 shadow-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-[#111B2B] border-transparent font-medium'
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-cyan-400 shadow-glow-cyan" />
                    )}
                    <Icon
                      size={16}
                      className={`flex-shrink-0 transition-colors ${
                        active
                          ? 'text-cyan-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1 tracking-normal leading-none">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse Toggle (Desktop only) */}
      <div className="hidden lg:flex items-center justify-between px-3 py-2 border-t border-[#24334A]/70 text-slate-400 bg-[#080D18]/30">
        {!collapsed && (
          <span className="text-[11px] text-slate-400 font-mono px-2">Collapse Panel</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-[#162236] hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* User profile footer */}
      <div className="p-3 border-t border-[#24334A] bg-[#0A101C]">
        <div
          className={`flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#111B2B] border border-[#24334A]/40 transition-colors cursor-pointer ${
            collapsed ? 'justify-center p-1.5' : ''
          }`}
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0 font-bold text-xs">
            {user?.display_name ? user.display_name.charAt(0).toUpperCase() : 'A'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
                  {user?.display_name ?? 'Admin'}
                </p>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Active"></span>
              </div>
              <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                {user?.email ?? 'admin@gmail.com'}
              </p>
            </div>
          )}
        </div>

        {/* User quick popout */}
        {showUserMenu && !collapsed && (
          <div className="mt-2 p-1.5 bg-[#111B2B] border border-[#24334A] rounded-xl shadow-xl space-y-1">
            <button
              onClick={() => {
                setShowUserMenu(false)
                navigate('/admin')
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#162236] rounded-lg text-left"
            >
              <Shield size={13} className="text-blue-400" /> Workspace Settings
            </button>
            <button
              onClick={() => {
                setShowUserMenu(false)
                handleLogout()
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg text-left"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen w-screen bg-[#080D18] text-slate-100 overflow-hidden font-sans">
      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0A101C] border-r border-[#24334A] flex-shrink-0 transition-all duration-300 z-30 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#0A101C] border-r border-[#24334A] shadow-2xl transition-transform duration-300 ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#162236]"
          >
            <X size={18} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-[#0D1422]/90 backdrop-blur border-b border-[#24334A] px-4 lg:px-8 flex items-center justify-between gap-4 flex-shrink-0 z-20">
          {/* Left section: Hamburger & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#162236] border border-[#24334A]"
            >
              <Menu size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>{breadcrumb.section}</span>
                <span>/</span>
                <span className="text-cyan-400 font-semibold">{breadcrumb.title}</span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight hidden sm:block truncate">
                {breadcrumb.title}
              </h2>
            </div>
          </div>

          {/* Right section: Global Search, Engine Status, Notifications, Help */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search Bar */}
            <div className="relative hidden md:block w-52 lg:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/scenarios?q=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                placeholder="Search scenarios or runs..."
                className="w-full bg-[#111B2B] border border-[#24334A] rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1 rounded bg-[#162236] text-slate-400 border border-[#24334A]">
                Ctrl K
              </span>
            </div>

            {/* Active Simulation Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#111B2B] border border-[#24334A] text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-glow-success" />
              <span className="text-slate-300 font-mono text-[11px]">Engine: Ready</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#162236] border border-[#24334A] transition-colors"
                title="Notifications"
              >
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-[#111B2B] border border-[#24334A] rounded-2xl shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-[#24334A] mb-3">
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      System Notifications
                    </span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      2 Unread
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border transition-colors ${
                          n.unread
                            ? 'bg-[#162236] border-blue-500/30 text-slate-200'
                            : 'bg-[#0D1422] border-[#24334A] text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-white flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Help Quick Link */}
            <button
              onClick={() => navigate('/docs')}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#162236] border border-[#24334A] transition-colors"
              title="Documentation & Theory"
            >
              <HelpCircle size={16} />
            </button>

            {/* Workspace pill */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#24334A]">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-medium">
                {activeWorkspace?.name ?? 'Admin Simulation Workspace'}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Main Viewport */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-7 py-6 relative bg-grid-pattern">
          {/* Subtle Ambient Light Glows */}
          <div className="ambient-glow bg-blue-600 top-10 left-1/4" />
          <div className="ambient-glow bg-cyan-500 bottom-10 right-1/4" />

          <div className="relative z-10 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
