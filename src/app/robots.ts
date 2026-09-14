import type { MetadataRoute } from "next";
import { getEnv } from "@/config/env";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  return env.APP_KIND === "public" ? {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/app", "/backoffice"] },
    sitemap: env.APP_URL + "/sitemap.xml",
  } : { rules: { userAgent: "*", disallow: "/" } };
}
