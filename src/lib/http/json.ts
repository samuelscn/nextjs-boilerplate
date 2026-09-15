import type { z } from "zod";
import { HttpError } from "./error";
import { readBodyJson } from "./body";
import { normalizeApiError } from "./normalize";
import { correlationId } from "./correlation";

export async function readJson<T>(response: Response, schema: z.ZodType<T>, maxBytes = 1024 * 1024): Promise<T> {
  if (!response.ok) throw await normalizeApiError(response);
  try {
    const result = schema.safeParse(await readBodyJson(response, maxBytes));
    if (!result.success) throw new Error("Invalid response");
    return result.data;
  } catch { throw new HttpError(502, "INTERNAL_SERVER_ERROR", correlationId(response.headers)); }
}
