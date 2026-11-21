// Auth
export interface User {
  id: string
  email: string
  display_name: string
  status: string
}

export interface Workspace {
  id: string
  name: string
  role: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

// Scenario
export type DistributionType = 'fixed' | 'exponential' | 'normal' | 'uniform'
export type QueueDiscipline = 'FIFO'
export type ScenarioStatus = 'draft' | 'validated' | 'ready' | 'archived'

export interface ArrivalConfig {
  distribution: 'fixed' | 'exponential'
  mean_interarrival: number
}

export interface ServiceConfig {
  distribution: DistributionType
  mean?: number
  std_dev?: number
  min_time?: number
  max_time?: number
}

export interface ScenarioConfig {
  servers: number
  horizon_minutes: number
  warm_up_minutes: number
  replications: number
  seed: number
  queue_discipline: QueueDiscipline
  arrival: ArrivalConfig
  service: ServiceConfig
}

export interface Scenario {
  id: string
  workspace_id: string
  created_by: string
  name: string
  description: string
  service_type: string
  config: ScenarioConfig
  status: ScenarioStatus
  created_at: string
  updated_at: string
}

// Run
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Run {
  id: string
  workspace_id: string
  scenario_id: string
  status: RunStatus
  progress: number
  metrics?: RunMetrics
  error_summary?: string
  created_at: string
  completed_at?: string
}

export type RunListItem = Run

export interface RunMetrics {
  replications: number
  avg_waiting_time: number
  std_waiting_time: number
  ci_lower_waiting: number
  ci_upper_waiting: number
  median_waiting_time: number
  p90_waiting_time: number
  max_waiting_time: number
  avg_queue_length: number
  max_queue_length: number
  server_utilization: number
  throughput: number
  avg_system_time: number
  customers_arrived: number
  customers_served: number
  replication_summaries?: ReplicationSummary[]
}

export interface ReplicationSummary {
  replication_no: number
  seed: number
  avg_waiting_time: number
  median_waiting_time: number
  p90_waiting_time: number
  max_waiting_time: number
  avg_queue_length: number
  max_queue_length: number
  server_utilization: number
  throughput: number
  queue_length_series: Array<{ time: number; queue_length: number }>
  wait_histogram: Array<{ bucket: number; count: number }>
}

// Import
export type ImportStatus = 'pending' | 'validated' | 'failed'

export interface ImportRecord {
  id: string
  workspace_id: string
  scenario_id: string
  file_name: string
  row_count: number
  validation_summary: {
    total_rows: number
    valid_rows: number
    error_rows: number
    errors_list: Array<{ row: number; column: string; reason: string }>
  }
  status: ImportStatus
  created_at: string
}

// Report
export type ReportFormat = 'pdf' | 'csv'
export type ReportStatus = 'pending' | 'completed' | 'failed'

export interface Report {
  id: string
  run_id: string
  format: ReportFormat
  status: ReportStatus
  download_url?: string
  created_at: string
}

// Comparison
export interface ComparisonResult {
  run_id: string
  metrics: RunMetrics
  delta?: Partial<RunMetrics>
  pct_change?: Partial<RunMetrics>
}

export interface ComparisonResponse {
  side_by_side: ComparisonResult[]
  warnings: string[]
}

// Sensitivity
export interface SensitivityPoint {
  value: number
  avg_waiting_time: number
  server_utilization: number
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    skip: number
    limit: number
  }
}

// API error
export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
    request_id?: string
  }
}
