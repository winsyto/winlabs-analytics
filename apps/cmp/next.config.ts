import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Los packages workspace exportan TypeScript directo (sin compilar),
  // Next.js necesita transpilárlos en el build.
  transpilePackages: ["@wla/ui", "@wla/db", "@wla/auth", "@wla/email"],
};

export default withSentryConfig(nextConfig, {
  org: "winlabs-2x",
  project: "wla-cmp",

  // Silencioso en desarrollo local, verbose en CI/Vercel
  silent: !process.env.CI,

  // Subir source maps pero no incluirlos en el bundle del cliente
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Elimina logs de Sentry del bundle de producción
  disableLogger: true,
});
