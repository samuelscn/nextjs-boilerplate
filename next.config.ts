import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  output: "standalone",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: { remotePatterns: [], dangerouslyAllowSVG: false },
  logging: { incomingRequests: false },
};
export default config;
