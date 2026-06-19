import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      {/* Hero */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 text-white"
        style={{ flex: "1.1", backgroundColor: "#1a1f24" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: "#dc2626" }}
          >
            WL
          </div>
          <span className="font-semibold text-sm tracking-wide">
            WinLabs Analytics
          </span>
        </div>

        {/* Headline + pill */}
        <div className="space-y-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "#dc2626" }}
            />
            People Analytics para LATAM
          </div>
          <h1 className="text-3xl font-bold leading-tight max-w-xs">
            Tomá decisiones basadas en datos de tu equipo.
          </h1>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Rotación mensual", value: "3.2%", delta: "−0.4%", positive: true },
            { label: "Ausentismo", value: "1.8%", delta: "+0.1%", positive: false },
            { label: "Headcount activo", value: "248", delta: "+12", positive: true },
            { label: "Tiempo promedio en rol", value: "2.4 años", delta: "estable", positive: true },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg p-4 space-y-1"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                {kpi.label}
              </p>
              <p className="text-xl font-bold">{kpi.value}</p>
              <p
                className="text-xs font-medium"
                style={{ color: kpi.positive ? "#4ade80" : "#f87171" }}
              >
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div
        className="flex flex-col items-center justify-center p-8 bg-white"
        style={{ flex: "0.9" }}
      >
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#dc2626", fontSize: "11px" }}
            >
              Acceso seguro
            </p>
            <h2 className="text-2xl font-bold text-foreground">
              Ingresá a tu cuenta
            </h2>
            <p className="text-sm text-muted-foreground">
              Usá el slug de tu organización, email y contraseña.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
