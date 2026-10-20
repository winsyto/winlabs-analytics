-- =============================================================================
-- Índice sobre la clave foránea att_time_daily_entries.time_daily_id.
-- Sin un índice que empiece por esa columna, borrar o actualizar filas de att_time_daily recorre toda la tabla
-- de horas por tipo por cada fila (minutos con cientos de miles de filas).
-- =============================================================================

CREATE INDEX "att_time_daily_entries_time_daily_id_idx" ON "att_time_daily_entries"("time_daily_id");
