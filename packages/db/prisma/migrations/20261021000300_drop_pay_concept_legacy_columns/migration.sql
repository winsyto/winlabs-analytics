-- =============================================================================
-- Los conceptos ya no llevan category ni sign: el tipo y la clase reemplazan a la categoría, y los importes se
-- usan con el signo con el que vienen del sistema de origen (wlA no recalcula la liquidación).
-- =============================================================================

ALTER TABLE "pay_concepts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "pay_concepts" DROP COLUMN "category";
ALTER TABLE "pay_concepts" DROP COLUMN "sign";
ALTER TABLE "pay_concepts" FORCE ROW LEVEL SECURITY;
