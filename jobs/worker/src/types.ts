export interface JobRow {
  id: number;
  tenant_id: string;
  integration_id: number | null;
  job_type: string;
  status: string;
  priority: number;
  run_key: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  scheduled_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date | null;
  locked_at: Date | null;
  locked_by: string | null;
  heartbeat_at: Date | null;
  progress_current: number;
  progress_total: number;
  progress_message: string | null;
  last_error: string | null;
  last_error_code: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IntegrationRow {
  id: number;
  tenant_id: string;
  integration_template_code: string;
  name: string;
  status: string;
  schedule_cron: string | null;
  last_run_at: Date | null;
}

export type JobHandler = (job: JobRow) => Promise<void>;
