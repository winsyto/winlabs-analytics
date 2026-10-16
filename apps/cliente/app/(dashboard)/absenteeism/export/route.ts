import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { getDashboardDimensions } from "../../_dashboard-kit/dimensions";
import { parseFilters } from "../_data/filters";
import { AbsenteeismPdf } from "../_export/pdf-document";
import { collectReport } from "../_export/report";
import { buildXlsx } from "../_export/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return new Response("No autorizado", { status: 401 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format !== "xlsx" && format !== "pdf") return new Response("Formato inválido", { status: 400 });

  const dimensions = await getDashboardDimensions(session.user.tenantId, "absenteeism");
  const filters = parseFilters(Object.fromEntries(url.searchParams), dimensions);
  const report = await collectReport(session.user.tenantId, filters, dimensions);
  if (!report) return new Response("Sin datos para exportar", { status: 404 });

  const base = `ausentismos-${report.tenantSlug}-${report.overview.freshness.refMonth.slice(0, 7)}`;

  if (format === "xlsx") {
    const buf = await buildXlsx(report);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await renderToBuffer(createElement(AbsenteeismPdf, { report }) as never);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
