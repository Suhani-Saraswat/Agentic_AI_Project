export interface ColumnSummaryStats {
  mean?: number | null;
  std?: number | null;
  min?: number | string | null;
  max?: number | string | null;
  median?: number | null;
  q25?: number | null;
  q75?: number | null;
  top_values?: Record<string, number> | null;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  non_null_count: number;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  sample_values: any[];
  summary_stats?: ColumnSummaryStats | null;
}

export interface DatasetProfile {
  dataset_id: string;
  filename: string;
  file_type: string;
  row_count: number;
  column_count: number;
  memory_usage_kb: number;
  columns: ColumnProfile[];
  preview_rows: Record<string, any>[];
  created_at?: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  profile: DatasetProfile;
}

export interface ExecutionResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_seconds: number;
  has_plot: boolean;
  plot_spec?: Record<string, any> | null;
  generated_files?: string[];
  error_message?: string | null;
}

export interface AnalysisReport {
  session_id: string;
  dataset_id: string;
  query: string;
  plan: string[];
  generated_code: string;
  code_history: string[];
  execution_result?: ExecutionResult | null;
  plot_spec?: Record<string, any> | null;
  executive_summary: string;
  key_insights: string[];
  retries_taken: number;
  total_time_seconds: number;
}

export interface WebSocketMessage {
  type: 'status' | 'plan' | 'code' | 'log' | 'retry' | 'plot' | 'report' | 'error';
  step: 'init' | 'planner' | 'codegen' | 'executor' | 'self_correction' | 'synthesizer' | 'done';
  message: string;
  payload?: any;
  timestamp: string;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  step: string;
  type: string;
  message: string;
  details?: any;
}
