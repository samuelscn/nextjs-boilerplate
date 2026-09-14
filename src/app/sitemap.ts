import type { MetadataRoute } from "next";
import { getEnv } from "@/config/env";

export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const env = getEnv();
  return env.APP_KIND === "public" ? [{ url: env.APP_URL + "/" }] : [];
}
