-- =============================================================================
-- Índice por concepto y proceso. El dashboard de Payroll lee la masa bruta y el neto (uno o dos conceptos de cada
-- proceso): con este índice lee solo esas filas y no todas las del proceso. Reemplaza al índice de concept_id solo
-- (la clave foránea sigue cubierta: concept_id es la primera columna).
-- =============================================================================

CREATE INDEX "pay_entries_concept_id_process_id_idx" ON "pay_entries"("concept_id", "process_id");
DROP INDEX "pay_entries_concept_id_idx";
