import "server-only";
import type { z } from "zod";
import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { readBodyJson } from "@/lib/http/body";
import { ApiError } from "@/lib/http/api-error";
import { validationDetails } from "@/lib/validation/details";
import type { Permission } from "@/lib/access/permissions";
import type { FlagName } from "@/config/flags";
import { isEnabled } from "../flags";
import { getSession } from "../auth";
import { assertPermission } from "../access";
import { errorResponse, privateJson, requestId } from "../http";
import { assertSameOrigin } from "../security/csrf";

// Product code mounts a named route and supplies a validated operation.
// There is intentionally no catch-all HTTP proxy route.
export function createBffHandler<Input, Output>(options: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  input?: z.ZodType<Input>;
  output: z.ZodType<Output>;
  /** Re-checked on the server before execute; the Product API still authorizes the call. */
  permission?: Permission;
  /** Disabled flag answers 404, as if the operation did not exist. */
  flag?: FlagName;
  execute: (input: Input | undefined, requestId: string) => Promise<Output>;
}, dependencies: { getEnv: typeof getEnv; getSession: typeof getSession; assertPermission?: typeof assertPermission; isEnabled?: typeof isEnabled } = { getEnv, getSession, assertPermission, isEnabled }) {
  return async (request: Request): Promise<Response> => {
    const id = requestId(request);
    try {
      const env = dependencies.getEnv();
      if (env.APP_KIND === "public") throw new HttpError(404, "not_found");
      if (options.flag && !await (dependencies.isEnabled ?? isEnabled)(options.flag)) throw new HttpError(404, "not_found");
      if (request.method !== options.method) throw new HttpError(405, "method_not_allowed");
      if (request.method !== "GET") assertSameOrigin(request, env.APP_URL);
      if (!await dependencies.getSession()) throw new HttpError(401, "unauthorized");
      if (options.permission) await (dependencies.assertPermission ?? assertPermission)(options.permission);
      let input: Input | undefined;
      if (options.input) {
        let body: unknown;
        try {
          body = await readBodyJson(new Response(request.body, { headers: request.headers }), 16_384);
        } catch { throw new HttpError(400, "invalid_input"); }
        const parsed = options.input.safeParse(body);
        if (!parsed.success) throw new ApiError({ status: 400, code: "VALIDATION_ERROR", errors: validationDetails(parsed.error) });
        input = parsed.data;
      }
      const result = options.output.safeParse(await options.execute(input, id));
      if (!result.success) throw new HttpError(502, "invalid_response");
      return privateJson(result.data, 200, id);
    } catch (error) { return errorResponse(error, id); }
  };
}
