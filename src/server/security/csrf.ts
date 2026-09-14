import "server-only";
import { HttpError } from "@/lib/http/error";

export function assertSameOrigin(request: Request, appOrigin: string): void {
  if (request.headers.get("origin") !== appOrigin ||
      ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "")) {
    throw new HttpError(403, "invalid_origin");
  }
}
