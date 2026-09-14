import "server-only";
import { cookies } from "next/headers";
import type { z } from "zod";
import { getAuthEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { readJson } from "@/lib/http/json";
import { productUrl } from "@/lib/validation/urls";
import { authService } from "../auth";
import { log } from "../logging";

// Paths and output schemas are selected by server code, never a browser URL parameter.
export function createProductClient(base: string, token: () => Promise<string>, transport: typeof fetch = fetch, invalidate: () => void = () => {}) {
  return async function request<T>(path: string, schema: z.ZodType<T>, options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown; query?: URLSearchParams; requestId: string;
  }): Promise<T> {
    let url: URL;
    try { url = productUrl(base, path); }
    catch { throw new HttpError(400, "invalid_path"); }
    if (options.query) url.search = options.query.toString();
    const accessToken = await token();
    try {
      const response = await transport(url, {
        method: options.method ?? "GET", cache: "no-store", redirect: "error",
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json",
          "x-request-id": options.requestId, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401) invalidate();
      const data = await readJson(response, schema);
      // Schemas must project allowed fields. Also reject accidental credential reflection.
      const serialized = JSON.stringify(data);
      if (serialized.includes(accessToken) || /"(?:access[_-]?token|refresh[_-]?token|client[_-]?secret)"\s*:/iu.test(serialized)) throw new HttpError(502, "unsafe_response");
      return data;
    } catch (error) {
      log("api.failed", { requestId: options.requestId });
      if (error instanceof HttpError && [400, 401, 403, 404, 409, 422, 429].includes(error.status)) throw error;
      throw new HttpError(502, "product_api_unavailable", options.requestId);
    }
  };
}
export async function productRequest<T>(path: string, schema: z.ZodType<T>, options: Parameters<ReturnType<typeof createProductClient>>[2]) {
  const env = getAuthEnv();
  const auth = authService();
  const id = (await cookies()).get(auth.sessionCookie)?.value;
  // Authentication precedes any external operation or config-dependent response.
  await auth.accessToken(id);
  if (!env.PRODUCT_API_URL) throw new HttpError(503, "product_api_not_configured");
  return createProductClient(env.PRODUCT_API_URL, () => auth.accessToken(id), fetch, () => { if (id) auth.invalidate(id); })(path, schema, options);
}
