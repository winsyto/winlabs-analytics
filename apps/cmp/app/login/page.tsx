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
            Acceso exclusivo para el equipo WinLabs
          </div>
          <h1 className="text-3xl font-bold leading-tight max-w-xs">
            Console interna de operaciones y tenants.
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Tenants activos", value: "12", delta: "+2 este mes" },
            { label: "Usuarios totales", value: "847", delta: "+34 este mes" },
            { label: "Integraciones activas", value: "38", delta: "estable" },
            { label: "Uptime", value: "99.9%", delta: "últimos 90 días" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg p-4 space-y-1"
              style={{
                backgroundColor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                {stat.label}
              </p>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {stat.delta}
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
              Console interna
            </p>
            <h2 className="text-2xl font-bold text-foreground">
              Acceso WinLabs
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresá con tu cuenta del equipo WinLabs.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
