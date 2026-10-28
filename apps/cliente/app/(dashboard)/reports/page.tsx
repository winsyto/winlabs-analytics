import { FileText } from "lucide-react";
import { ComingSoon } from "../_components/coming-soon";

export const metadata = { title: "Reportes" };

export default function ReportsHubPage() {
  return (
    <ComingSoon
      eyebrow="Reportes"
      title="Reportes"
      description="Acá vas a encontrar los reportes de tu empresa, agrupados por tema."
      icon={FileText}
    />
  );
}
