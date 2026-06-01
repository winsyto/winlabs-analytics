# SKILL: ADD_INTEGRATION

**Trigger:** cuando se deba crear un nuevo conector/template de integración.

**Referencia completa:** `proyecto/06-integraciones.md` y `proyecto/iniciativa/estrategia_workers_jobs_integraciones.md`.

---

## Contexto

Las integraciones corren en el worker VPS (no en Vercel). La arquitectura es:
- `int_templates` → catálogo global de tipos de integración
- `int_tenant_integrations` → configuración de una integración por tenant
- `int_runs` → historial de ejecuciones
- Worker: scheduler loop + processor loop con `FOR UPDATE SKIP LOCKED`

## Pasos (a detallar cuando se implemente M1-B)

Este skill se completa durante M1 cuando se construya el framework de integraciones.
Por ahora, referirse a `proyecto/06-integraciones.md` para diseño y
`proyecto/iniciativa/estrategia_workers_jobs_integraciones.md` para la arquitectura del worker.

## Checklist (placeholder)

- [ ] Definir template en `int_templates` (seed)
- [ ] Implementar handler en `jobs/worker/src/handlers/<template>.ts`
- [ ] Tests de la lógica de transformación
- [ ] UI en CMP para activar la integración por tenant
- [ ] UI en Cliente para ver historial de runs
