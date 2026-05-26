"use client";

// Página temporal para verificar que Sentry captura errores correctamente.
// ELIMINAR antes de lanzar a producción real, o proteger con feature flag.

export default function SentryTestPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Sentry Test — CMP</h1>
        <p className="text-sm text-muted-foreground">
          Hacé click para lanzar un error de prueba y verificar que llega al
          dashboard de Sentry.
        </p>
        <button
          className="px-4 py-2 bg-destructive text-white rounded-md text-sm"
          onClick={() => {
            throw new Error("[CMP] Error de prueba Sentry — podés ignorar esto");
          }}
        >
          Lanzar error de prueba
        </button>
      </div>
    </main>
  );
}
