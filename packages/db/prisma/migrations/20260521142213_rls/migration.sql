-- =============================================================================
-- RLS (Row Level Security) — aislamiento por tenant
-- Decisión D-076: RLS desde el día uno, no agregar después
-- =============================================================================

-- Habilitar RLS en las tablas de datos de tenant
ALTER TABLE "users"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"  ENABLE ROW LEVEL SECURITY;

-- FORCE RLS: aplica incluso al owner de la tabla (wla_dev en local)
ALTER TABLE "users"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "roles"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"  FORCE ROW LEVEL SECURITY;

-- tenants e internal_users NO tienen RLS:
-- solo se acceden desde el CMP con service role / SECURITY DEFINER

-- =============================================================================
-- POLICIES — filtrar por tenant_id del contexto de sesión
-- La app setea: SET LOCAL app.current_tenant_id = '<uuid>'
-- antes de cualquier query de datos
-- =============================================================================

CREATE POLICY tenant_isolation ON "users"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY tenant_isolation ON "roles"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY tenant_isolation ON "user_roles"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY tenant_isolation ON "audit_log"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );
