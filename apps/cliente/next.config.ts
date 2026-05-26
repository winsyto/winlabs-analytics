import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los packages workspace exportan TypeScript directo (sin compilar),
  // Next.js necesita transpilárlos en el build.
  transpilePackages: ["@wla/ui", "@wla/db", "@wla/auth"],
};

export default nextConfig;
