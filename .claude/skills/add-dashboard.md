# SKILL: ADD_DASHBOARD

**Trigger:** cuando se deba agregar un dashboard de People Analytics.

**Referencia completa:** `proyecto/05-modelo-datos.md` §6 (métricas) y `proyecto/07-roadmap.md` M3.

---

## Dashboards del MVP (M3)

1. **Headcount / Cubo** — KPIs, drill-down por área/posición/location
2. **Ausentismos** — tasa, tipos, tendencia temporal, ranking por área
3. **Horas extras** — total, distribución, alertas de umbral
4. **Turnover / Rotación** — tasa, ingresos vs egresos, por área

## Pasos (a detallar cuando se implemente M3)

Este skill se completa durante M3 cuando se construyan los dashboards.
Los datos vienen de `hr_people`, `att_time_daily`, `att_absenteeism_events`, `pay_entries`.

## Estructura esperada

```
apps/cliente/app/(dashboard)/dashboards/
  layout.tsx              ← Filtros globales (período, área, location)
  headcount/
    page.tsx
    _components/
      headcount-kpis.tsx
      headcount-chart.tsx
  absenteeism/
    page.tsx
  overtime/
    page.tsx
  turnover/
    page.tsx
```

## Checklist (placeholder)

- [ ] Queries de métricas en `packages/db/queries/<dashboard>.ts`
- [ ] Filtros globales via Search Params
- [ ] KpiCard + DataPanel del design system
- [ ] Empty state cuando no hay datos cargados
- [ ] Exportación PDF básica
- [ ] Página de detalle con insights IA (M5)
