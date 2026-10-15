import Link from "next/link";
import { CalendarOff, Clock, Target, Users } from "lucide-react";

const SECTIONS = [
  {
    href: "/settings/shifts",
    title: "Turnos",
    description: "Horas diarias y semana laboral de cada turno. Definen las horas programadas del ausentismo.",
    icon: Clock,
  },
  {
    href: "/settings/absence-types",
    title: "Tipos de ausencia",
    description: "Cómo se clasifica cada tipo de ausencia y si cuenta como ausentismo.",
    icon: CalendarOff,
  },
  {
    href: "/settings/targets",
    title: "Metas",
    description: "Valores de referencia que los dashboards muestran como meta.",
    icon: Target,
  },
  {
    href: "/settings/users",
    title: "Usuarios",
    description: "Usuarios de la empresa y sus roles.",
    icon: Users,
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Configuración</h1>
        <p className="text-muted-foreground text-sm">Ajustes de la empresa que usan los dashboards.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex h-full items-start gap-3 rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-foreground">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
