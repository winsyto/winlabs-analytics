-- El nombre original superaba 63 bytes y Postgres lo truncó.
ALTER INDEX "hr_people_org_assignments_tenant_id_org_unit_type_code_valid_fr"
  RENAME TO "idx_hr_people_org_assignments_type_validity";
