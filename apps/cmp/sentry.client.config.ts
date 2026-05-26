import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capturar el 100% de trazas en producción — bajar a 0.1 cuando haya volumen real
  tracesSampleRate: 1.0,

  // Replay: grabar sesión completa solo cuando hay error
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  integrations: [Sentry.replayIntegration()],

  debug: false,
});
