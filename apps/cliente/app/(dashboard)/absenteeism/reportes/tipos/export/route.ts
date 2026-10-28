import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { isDashboardEnabled } from "../../../../_dashboard-kit/dashboard-access";
import { prisma } from "@wla/db/client";
import { filterTokens, NONE_TOKEN } from "../../../../_dashboard-kit/dimension-filters";
import { getDashboardDimensions } from "../../../../_dashboard-kit/dimensions";
import { loadTypeReport, parseTypeReportParams } from "../../_data/by-type";
import { buildTypeXlsx, TypeReportPdf, type TypeReportExport } from "../../_export/type-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return new Response("No autorizado", { status: 401 });
  if (!(await isDashboardEnabled(session.user.tenantId, "absenteeism"))) return new Response("Dashboard no habilitado", { status: 403 });
  const tenantId = session.user.tenantId;

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") return new Response("Formato inválido", { status: 400 });

  const dimensions = await getDashboardDimensions(tenantId, "absenteeism");
  const params = parseTypeReportParams(Object.fromEntries(url.searchParams), dimensions);
  const data = await loadTypeReport(tenantId, dimensions, params);
  if (data.status !== "ok") return new Response("Sin datos para exportar", { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
  const names = (code: string) => {
    const dim = data.dimensionOptions.find((d) => d.code === code);
    const tokens = filterTokens(params.filters.dims[code]);
    return tokens.length
      ? tokens.map((t) => (t === NONE_TOKEN ? "Sin asignar" : (dim?.options.find((o) => o.value === t)?.label ?? t))).join(", ")
      : "Todos";
  };
  const labelOf = (codes: string[], opts: { value: string; label: string }[]) =>
    codes.length ? codes.map((c) => opts.find((o) => o.value === c)?.label ?? c).join(", ") : "Todos";
  const rep: TypeReportExport = {
    tenantName: tenant?.name ?? "",
    tenantSlug: tenant?.slug ?? "tenant",
    exportedAt: new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()),
    data,
    filterLines: [
      { label: "Columnas por", value: data.groupName ?? "Total" },
      ...data.dimensionOptions.map((d) => ({ label: d.name, value: names(d.code) })),
      { label: "Clase de ausencia", value: labelOf(params.filters.classes, data.classOptions) },
      { label: "Tipo de ausencia", value: labelOf(params.filters.types, data.typeOptions) },
    ],
  };
  const base = `ausentismos-tipos-${rep.tenantSlug}-${params.filters.p}`;

  if (format === "xlsx") {
    const buf = await buildTypeXlsx(rep);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const pdf = await renderToBuffer(createElement(TypeReportPdf, { rep }) as never);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
