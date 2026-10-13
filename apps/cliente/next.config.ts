import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@wla/ui", "@wla/db", "@wla/auth", "@wla/email"],
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
};

export default withSentryConfig(nextConfig, {
  org: "winlabs-2x",
  project: "wla-cliente",

  silent: !process.env.CI,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  disableLogger: true,
});
