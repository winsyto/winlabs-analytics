import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { isDashboardEnabled } from "../../../_dashboard-kit/dashboard-access";
import { getDashboardDimensions } from "../../../_dashboard-kit/dimensions";
import { parseFilters } from "../../_data/filters";
import { ConceptPdf } from "../../_export/concept-pdf";
import { collectConceptReport } from "../../_export/concept-report";
import { buildConceptXlsx } from "../../_export/concept-xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return new Response("No autorizado", { status: 401 });
  if (!(await isDashboardEnabled(session.user.tenantId, "payroll"))) return new Response("Dashboard no habilitado", { status: 403 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") return new Response("Formato inválido", { status: 400 });
  const raw = url.searchParams.get("c");
  const conceptId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const dimensions = await getDashboardDimensions(session.user.tenantId, "payroll");
  const filters = parseFilters(Object.fromEntries(url.searchParams), dimensions);
  const report = await collectConceptReport(session.user.tenantId, filters, dimensions, conceptId);
  if (!report) return new Response("Sin datos para exportar", { status: 404 });

  const code = report.data.detail?.concept.code.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") ?? "conceptos";
  const base = `payroll-${code}-${report.tenantSlug}-${report.data.freshness.refMonth.slice(0, 7)}`;

  if (format === "xlsx") {
    const buf = await buildConceptXlsx(report);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await renderToBuffer(createElement(ConceptPdf, { report }) as never);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
