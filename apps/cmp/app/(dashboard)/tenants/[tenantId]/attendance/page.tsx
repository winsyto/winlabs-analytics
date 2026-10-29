import { notFound } from "next/navigation";
import { prisma } from "@wla/db/client";
import { TenantAttendanceCard } from "../_components/tenant-attendance-card";
import { TenantSectionHeader } from "../_components/tenant-section-header";
import { getAttendanceSettings } from "../_data/tenant-config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Asistencia del tenant" };

export default async function TenantAttendancePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) notFound();

  const settings = await getAttendanceSettings(tenantId);

  return (
    <div className="space-y-4 p-8">
      <TenantSectionHeader
        tenant={tenant}
        section="attendance"
        title="Asistencia"
        description="modo, jornada y formato de las horas y las liquidaciones"
      />
      <TenantAttendanceCard tenantId={tenant.id} settings={settings} />
    </div>
  );
}
