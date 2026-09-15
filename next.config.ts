import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  output: "standalone",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: { remotePatterns: [], dangerouslyAllowSVG: false },
  logging: { incomingRequests: false },
};
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
