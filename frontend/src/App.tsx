import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth.store'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import DashboardPage from '@/features/analytics/DashboardPage'
import ScenarioListPage from '@/features/scenarios/ScenarioListPage'
import ScenarioBuilderPage from '@/features/scenarios/ScenarioBuilderPage'
import ScenarioDetailPage from '@/features/scenarios/ScenarioDetailPage'
import DataImportPage from '@/features/imports/DataImportPage'
import RunMonitorPage from '@/features/runs/RunMonitorPage'
import ResultsDashboardPage from '@/features/runs/ResultsDashboardPage'
import SimulationHistoryPage from '@/features/runs/SimulationHistoryPage'
import ComparePage from '@/features/analytics/ComparePage'
import QueueAnalysisPage from '@/features/analytics/QueueAnalysisPage'
import UtilizationAnalysisPage from '@/features/analytics/UtilizationAnalysisPage'
import ReportsPage from '@/features/reports/ReportsPage'
import AdminPage from '@/features/admin/AdminPage'
import SystemParametersPage from '@/features/config/SystemParametersPage'
import ArrivalDistributionPage from '@/features/config/ArrivalDistributionPage'
import ServiceDistributionPage from '@/features/config/ServiceDistributionPage'
import CounterConfigPage from '@/features/config/CounterConfigPage'
import DocumentationPage from '@/features/docs/DocumentationPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Application Workspace */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Overview */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Simulation */}
          <Route path="scenarios" element={<ScenarioListPage />} />
          <Route path="scenarios/new" element={<ScenarioBuilderPage />} />
          <Route path="scenarios/:id" element={<ScenarioDetailPage />} />
          <Route path="scenarios/:id/edit" element={<ScenarioBuilderPage />} />
          <Route path="scenarios/:id/import" element={<DataImportPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="history" element={<SimulationHistoryPage />} />

          {/* Realtime Monitoring & Analytics */}
          <Route path="runs/:runId" element={<RunMonitorPage />} />
          <Route path="runs/:runId/results" element={<ResultsDashboardPage />} />
          <Route path="analytics" element={<DashboardPage />} />
          <Route path="analytics/queue" element={<QueueAnalysisPage />} />
          <Route path="analytics/utilization" element={<UtilizationAnalysisPage />} />

          {/* Configuration Management */}
          <Route path="config/system" element={<SystemParametersPage />} />
          <Route path="config/arrival" element={<ArrivalDistributionPage />} />
          <Route path="config/service" element={<ServiceDistributionPage />} />
          <Route path="config/counters" element={<CounterConfigPage />} />

          {/* Reports & System */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="docs" element={<DocumentationPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
