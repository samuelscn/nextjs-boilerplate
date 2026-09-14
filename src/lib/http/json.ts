import type { z } from "zod";
import { HttpError } from "./error";

export async function readJson<T>(response: Response, schema: z.ZodType<T>, maxBytes = 1024 * 1024): Promise<T> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(response.status, "request_failed", response.headers.get("x-request-id") ?? undefined);
  }
  if (!response.headers.get("content-type")?.split(";")[0]?.endsWith("/json") &&
      !response.headers.get("content-type")?.split(";")[0]?.endsWith("+json")) {
    await response.body?.cancel();
    throw new HttpError(502, "invalid_response");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, "empty_response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) throw new HttpError(502, "response_too_large");
      chunks.push(part.value);
    }
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
    const result = schema.safeParse(parsed);
    if (!result.success) throw new HttpError(502, "invalid_response");
    return result.data;
  } catch (error) {
    await reader.cancel();
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "invalid_response");
  } finally { reader.releaseLock(); }
}
