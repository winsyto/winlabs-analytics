"use server";

import { auth } from "@/auth";
import { z } from "zod";
import { loadJobHistory, loadJobSummary, type HistoryFilter, type JobHistoryPage } from "../_data/queries";
import type { JobSummary } from "../_data/job-result";

const HISTORY_PAGE_SIZE = 12;

const historySchema = z.object({
  integrationId: z.number().int().positive(),
  page: z.number().int().min(1).max(100),
  filter: z.enum(["all", "ok", "errors", "failed"]),
});

/** Una página del historial de cargas de una integración del tenant */
export async function getJobHistoryAction(input: {
  integrationId: number;
  page: number;
  filter: HistoryFilter;
}): Promise<JobHistoryPage | null> {
  const session = await auth();
  if (!session) return null;
  const parsed = historySchema.safeParse(input);
  if (!parsed.success) return null;
  const { integrationId, page, filter } = parsed.data;
  return loadJobHistory(session.user.tenantId, integrationId, { page, pageSize: HISTORY_PAGE_SIZE, filter });
}

/** Estado actual de una carga del tenant, para el seguimiento después de subir el archivo */
export async function getJobSummaryAction(jobId: number): Promise<JobSummary | null> {
  const session = await auth();
  if (!session) return null;
  if (!Number.isInteger(jobId) || jobId <= 0) return null;
  return loadJobSummary(session.user.tenantId, jobId);
}
