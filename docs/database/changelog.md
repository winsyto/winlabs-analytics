# Schema Changelog

| Fecha | Cambio | Migración |
|---|---|---|
| 2026-05-XX | Schema inicial M0: tenants, users, internal_users, roles, user_roles, audit_log | initial_migration |
| 2026-09-21 | M1 People/Time/Payroll: cfg_org_unit_types, cfg_termination_reasons, cfg_time_entry_types, hr_org_units, hr_people, hr_people_org_assignments, hr_people_history, cfg_absenteeism_types, att_time_daily, att_time_daily_entries, att_absenteeism_events, pay_periods, pay_concepts, pay_entries | add_m1_people_time_payroll |
| 2026-09-30 | M1-B Integraciones: int_templates, int_tenant_integrations, int_runs, int_run_errors | add_m1b_integrations |
| 2026-10-13 | Unidades organizativas con vigencia: hr_people_org_assignments (+org_unit_type_code, valid_from, valid_to; -is_primary; exclusión de solapamientos), catálogo de 15 tipos con sort_order, Contrato como unidad, nuevas cfg_tenant_org_unit_types y dsh_dimensions | add_org_unit_history_and_dimensions |
| 2026-10-13 | Renombra índice de vigencias de asignaciones (nombre > 63 bytes) | rename_org_assignments_validity_index |
| 2026-10-14 | Elimina hr_people.contract_type (el contrato es la unidad organizativa CONTRACT con vigencia) | drop_hr_people_contract_type |
