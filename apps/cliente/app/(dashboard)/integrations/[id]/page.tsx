import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { withTenantContext } from "@wla/auth";
import { PageHeader } from "@wla/ui";
import { Breadcrumb } from "../../_dashboard-kit/breadcrumb";
import { FormatDialog } from "../_components/format-dialog";
import { RecentRuns } from "../_components/recent-runs";
import { TemplateInfo, type OrgTypeInfo } from "../_components/template-info";
import { UploadPanel } from "../_components/upload-panel";
import { loadJobHistory } from "../_data/queries";

/** Cargas que se muestran en la pantalla; el resto está en el historial completo */
const RECENT_RUNS = 2;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IntegrationDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");
  const tenantId = session.user.tenantId;
  const { id } = await params;
  const integrationId = Number(id);
  if (!integrationId) notFound();

  const integration = await withTenantContext(tenantId, (tx) =>
    tx.intTenantIntegration.findFirst({
      where: { id: integrationId, tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        integrationTemplateCode: true,
        template: { select: { name: true } },
      },
    })
  );
  if (!integration) notFound();

  // Tipos de unidad organizativa del tenant (columnas del archivo) y motivos de baja
  const { orgTypes, terminationReasonCodes } = await withTenantContext(tenantId, async (tx) => {
    const [types, enabled, dims, reasons] = await Promise.all([
      tx.cfgOrgUnitType.findMany({ orderBy: { sortOrder: "asc" } }),
      tx.cfgTenantOrgUnitType.findMany({ where: { tenantId, isEnabled: true } }),
      tx.dshDimension.findMany({ where: { tenantId }, select: { orgUnitTypeCode: true } }),
      tx.cfgTerminationReason.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    ]);
    const enabledSet = new Set(enabled.map((e) => e.orgUnitTypeCode));
    const dimSet = new Set(dims.map((d) => d.orgUnitTypeCode));
    const orgTypes: OrgTypeInfo[] = types
      .filter((t) => enabledSet.has(t.code) || dimSet.has(t.code))
      .map((t) => ({ code: t.code, name: t.name, required: dimSet.has(t.code) }));
    return { orgTypes, terminationReasonCodes: reasons.map((r) => r.code) };
  });

  const recent = await loadJobHistory(tenantId, integrationId, { page: 1, pageSize: RECENT_RUNS });

  return (
    <div className="space-y-4 p-6">
      <Breadcrumb
        items={[
          { label: "Data", href: "/data" },
          { label: "Integraciones manuales", href: "/integrations" },
          { label: integration.name },
        ]}
      />
      <PageHeader eyebrow={integration.template.name} title={integration.name} />

      <UploadPanel
        integrationId={integration.id}
        formatButton={
          <FormatDialog integrationName={integration.name}>
            <TemplateInfo
              templateCode={integration.integrationTemplateCode}
              orgTypes={orgTypes}
              terminationReasonCodes={terminationReasonCodes}
            />
          </FormatDialog>
        }
      />

      <RecentRuns integrationId={integration.id} integrationName={integration.name} jobs={recent.items} />
    </div>
  );
}
