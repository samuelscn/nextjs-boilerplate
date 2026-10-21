import type { z } from "zod";
import { HttpError } from "./error";
import { readJson } from "./json";
import { NetworkError } from "./api-error";

export async function bffRequest<T>(path: string, schema: z.ZodType<T>, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; query?: URLSearchParams; signal?: AbortSignal } = {}): Promise<T> {
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/u.test(path) || path.includes("//")) throw new HttpError(400, "invalid_path");
  const controller = AbortSignal.timeout(10_000);
  // toString(), not URLSearchParams.size: size needs Safari 17, below the Safari 16.4 supported by Next.
  const search = init.query?.toString();
  let response: Response;
  try {
    response = await fetch(search ? path + "?" + search : path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json", ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: init.signal ? AbortSignal.any([init.signal, controller]) : controller,
    });
  } catch { throw new NetworkError(); }
  return readJson(response, schema);
}
