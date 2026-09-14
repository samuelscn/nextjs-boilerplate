import type { z } from "zod";
import { HttpError } from "./error";
import { readJson } from "./json";

export async function bffRequest<T>(path: string, schema: z.ZodType<T>, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/u.test(path) || path.includes("//")) throw new HttpError(400, "invalid_path");
  const controller = AbortSignal.timeout(10_000);
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json", ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: init.signal ? AbortSignal.any([init.signal, controller]) : controller,
    });
  } catch { throw new HttpError(503, "network_unavailable"); }
  return readJson(response, schema);
}
